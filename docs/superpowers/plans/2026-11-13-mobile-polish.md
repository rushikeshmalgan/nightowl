# Mobile Polish (follow-up to phases 1–4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what is still broken on a real phone after phases 1–4, as seen on a 360×800 emulated Samsung with a real PDF open: PDF pages wider than the screen, a status line with no document title, and a music dock whose Sleep and Browse controls are pushed off screen.

**Architecture:** PDF pages are shrunk to fit the available width (never enlarged), with zoom relative to that fit and the reading place kept across zoom and rotation. The status line, dock and rail get compact narrow layouts (Tailwind `max-sm:` plus the existing `useMediaQuery(NARROW_QUERY)` where the structure changes). Each task adds checks to a new `phone` group in the browser suite (360×800, touch) and is read on screenshots.

**Tech Stack:** React, TypeScript, Tailwind v4, Vitest + Testing Library, `playwright-core` (existing `scripts/e2e`).

**Spec:** `docs/superpowers/specs/2026-11-13-mobile-responsive-design.md`. Follows `docs/superpowers/plans/2026-11-13-mobile-responsive-phases-1-4.md`.

## Global Constraints

- Phases 5–6 (PDF reflow, in-document search) are NOT started here. Reflow is still the real fix for *reading* a small-print PDF on a phone; this plan only makes Pages mode usable.
- The earlier constraint "do not edit `PdfViewer.tsx`" is relaxed for narrow screens only: a page is only ever shrunk to fit, never enlarged, so wherever the 100% page already fits (desktop) nothing renders differently. `BASE_SCALE` and the page model stay.
- `getPageSize(n, scale)` stays the source of page sizes (existing tests rely on it).
- No new runtime dependency. One commit per task, tests first.
- Narrow = below `sm` (640px). Touch targets on narrow are 44px.
- Baseline: 639 unit tests, 55 browser checks; all must still pass.
- Every task is verified in the `phone` group (360×800, touch) and, where layout changes, at 375×667 and 768×1024, with the screenshots read.
- Work on branch `feat/mobile-responsive`.

## Review Focus

1. **Desktop unchanged:** at widths where the page already fits, PDF page size, the dock and the status line render as before.
2. **Zoom is relative to fit:** 100% fits the width; zooming in scrolls sideways on purpose; zoom in/out and rotation keep the same place in the document.
3. **Tablet widths (640–1023px):** the dock's Browse button must not be pushed off screen by the source buttons.
4. **Nothing unreachable on a phone:** play, skip, Browse and the sleep timer can all be tapped at 360px.
5. **A resize that does not change the fit** (desktop window drag) must not re-measure or redraw pages.

---

### Task 1: PDF pages fit the screen width

**Files:**
- Modify: `src/features/pdf/PdfViewer.tsx`, `src/features/pdf/PdfViewer.test.tsx`, `scripts/e2e/run.mjs`

- [ ] **Step 1: Write the failing tests.** `PdfViewer.test.tsx` (spy `clientWidth`): with a 600px page and an available width of 304px, the page placeholder is shrunk to fit (width ≤ available); a wider container leaves the 600px page alone; a zoom change keeps the fit and scales relative to it; an unmeasurable container (width 0, as in jsdom) changes nothing. Browser: add `openMobile(env, size)` and a `phone` group; with a PDF open at 360×800 the page is ≤ 296px wide and `pdf-scroll` does not scroll sideways at 100%.
- [ ] **Step 2: Run** `npx vitest run src/features/pdf` and `npm run e2e -- phone`. Expected: FAIL (page is ~796px).
- [ ] **Step 3: Implement.** Measure the scroller's width (ResizeObserver, guarded; subtract the left rail padding and the inner gutter; 0 means unconstrained). Keep measuring pages at `(zoom/100)·BASE_SCALE`; derive the layout from that snapshot with `k = min(1, available / widestPageAtZoom100)` so pages are scaled arithmetically and `layout.scale = measured.scale · k`. Memoise so a resize that leaves `k = 1` keeps the same layout object. Inner gutter `px-2 sm:px-6`.
- [ ] **Step 4: Run** the same commands plus `npm run typecheck`. Expected: PASS. Read `phone-pdf-fit.png`.
- [ ] **Step 5: Commit** `fix: fit PDF pages to the screen width on narrow screens`.

### Task 2: Zoom and rotation keep the reading place

**Files:**
- Modify: `src/features/pdf/PdfViewer.tsx`, `src/features/pdf/PdfViewer.test.tsx`, `scripts/e2e/run.mjs`

- [ ] **Step 1: Write the failing tests.** Unit: after scrolling into page 3, a zoom change leaves page 3 under the top edge (same page, same fraction through it); the same for a width-driven re-fit; a layout change before the first restore does not move anything. Browser: scroll to page 4, tap Zoom in three times, the page's distance from the top of the scroller changes by under 60px.
- [ ] **Step 2: Run.** Expected: FAIL (the scroll offset stays numerically the same, so the document slides).
- [ ] **Step 3: Implement.** Record an anchor (page index and fraction through it) on every scroll; when the layout's scale changes after the first restore, set `scrollTop` from the anchor against the new page offsets and keep the horizontal centre.
- [ ] **Step 4: Run** unit, typecheck and `npm run e2e -- phone mobile`. Expected: PASS.
- [ ] **Step 5: Commit** `fix: keep the reading place when PDF zoom or width changes`.

### Task 3: The document title is readable in the status line on phones

**Files:**
- Modify: `src/features/shell/StatusLine.tsx`, `src/features/presence/PresenceBadge.tsx`, their tests, `scripts/e2e/run.mjs`

- [ ] **Step 1: Write the failing tests.** Presence keeps its full text on wide screens and shows only "N online" on narrow; flag words are not shown on narrow (the rail buttons already show pressed state). Browser: at 360×800 with a long PDF name open, `status-title` is at least 100px wide and its text is not clipped to nothing.
- [ ] **Step 2: Run.** Expected: FAIL (title is squeezed to zero).
- [ ] **Step 3: Implement** with `useMediaQuery(NARROW_QUERY)` for the presence text and `max-sm:hidden` for flags; tighter gap on narrow.
- [ ] **Step 4: Run** unit, typecheck, `npm run e2e -- phone`. Read `phone-status-line.png`.
- [ ] **Step 5: Commit** `fix: show the document title in the status line on phones`.

### Task 4: The music dock fits phones and tablets

**Files:**
- Modify: `src/features/music/MusicDock.tsx`, `src/features/music/MusicDock.test.tsx`, `scripts/e2e/run.mjs`

- [ ] **Step 1: Write the failing tests.** On narrow: no cover or inline sleep select in the dock, the title block is flexible, buttons are 44px, and the Browse panel contains the sleep timer select and fits beside the rail. On wide: unchanged. Source buttons appear from `lg` (1024px) up, not `sm`. Browser: at 360×800 every dock control sits inside the viewport, Browse opens, the sleep timer can be set from it; at 768×1024 the Browse button is on screen.
- [ ] **Step 2: Run.** Expected: FAIL (controls are clipped by the screen edge).
- [ ] **Step 3: Implement** the compact narrow dock, a shared `SleepSelect`, a narrow-only countdown chip while a timer runs, `lg:flex` for the source group, and `max-w-[calc(100%-3rem)]` on the Browse panel.
- [ ] **Step 4: Run** unit, typecheck, `npm run e2e -- phone`. Read `phone-dock.png` and `tablet-dock.png`.
- [ ] **Step 5: Commit** `fix: make the music dock fit phones and tablets`.

### Task 5: Rail touch targets and panel widths

**Files:**
- Modify: `src/features/shell/Rail.tsx`, `src/features/feedback/FeedbackPanel.tsx`, their tests, `scripts/e2e/run.mjs`

- [ ] **Step 1: Write the failing tests.** Rail buttons carry 44px classes on narrow and the rail scrolls when short; the Feedback panel is capped to the viewport. Browser: at 360×800 every rail button is at least 44px and on screen; the Feedback panel's right edge is within 360.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** unit, typecheck, `npm run e2e -- phone mobile`. Read `phone-rail.png`.
- [ ] **Step 5: Commit** `fix: 44px rail buttons and viewport-sized panels on phones`.

### Task 6: Wrap-up and full verification

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Run the complete verification:** `npm test`, `npm run typecheck`, `npm run build`, and `npm run e2e -- --build`. Expected: all pass, zero CSP violations.
- [ ] **Step 2: Update STATUS.md** (a "Mobile polish" entry with the new counts, what is still open: Reflow, Browse as a true sheet, PSD controls), then commit `docs: update status for mobile polish`. Stop and report.
