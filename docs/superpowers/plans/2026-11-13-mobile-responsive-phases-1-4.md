# Mobile-Responsive Pass, Phases 1–4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NightOwl Reader usable on a 375px phone: touch-safe panel triggers, bottom-sheet panels, an always-reachable zoom control, and honest disabled states for controls that do nothing on a PDF.

**Architecture:** Responsive behaviour is driven by two media queries read through one `useMediaQuery` hook (hover-capable fine pointer; width below Tailwind's `sm`), plus Tailwind `max-sm:` classes for layout. Three panels share one sheet layout constant and a swipe/close handle. Every task adds a check to a new `mobile` group in the browser suite that runs in a real 375×667 touch-emulated context.

**Tech Stack:** React, TypeScript, Tailwind v4, Vitest + Testing Library, `playwright-core` (existing `scripts/e2e`).

**Spec:** `docs/superpowers/specs/2026-11-13-mobile-responsive-design.md` (its file paths predate the feature-folder reorganisation: `App.tsx` is `src/app/App.tsx`; panels are in `src/features/{shell,library,audio}`).

## Global Constraints

- "No new runtime dependency unless genuinely needed." None are added.
- "Keep the existing feature-folder structure and one-commit-per-task, tests-first method."
- "`BASE_SCALE`/page-canvas pagination (`PdfViewer.tsx`) must keep working unchanged." Do not edit `PdfViewer.tsx`.
- "None of this regresses the desktop experience (hover-to-open stays on mouse+hover devices; the existing 555 unit tests and e2e suite still pass)." Baseline today: 571 unit tests, 35 browser checks; all must still pass.
- Narrow means below Tailwind's `sm` (640px): `@media (width < 40rem)`. Panels there are a bottom sheet, full width, max ~75vh, internal scroll, swipe-down or backdrop tap to dismiss. At 640px and above they are unchanged.
- Nothing opens from a scroll or swipe: panels open only from an explicit tap.
- Reuse the existing `motion-slide` / `motion-fade` classes for animation; radii stay 4–6px.
- Every task is verified on a real 375×667 viewport (browser suite `mobile` group) as well as desktop, and ends with `npm test`, `npm run typecheck` and its commit.
- Do not start phases 5–6 (PDF reflow, in-document search).
- Work on branch `feat/mobile-responsive`, created from `feat/nocturne-rebuild`.

## Review Focus

1. **Hybrid or changing devices** (attach a mouse, rotate, devtools toggle): the hover strip must appear and disappear as the media query changes, without a reload. → Task 1.
2. **Window widened while a panel is closed** (phone rotated to landscape ≥ 640px): the closed Tuning panel must not be left visible; its off-screen transform must switch axis. → Task 3.
3. **Two sheets open at once on a narrow screen** (via palette or hotkey): they would stack on the same spot; opening one must close the others. → Task 3.
4. **Zoom at its limits**: the buttons stop at 60% and 180% and never emit a value outside that range. → Task 4.
5. **Bionic left on from a text document, then a PDF opened**: the PDF must not show "Bionic", `Ctrl+B` must neither toggle nor silently do nothing visible, and returning to the text document must find bionic still on. → Task 5.

---

### Task 1: Touch-safe Tuning trigger and the mobile test harness

**Files:**
- Create: `src/shared/useMediaQuery.ts`, `src/shared/useMediaQuery.test.ts`, `src/test/media.ts`
- Modify: `vitest.setup.ts`, `src/app/App.tsx` (hover strip, ~line 421), `src/app/App.test.tsx`, `scripts/e2e/run.mjs`, `.gitignore`
- Test: the three test files above, plus the browser suite

**Interfaces:**
- Produces: `FINE_HOVER_QUERY = '(hover: hover) and (pointer: fine)'`; `NARROW_QUERY = '(width < 40rem)'`; `useMediaQuery(query: string): boolean` (false when `matchMedia` is missing; re-renders when the query changes). In `src/test/media.ts`: `setMedia(state: { hover?: boolean; narrow?: boolean }): void` (defaults `hover: true`, `narrow: false`; notifies listeners) and `resetMedia(): void`; `vitest.setup.ts` installs a `window.matchMedia` backed by them and resets after every test.
- Produces for later tasks: in `run.mjs`, groups are called `run(page, env)` with `env = { browser, url }`; helper `openMobile(env)` returns a `{ context, page }` at 375×667 with `isMobile` and `hasTouch`; `watch(page)` attaches the console and page-error collectors; a `mobile` group exists; mobile screenshots go to `.e2e-shots/`.

- [ ] **Step 1: Write failing tests.** `useMediaQuery.test.ts`: returns `true`/`false` from `setMedia`; re-renders when `setMedia({ hover: false })` fires while mounted; returns `false` when `window.matchMedia` is deleted. `App.test.tsx`: with `setMedia({ hover: false })` there is no `data-testid="tuning-hover-strip"` element; with the default, `fireEvent.mouseEnter(strip)` sets the Tuning panel `data-open="true"` and `mouseLeave` on the panel closes it; calling `setMedia({ hover: false })` inside `act` removes the strip without remounting **(Review Focus 1)**.
- [ ] **Step 2: Run** `npx vitest run src/shared src/app/App.test.tsx`. Expected: FAIL (module missing; no strip test id).
- [ ] **Step 3: Implement** `useMediaQuery` with `useSyncExternalStore` over `matchMedia(query)` `change` events; implement `src/test/media.ts` and the setup install; in `App.tsx` render the strip only when `useMediaQuery(FINE_HOVER_QUERY)` is true and give it the test id.
- [ ] **Step 4: Run** the same command plus `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Add the mobile harness and checks** to `run.mjs`: refactor the existing `pageerror`/`console` listeners into `watch(page)` and call it for the main and mobile pages; add the `mobile` group with checks (a) `document.documentElement.scrollWidth <= 375`, (b) `matchMedia(FINE_HOVER_QUERY).matches === false` in the emulated context (if Chromium reports `true`, emulate with CDP `Emulation.setEmulatedMedia` features `hover: none` and `pointer: coarse` instead and note it in the ledger), (c) `page.touchscreen.tap(372, 300)` leaves the Tuning panel `data-open="false"` and no strip exists. Save a screenshot to `.e2e-shots/`; add that folder to `.gitignore`. Run `node scripts/e2e/run.mjs mobile` and read the screenshot. Expected: all `mobile` checks PASS.
- [ ] **Step 6: Commit** the spec, this plan and the code: `fix: stop the tuning panel opening from touch, add mobile e2e harness`.

### Task 2: SheetHandle (swipe-down and close button)

**Files:**
- Create: `src/features/shell/SheetHandle.tsx`, `src/features/shell/SheetHandle.test.tsx`

**Interfaces:**
- Produces: `SWIPE_CLOSE_PX = 60`; `SheetHandle(props: { onClose(): void })` renders a grab bar plus a button labelled `Close panel`, both hidden at `sm` and above (`sm:hidden`); a downward drag of at least `SWIPE_CLOSE_PX` on the grab bar (`data-testid="sheet-handle"`) calls `onClose`.

- [ ] **Step 1: Write failing tests:** `pointerDown` at `clientY 100` then `pointerUp` at `180` on the handle calls `onClose` once; release at `130` (30px) does not; an upward drag does not; `pointerCancel` after a long drag does not; clicking `Close panel` calls it.
- [ ] **Step 2: Run** `npx vitest run src/features/shell/SheetHandle.test.tsx`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `SheetHandle` with pointer capture and `touch-action: none` on the grab bar only, so the sheet's own content still scrolls.
- [ ] **Step 4: Run** the same command and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: sheet handle with swipe-down dismiss`. (Visible on a phone in Task 3, where it is first used.)

### Task 3: Bottom sheets for Tuning, Library and Audio

**Files:**
- Create: `src/features/shell/sheet.ts`, `src/features/shell/useExclusiveSheets.ts`, `src/features/shell/useExclusiveSheets.test.ts`, `src/features/shell/TuningPanel.test.tsx`
- Modify: `src/features/shell/TuningPanel.tsx`, `src/features/library/LibraryPanel.tsx`, `src/features/audio/AudioPanel.tsx`, `src/app/App.tsx`, `src/app/App.test.tsx`, `scripts/e2e/run.mjs`
- Test: the new test files plus the existing `LibraryPanel.test.tsx`, `AudioPanel.test.tsx`

**Interfaces:**
- Consumes: `useMediaQuery`, `NARROW_QUERY`, `setMedia` (Task 1); `SheetHandle` (Task 2).
- Produces: `SHEET_LAYOUT` (a string of `max-sm:` utilities: full width, `max-sm:bottom-14` so it clears the 56px dock, `max-sm:top-auto`, `max-sm:max-h-[75dvh]`, top border only, 6px top radii) shared by the three panels; `useExclusiveSheets(narrow: boolean): void`; `LibraryPanel` and `AudioPanel` gain an optional `onClose?(): void` that renders `SheetHandle` at the top of the panel; in `App`, a `data-testid="sheet-backdrop"` button labelled `Close panel`, `sm:hidden`, placed after the status line and before the panels, shown while Tuning, Library or Audio is open, whose tap closes all three.

- [ ] **Step 1: Write failing tests.** `TuningPanel.test.tsx`: closed + default media has inline transform `translateX(100%)`; closed + `setMedia({ narrow: true })` has `translateY(100%)`; open has `none`; after `act(() => setMedia({ narrow: false }))` while closed it is `translateX(100%)` again **(Review Focus 2)**; the panel root class list contains `max-sm:max-h-[75dvh]`. `useExclusiveSheets.test.ts`: with `narrow` true, opening `libraryOpen` while `tuningOpen` is true leaves only `libraryOpen`; with `narrow` false both stay open **(Review Focus 3)**. `App.test.tsx`: no backdrop while all closed; opening Tuning shows it; clicking it closes Tuning, Library and Audio; `LibraryPanel`/`AudioPanel` render the `Close panel` button and call `onClose`; the existing panel tests still pass.
- [ ] **Step 2: Run** `npx vitest run src/features src/app`. Expected: FAIL (new modules and attributes missing).
- [ ] **Step 3: Implement** the three panels with `SHEET_LAYOUT`, `SheetHandle` and the Tuning transform from `useMediaQuery(NARROW_QUERY)` (replacing the fixed `translateX`); `useExclusiveSheets` subscribes to `useUi` and, when narrow and more than one of `tuningOpen`/`libraryOpen`/`audioOpen` is true, closes all but the one that just opened; wire the backdrop and the `onClose` props in `App.tsx`.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Add browser checks.** In the `mobile` group, for each of Tuning (rail button `Tuning`), Library and Audio: tap the rail button, then assert the panel's bounding box has width 375, height ≤ `0.75 * 667`, bottom edge ≤ 611 (above the dock), and top ≥ 100 (the document stays visible above it); tap the backdrop and assert it closed; reopen and drag the handle 80px down with `page.mouse` and assert it closed. In the desktop `shell` group add: at 1280px the Library panel is 288px wide at `left: 48` and the backdrop is not visible. Run `node scripts/e2e/run.mjs shell mobile`, then read the `.e2e-shots/` screenshots of each open sheet. Expected: PASS and sheets look correct.
- [ ] **Step 6: Commit** `feat: bottom sheets for tuning, library and audio on narrow screens`.

### Task 4: Floating zoom control

**Files:**
- Create: `src/features/reader/ZoomControl.tsx`, `src/features/reader/ZoomControl.test.tsx`
- Modify: `src/features/shell/ui.ts`, `src/features/shell/TuningPanel.tsx`, `src/app/App.tsx`, `src/app/App.test.tsx`, `scripts/e2e/run.mjs`

**Interfaces:**
- Produces: `ZOOM_MIN = 60`, `ZOOM_MAX = 180`, `ZOOM_STEP = 10` exported from `ui.ts` (the Tuning zoom scrubber switches to them); `ZoomControl(props: { zoom: number; onChange(zoom: number): void })`: a group labelled `Zoom` with buttons `Zoom out`, `Zoom in` (each 44px square below `sm`) and a reset button showing `${zoom}%` labelled `Reset zoom, now ${zoom}%`; it never calls `onChange` outside 60–180, and the end buttons are `disabled` at the limits. In `App`, shown inside `Chrome` whenever a document is open, `absolute bottom-16 right-3`, wired to `ui.zoom`.

- [ ] **Step 1: Write failing tests.** `ZoomControl.test.tsx`: from 100, `Zoom in` calls `onChange(110)` and `Zoom out` `onChange(90)`; at 180 `Zoom in` is disabled and a click emits nothing; at 60 `Zoom out` is disabled **(Review Focus 4)**; from 85 (off the step grid) `Zoom in` emits 95 and from 175 emits 180; reset emits 100; the reset label reads `Reset zoom, now 150%` at 150. `App.test.tsx`: no control with no document open; with the seed document open, clicking `Zoom in` changes the article's `font-size` from `18px` to `20px`.
- [ ] **Step 2: Run** `npx vitest run src/features/reader/ZoomControl.test.tsx src/app/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `ZoomControl`, move the zoom limits into `ui.ts`, update `TuningPanel` to use them, and render the control in `App.tsx`.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Add browser checks** in the `mobile` group: `Zoom in` is visible, inside the 375×667 viewport and above the dock (bottom ≤ 611); one tap changes the article's computed `font-size` to `20px`; the page does not scroll horizontally afterwards; with the generated 5-page PDF open, one tap on `Zoom in` still leaves `documentElement.scrollWidth <= 375`. Read the screenshot. Run `node scripts/e2e/run.mjs mobile pdf`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: floating zoom control over the reading canvas`.

### Task 5: Honest disabled state for Bionic reading and the dyslexia font on PDFs

**Files:**
- Create: `src/features/reader/textStyling.ts`, `src/features/reader/textStyling.test.ts`
- Modify: `src/app/App.tsx`, `src/app/commands.ts`, `src/app/commands.test.ts`, `src/features/shell/TuningPanel.tsx`, `src/features/shell/TuningPanel.test.tsx`, `src/app/App.test.tsx`, `scripts/e2e/run.mjs`

**Interfaces:**
- Produces: `PDF_BIONIC_REASON = 'Bionic reading is not available for PDF pages.'`, `PDF_DYSLEXIC_REASON = 'The dyslexia-friendly font is not available for PDF pages.'`; `textStylingBlocks(doc: { type: DocType } | null): { bionic: string | null; dyslexic: string | null }` (reasons for `type === 'pdf'`, otherwise `null`); `buildCommands` gains optional `blocked?: { bionic?: boolean; dyslexic?: boolean }` and omits those commands; `TuningPanel` gains `dyslexicBlockedReason?: string | null`.
- The reason copy differs from the spec's example ("Switch to Reflow mode for a PDF") because that mode does not exist until phase 5; the constants are the one place to change it then.

- [ ] **Step 1: Write failing tests.** `textStyling.test.ts`: reasons for a `pdf`; `null` for `text`, `psd` and `null` document. `commands.test.ts`: with `blocked.bionic` there is no "Toggle bionic reading" command, and likewise for dyslexic. `TuningPanel.test.tsx`: with `dyslexicBlockedReason` the dyslexia toggle is `disabled`, shows the reason text visibly, and a click does not change `ui.dyslexic`. `App.test.tsx` **(Review Focus 5)**: turn bionic on with a text document open, open a PDF (fake document of type `pdf`): the rail `Bionic reading` button is `disabled` with the reason as its `title`; the status line shows no `Bionic` flag; `Ctrl+B` leaves `useUi.getState().bionic` unchanged; reopening the text document shows bionic still on.
- [ ] **Step 2: Run** `npx vitest run src/features src/app`. Expected: FAIL.
- [ ] **Step 3: Implement** `textStyling.ts`, then use `textStylingBlocks(doc)` in `App.tsx` for the rail item (`disabled` plus `disabledReason`), the `mod+b` handler (do nothing when blocked), the status flag and the commands, and pass the dyslexic reason to `TuningPanel`, which renders it as muted 10px text under the disabled toggle and shows `—` instead of ON/OFF.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Add browser checks** in the `mobile` group: import the generated PDF through the Library sheet; assert the rail `Bionic reading` button is disabled; open the Tuning sheet and assert the dyslexia toggle is disabled and the reason text is visible in the viewport; open the seed text document and assert both are enabled again. Read the screenshot. Expected: PASS.
- [ ] **Step 6: Commit** `feat: disable bionic and dyslexia font on PDF pages, with a visible reason`.

### Task 6: Wrap-up and full verification

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Run the complete verification:** `npm test`, `npm run typecheck`, `npm run build`, and `npm run e2e -- --build`. Expected: all pass (at least 571 + the new unit tests; the 35 desktop checks plus the `mobile` checks), zero CSP violations, no page errors.
- [ ] **Step 2: Look at the phone UI** once more: read the `.e2e-shots/` screenshots for the closed state, each open sheet, the zoom control and the disabled controls on a PDF, and confirm nothing overlaps the dock or runs off the 375px edge.
- [ ] **Step 3: Update `STATUS.md`** in the same shape as earlier phases: a "Mobile pass, phases 1–4" entry under Done (what changed), the new test and check counts, a note that reflow and search (phases 5–6) are not started, and the known follow-ups found during the work.
- [ ] **Step 4: Commit** `docs: update status for mobile pass phases 1-4`, then stop and report before touching phases 5–6.
