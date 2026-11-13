# NightOwl Reader — Mobile-Responsive Pass + PDF Reflow Mode (Design Spec)

Date: 2026-11-13
Status: Draft for review
Source: live user feedback on `nightowl-mauve.vercel.app` from three readers (WhatsApp thread), confirmed against `src/features/shell/{App.tsx,TuningPanel.tsx,ui.ts}`, `src/features/pdf/PdfViewer.tsx`, `src/features/reader/ReaderCanvas.tsx`, and a live desktop/tablet/mobile walkthrough of the deployed build.

## 1. Intent

The app was built and tested entirely at desktop width (STATUS.md's e2e checklist never exercises a narrow viewport). On a phone, real readers hit four concrete problems, all confirmed against source:

1. An invisible hover-to-open strip on the Tuning panel's right edge (`App.tsx`, `onMouseEnter`) has no touch equivalent and no "off" switch, and the panel it opens is a fixed 288px drawer that covers ~77% of a 375px screen.
2. Zoom is a slider buried inside that same panel; nobody will open a settings drawer mid-read just to zoom, and there's no pinch gesture on the PDF canvas, so people fall back to the browser's native page pinch-zoom, which zooms the rail/status line/panel along with the document.
3. Bionic reading and the dyslexia font are wired only to `TextView` (`doc.type === 'text'`); opening them on a PDF does nothing, but the rail buttons don't say so.
4. There's no way to search inside a document's text and jump to the match; the command palette only jumps to a typed page number.

**Success criteria**
- On a phone, opening any panel (Tuning, Library, Audio) never hides more than it shows: the document stays visibly present.
- Nothing pops open from a scroll or swipe gesture; panels open only from an explicit tap.
- Zoom is reachable in at most one tap, without leaving the reading view.
- A PDF offers a genuine reflowed reading mode where Bionic reading, dyslexia font, font size and line spacing all actually apply — not just page-canvas zoom.
- A reader can search a document's text and jump straight to the match.
- None of this regresses the desktop experience (hover-to-open stays on mouse+hover devices; the existing 555 unit tests and e2e suite still pass).

**Non-goals**
- True two-finger pinch-gesture zoom on the PDF canvas (flagged as a real decision about overriding native browser zoom — out of scope for this pass, left as a clean follow-on).
- PDF annotations/highlighting (currently text-file only) — separate decision, not requested with enough detail yet.
- Native iOS/Android app-store builds — the app is already an installable PWA; this pass's responsive work plus a manifest/icon sanity check is what "Android & iOS" means here.
- The community/social reading feature suggested in the WhatsApp thread — unrelated, parked.

**Constraints**
- No new runtime dependency unless genuinely needed (the project currently has zero mobile-UI library; Tailwind + existing patterns should cover sheets/overlays).
- Keep the existing feature-folder structure and one-commit-per-task, tests-first method already used by this codebase.
- `BASE_SCALE`/page-canvas pagination (`PdfViewer.tsx`) must keep working unchanged for the existing canvas-page reading mode; reflow is an added mode, not a replacement.

## 2. Approaches considered

**Panel layout on narrow screens**
- *Narrower side drawer* — smallest diff, but still eats meaningful width below ~420px and doesn't fix the core interaction mismatch (a drawer is a desktop-mouse pattern).
- *Full-screen overlay* — simplest to implement, but loses context (reader can't glance at the document while adjusting a setting).
- *Bottom sheet, full width, capped height* (chosen) — standard mobile pattern, keeps the document visible behind/above it, and the Tuning panel's existing sections (Theme/Light/Type/Pace) stack naturally in a scrollable sheet.

**Zoom control**
- *Floating +/- buttons over the canvas* (chosen for this pass) — small, cheap, always reachable, no gesture-vs-native-zoom conflict to solve.
- *Two-finger pinch* — best feel, but requires a deliberate call on `touch-action`/native zoom interaction and accessibility implications (some readers rely on OS pinch-zoom); scoped out as a follow-on, not bundled here.

**"Reading mode" for PDFs**
- *Just disable the controls for PDFs* — cheapest, honest, but doesn't give readers what they actually asked for.
- *Real reflow mode* (chosen) — extract each page's text (the text layer `PdfViewer.renderTextLayer` already builds per page for selection), concatenate per-page text with page-boundary markers, and render it through a reflow-capable view (built on the same primitives as `TextView`: bionic, dyslexic font, font size, line height). The reader switches between "Pages" (current canvas view) and "Reflow" (new) per document; the toggle lives in the status line next to the page counter. Because reflowed text doesn't paginate 1:1 with original PDF pages, reflow mode tracks its own scroll-offset progress (same pattern `ReaderCanvas` already uses for text docs) rather than reusing `PdfProgress.page`; the existing page/bookmark model for canvas mode is untouched.

**Search**
- Reuses the same per-page text extraction reflow mode needs, so it's built in the same phase: a simple substring search (case-insensitive) across extracted page text, results shown in the command palette (same UI surface already used for page-jump), each result jumping to that page in canvas mode or that offset in reflow mode.

## 3. Phases

1. **Touch-safe panel triggers.** Gate the Tuning hover-open strip behind `matchMedia('(hover: hover) and (pointer: fine)')`; on touch, panels open only via explicit rail taps (already how Library/Audio work today).
2. **Responsive panels.** Below the `sm` (640px) breakpoint, `TuningPanel`, `LibraryPanel` and `AudioPanel` render as a bottom sheet (full width, max ~75vh, internal scroll, swipe-down/backdrop-tap to dismiss) instead of a right-side drawer. Above `sm`, unchanged.
3. **Floating zoom control.** A small +/- (and tap-to-reset) pill overlaid on the reading canvas, wired to the existing `ui.zoom` state; visible for both PDF and text/PSD views wherever zoom applies.
4. **Stopgap control state.** While phase 5 is being built, `Bionic reading` and `Dyslexia-friendly font` rail/tuning controls show `disabled` + a reason ("Switch to Reflow mode for a PDF") when the open document is a PDF in canvas mode — mirrors the existing pattern used for the Read-aloud button when TTS is unsupported.
5. **PDF text extraction + Reflow mode.** Per-page text extraction, the Reflow/Pages toggle, a reflow view built on `TextView`'s primitives, and offset-based progress tracking for reflow.
6. **In-document search.** Palette-integrated search over the extracted text from phase 5, jumping to the match in whichever mode is active.

Phases 1–4 ship together first (small, low-risk, immediately fixes the loudest complaints). Phases 5–6 are the larger piece and ship as their own follow-up once 1–4 are verified, since they share extraction work and are meaningfully bigger in scope.

## 4. What's left to the builder

- Exact Tailwind breakpoint utilities and sheet animation (reuse the existing `motion-slide`/`motion-fade` CSS patterns already in the codebase).
- Where exactly the Reflow/Pages toggle sits in the status line, and its icon.
- Whether extraction runs eagerly on document open or lazily on first Reflow-mode/search use (lean lazy, to not slow down opening large PDFs in canvas mode).
- Test coverage following the existing Vitest + fake patterns (`src/test/fakes.ts`) and an addition to `scripts/e2e` that exercises a mobile viewport, since none currently exists.
