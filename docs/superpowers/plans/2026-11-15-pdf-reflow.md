# PDF Reflow Mode (phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PDF can switch between Pages (the canvas view) and Reflow, a single readable text column where font size, line spacing, Bionic reading and the dyslexia font apply, so small print is readable on a phone.

**Architecture:** pdf.js text items are assembled into lines and paragraphs by a pure module; a lazily run extractor caches the result per document; a `ReflowView` renders each page's text through the existing `TextView` with a "Page N" divider. The Pages/Reflow choice and the reflow position are stored on the document's progress record.

**Spec:** `docs/superpowers/specs/2026-11-13-mobile-responsive-design.md` (phase 5).

## Global Constraints

- Pages stays the default on every screen; the Reflow switch is always visible; the choice is remembered per PDF.
- `PdfViewer` canvas mode is not changed. No new runtime dependency.
- Tasks 1–3 add new files only (plus a method on `PdfHandle`), so they can run in the `feat/pdf-reflow` worktree while a UI refresh is uncommitted elsewhere; tasks 4–8 start after that refresh is merged.
- Scanned (image-only) PDFs have no text: Reflow says so instead of showing an empty page.
- Tests first; one commit per task; explicit `git add` paths; browser checks in the `phone` group (360×800) and desktop.

## Review Focus

1. Reading order: lines and paragraphs come out in order; hyphenated line ends are joined; headers, footers and bare page numbers repeated on most pages are dropped.
2. Extraction never blocks opening a PDF in Pages mode; it runs only on first Reflow use and is cancelled when the document changes.
3. Switching Pages ↔ Reflow keeps the page the reader was on.

---

### Task 1: Text extraction and assembly
**Files:** Create `src/features/pdf/reflowText.ts`, `src/features/pdf/reflowText.test.ts`; Modify `src/features/pdf/pdf.ts` (`getPageText`).
- [ ] Failing node tests over fixture item arrays: lines by `hasEOL`/baseline, spaces only across gaps, paragraphs by vertical gap and empty lines, hyphen joins, repeated header/footer and page-number removal, scanned detection.
- [ ] Implement `assemblePage(items)` and `buildReflow(pages)`; `PdfHandle.getPageText(n)` maps pdf.js items to `{ str, x, y, width, height, hasEOL }`.
- [ ] Commit `feat: assemble readable text from PDF pages`.

### Task 2: Lazy extraction with a per-document cache
**Files:** Create `src/features/pdf/reflowExtract.ts` (+test), `src/features/reader/useReflowText.ts` (+test).
- [ ] Failing tests (pdf module mocked): progress counts pages, the result is cached by document id, a document change cancels, no-text PDFs report `empty`, errors report `error`.
- [ ] Implement; commit `feat: extract PDF text lazily for reflow`.

### Task 3: ReflowView
**Files:** Create `src/features/reader/ReflowView.tsx` (+test).
- [ ] Failing tests: one section per page with a "Page N" separator outside the text, paragraphs rendered through `TextView` (Bionic and dyslexia font apply), `reflowPageAt` returns the page under a given offset.
- [ ] Implement; commit `feat: reflow view for PDF text`.

### Task 4: Mode and persistence
`ProgressRecord` gains optional `pdfMode` and `reflowScrollTop`; `useReadingProgress` saves them; Pages/Reflow control in the status line (44px on phones) and palette commands.

### Task 5: ReaderCanvas integration
Reflow renders inside `reader-scroll` (focus ruler, auto-scroll, progress unchanged); reflow text goes to `onText` for read-aloud; switching keeps the page.

### Task 6: Un-gate styling in Reflow
`textStylingBlocks(doc, mode)` blocks only in Pages; reasons become "Switch to Reflow mode to use …".

### Task 7: Edge states
Scanned PDF → Reflow control disabled with the reason; extraction errors shown in the reader.

### Task 8: Browser checks and wrap-up
`phone` group: switch to Reflow, text fits at 18px with no sideways scroll, Bionic applies, switching back keeps the page; scanned fixture disables Reflow; desktop unchanged. Full verification, STATUS.md.
