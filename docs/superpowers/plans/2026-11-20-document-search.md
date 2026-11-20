# In-Document Search (phase 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Typing words in the command palette finds them inside the open PDF or text document, lists the matches with a snippet and a place, and choosing one jumps to it in whichever view (Pages or Reflow) is showing.

**Architecture:** A pure search module finds case-insensitive literal matches in text. For a PDF the text comes from the same per-page extraction Reflow uses, moved out of its React hook into a shared cache so search and Reflow never extract a document twice. A `useDocumentSearch` hook turns the palette's query into hits; the palette shows them in a `Find` group; the reader's handle gets one `goToMatch` that scrolls to the match and selects it.

**Tech Stack:** React, TypeScript, Tailwind v4, `cmdk` (existing), Vitest + Testing Library, `playwright-core` e2e.

**Spec:** `docs/superpowers/specs/2026-11-13-mobile-responsive-design.md` §2 "Search" and §3 phase 6. Branch `feat/document-search`, from `main`.

## Global Constraints

- "Search should work over the same per-page text extraction Reflow mode already does": no second extraction path; "extraction ... lazily on first Reflow-mode/search use (lean lazy, to not slow down opening large PDFs in canvas mode)": nothing is extracted until a valid query is typed.
- "a simple substring search (case-insensitive) across extracted page text, results shown in the command palette (same UI surface already used for page-jump), each result jumping to that page in canvas mode or that offset in reflow mode."
- No new runtime dependency. Text documents are searched too (their own text); PSDs offer no search.
- A query needs at least 2 characters after trimming (at most 100); runs of spaces in it match any whitespace; regular-expression characters in it are literal.
- At most 20 hits are listed, in document order; matches are counted up to 500 ("500+").
- Palette rows: `Find` group first; hit titles are the snippet (about 40 characters either side, whitespace collapsed, `…` at cut ends) with the place on the right (`p. 12` for a PDF, `62%` for text); status rows ("Preparing search… 3 of 12 pages", "No matches for …", scanned, error) are not selectable.
- Messages: scanned PDF "This PDF has no text to search (it looks scanned).", failure "Could not read this PDF's text to search it."
- Tests first; one commit per task; explicit `git add` paths; the browser group runs against the production build (`npm run e2e -- --build search`) on desktop and a 360×800 phone, screenshots read; STATUS.md updated. Do not merge: the owner reviews the PR.

## Review Focus

1. **Characters that mean something in a regular expression** in the query (`(`, `[`, `\`, `.*`, `+`): matched literally, never an error or "match everything" (Task 1).
2. **A very large document** (a multi-megabyte text, a 500-page PDF): typing must not freeze: debounce, stop listing at 20, cap the count, and cancel extraction when the palette closes (Tasks 1 and 3).
3. **The document changes or closes while the palette is open or a search runs:** results for the old document never show for the new one (Task 3).
4. **A phrase that spans a line, paragraph or page-text boundary, or non-Latin text** (Devanagari, emoji): matches across whitespace; offsets stay valid UTF-16 positions in the text the reader renders (Tasks 1 and 5).
5. **A scanned PDF, a failed extraction, a PSD:** an honest message, never an endless "Preparing" and never a crash (Tasks 3 and 4).

---

### Task 1: Find matches in text (pure)

**Files:**
- Create: `src/features/search/findMatches.ts`, `findMatches.test.ts`, `searchDocument.ts`, `searchDocument.test.ts`
- Modify: `src/features/pdf/reflowText.ts` (export `pageText`), `src/features/reader/ReflowView.tsx` (use it)

**Interfaces — Produces:**
- `findMatches.ts`: `MIN_QUERY_CHARS = 2`, `MAX_QUERY_CHARS = 100`, `MAX_HITS = 20`, `COUNT_CAP = 500`, `SNIPPET_RADIUS = 40`; `normaliseQuery(raw: string): string | null` (trim, collapse spaces; null when shorter than 2 or longer than 100); `findMatches(text: string, query: string, options?: { limit?: number; cap?: number }): { matches: Array<{ offset: number; length: number }>; total: number; capped: boolean }`; `snippetAround(text: string, offset: number, length: number, radius?: number): string`.
- `searchDocument.ts`: `type PageText = { page: number; text: string }`, `type DocumentText = { kind: 'text'; text: string } | { kind: 'pages'; pages: PageText[] }`, `interface SearchHit { page?: number; offset: number; length: number; snippet: string }`, `interface SearchResult { hits: SearchHit[]; total: number; capped: boolean }`, `searchDocument(source: DocumentText, query: string, limit?: number): SearchResult`, `pagesFromReflow(doc: ReflowDoc): PageText[]`.
- `reflowText.ts`: `pageText(paragraphs: string[]): string` (the exact text a reflow page renders: paragraphs joined by a blank line), used by `ReflowView` so search offsets and what is on screen cannot drift apart.

- [ ] **Step 1: Write the failing tests.** `findMatches.test.ts`: case-insensitive (`NIGHT` finds `night`); `normaliseQuery('  a ')` is null, `'  night   owl '` is `night owl`, 101 characters is null; a query of spaces matches any whitespace (`night owl` finds `night\n\nowl`); `(`, `[a`, `a.*b`, `\d` and `c++` are found literally and `a.*b` does not match `aXXb`; matches are in order with `offset` and `length` in the original text; `limit` stops the list while `total` keeps counting to `cap` and `capped` becomes true; Devanagari (`नमस्ते` inside a sentence) and an emoji before the match give offsets where `text.slice(offset, offset + length)` equals the matched text; `snippetAround` adds `…` only at cut ends, collapses whitespace and keeps the match inside. `searchDocument.test.ts`: text source; pages source returns hits in page order with `page` and a per-page offset; stops listing at the limit across pages while counting all; an invalid query gives no hits; `pagesFromReflow` joins a page's paragraphs with `pageText` and keeps page numbers (a page with no paragraphs has empty text).
- [ ] **Step 2: Run** `npx vitest run src/features/search src/features/reader/ReflowView.test.tsx`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules; match with a regular expression built from the escaped query (spaces become `\s+`, flags `giu`) walked with `exec`, so offsets index the original string.
- [ ] **Step 4: Run** the same command plus `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: find text in a document, case-insensitively and literally`.

### Task 2: One extraction for Reflow and search

**Files:**
- Create: `src/features/pdf/reflowCache.ts`, `src/features/pdf/reflowCache.test.ts`
- Modify: `src/features/reader/useReflowText.ts` (use the cache; keep exporting `clearReflowCache`, `REFLOW_READ_ERROR`, `ReflowState`)

**Interfaces — Produces:** in `reflowCache.ts`: `type ReflowState` (moved from `useReflowText.ts`, unchanged), `loadReflowText(docId: string, data: ArrayBuffer, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<ReflowState>` (resolves `ready`, `empty` or `error`; never rejects for a failed read), `peekReflowText(docId: string): ReflowState | null` (a finished result), `clearReflowCache(): void`. Callers asking for a document already being extracted share that one extraction and each gets the progress; the extraction is cancelled only when every caller has aborted; a finished result (text, scanned, or failed) is returned at once afterwards.

- [ ] **Step 1: Write the failing tests** (`extractReflow` mocked): two simultaneous calls for one id run `extractReflow` once and both resolve with the same state; progress reaches both callers; a later call resolves at once from the cache without extracting; aborting one of two callers does not cancel the extraction, aborting both does (the signal given to `extractReflow` is aborted) and nothing is cached; an aborted caller's promise settles quietly; a failing extraction resolves `{ status: 'error', message }` and is cached; `peekReflowText` is null before and the state after; the existing `useReflowText.test.ts` passes unchanged.
- [ ] **Step 2: Run** `npx vitest run src/features/pdf/reflowCache.test.ts src/features/reader`. Expected: FAIL.
- [ ] **Step 3: Implement** `reflowCache.ts` with a map of settled states and a map of in-flight extractions holding their callers; make `useReflowText` call `loadReflowText` and `peekReflowText` instead of owning the cache.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor: share one text extraction between Reflow and search`.

### Task 3: The document search hook

**Files:**
- Create: `src/features/search/useDocumentSearch.ts`, `src/features/search/useDocumentSearch.test.ts`

**Interfaces — Consumes:** Task 1 (`normaliseQuery`, `searchDocument`, `pagesFromReflow`, `SearchHit`), Task 2 (`loadReflowText`, `peekReflowText`).
**Produces:**
```ts
export type SearchStatus = 'idle' | 'preparing' | 'ready' | 'empty' | 'error' | 'unsupported';
export interface DocumentSearch { status: SearchStatus; query: string | null; done: number; total: number; hits: SearchHit[]; totalHits: number; capped: boolean }
export function useDocumentSearch(args: { doc: { id: string; type: DocType; blob: Blob } | null; text: string; query: string; active: boolean }): DocumentSearch
```
`text` is the open text document's decoded text (ignored for PDFs); `active` is "the palette is open".

- [ ] **Step 1: Write the failing tests** (cache mocked, fake timers): `idle` while inactive, with no document, or for a query under 2 characters, and nothing extracted; a PSD is `unsupported`; a text document searches `text` after a 150 ms pause and not before, and a newer query replaces the older; a PDF reads the blob once, starts extraction only on the first valid query, shows `preparing` with `done` / `total` from progress, then `ready` with hits and the page of each; a scanned PDF is `empty`, a failed one `error`; closing the palette cancels this hook's interest in the extraction; switching to another document (or closing it) drops the old hits at once and never shows them for the new one even if the old extraction finishes late; results stay stable (same array) between renders for the same query; a 2 MB text and a query of 2 characters returns 20 hits quickly with `capped` true.
- [ ] **Step 2: Run** `npx vitest run src/features/search/useDocumentSearch.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook: debounce the query, read `doc.blob.arrayBuffer()` once per document, call `loadReflowText` with an `AbortController` tied to the effect, compute hits with `searchDocument` from `pagesFromReflow` (memoised per document state).
- [ ] **Step 4: Run** the test and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: search the open document with the shared text extraction`.

### Task 4: Find results in the command palette

**Files:**
- Create: `src/features/search/searchCommands.ts`, `src/features/search/searchCommands.test.ts`
- Modify: `src/app/commands.ts` (`Command` gains `hint?: string`, `fixed?: boolean`, `disabled?: boolean`; `CommandGroup` gains `'Find'`), `src/features/shell/CommandPalette.tsx`, `src/features/shell/CommandPalette.test.tsx`

**Interfaces — Consumes:** Task 3 (`DocumentSearch`). **Produces:**
```ts
export type MatchTarget =
  | { kind: 'page'; page: number }
  | { kind: 'reflow'; page: number; offset: number; length: number }
  | { kind: 'text'; offset: number; length: number };
export function searchCommands(search: DocumentSearch, view: { type: DocType; mode: PdfMode | null; textLength: number }, go: (target: MatchTarget) => void): Command[]
```
`CommandPalette` gains `onQueryChange?(query: string): void` (the typed text; `''` when it closes) and `placeholder?: string`.

- [ ] **Step 1: Write the failing tests.** `searchCommands.test.ts`: hits become `Find` commands in order with the snippet as `title`, `hint` `p. 12` (PDF) or `62%` (text), `fixed: true`; choosing one calls `go` with `{ kind: 'page' }` for a PDF in Pages, `{ kind: 'reflow' }` for a PDF in Reflow (page, offset, length) and `{ kind: 'text' }` for a text file; `preparing` is one disabled row "Preparing search… 3 of 12 pages" (no count while the total is 0); `ready` with no hits is "No matches for "q" in this document."; `capped` adds a disabled "Showing the first 20 of 500+ matches." row (and "of 37" when not capped); `empty` and `error` use the Global Constraints messages; `idle` and `unsupported` give nothing. `CommandPalette.test.tsx`: `Find` is listed before every other group; a `fixed` row stays visible and in the given order whatever the query (typing a word not in its title still shows it), while ordinary commands still filter; a disabled row cannot be chosen and does not close the palette; choosing a hit closes the palette and runs it; the hint shows on the right; `onQueryChange` receives each typed value and `''` after it closes; "No matching command." does not show while a status row is present.
- [ ] **Step 2: Run** `npx vitest run src/features/search src/features/shell/CommandPalette.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `searchCommands` and the palette changes; rows with `fixed` use cmdk's `forceMount`, `disabled` rows use its `disabled`, hits render `hint` where the hotkey goes.
- [ ] **Step 4: Run** the tests, `npm test` (the existing palette tests must pass unchanged) and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: show document matches in the command palette`.

### Task 5: Jump to a match

**Files:**
- Modify: `src/features/reader/textPosition.ts` (+ test), `src/features/reader/ReaderCanvas.tsx` (+ test)

**Interfaces — Consumes:** `MatchTarget` (Task 4), `rectAtOffset`, `rangeAtOffset`. **Produces:** `selectText(root: HTMLElement, offset: number, length: number): boolean` (selects those characters in the page's selection; false when the range cannot be made); `ReaderHandle.goToMatch(target: MatchTarget): void`.

- [ ] **Step 1: Write the failing tests.** `textPosition.test.ts`: `selectText` selects exactly the characters across Bionic and highlight markup (`window.getSelection().toString()` equals the slice), replaces an earlier selection, and is false for an offset past the end. `ReaderCanvas.test.tsx`: `{ kind: 'page' }` calls the PDF viewer's `goToPage`; `{ kind: 'text' }` scrolls the character under the status line (as `goToOffset`) and selects the match; `{ kind: 'reflow' }` finds the page's section, scrolls the match to just under the status line and selects it, and falls back to `goToPage` semantics when Reflow is not showing; an out-of-range target does nothing.
- [ ] **Step 2: Run** `npx vitest run src/features/reader`. Expected: FAIL.
- [ ] **Step 3: Implement** `selectText` and `goToMatch` (select after scrolling; never throw).
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: jump to and select a search match in the reader`.

### Task 6: Wire search into the app

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/App.search.test.tsx`

**Interfaces — Consumes:** Tasks 3–5.

- [ ] **Step 1: Write the failing tests** (the extraction cache mocked; same fakes as `App.rooms.test.tsx`): with a text document open, typing 2 or more characters in the palette lists `Find` rows with the right hints; choosing one closes the palette and calls the reader's `goToMatch` with a text target; typing one character lists none; the placeholder mentions finding words when a PDF or text file is open and not for a PSD or no document; with a PDF in Pages a hit jumps with a page target and in Reflow with a reflow target; with nothing open or a PSD there are no `Find` rows; a scanned PDF shows its message; reopening the palette starts clean and extraction is not started by merely opening it.
- [ ] **Step 2: Run** `npx vitest run src/app`. Expected: FAIL.
- [ ] **Step 3: Implement** in `App.tsx`: hold the palette query from `onQueryChange`, call `useDocumentSearch({ doc, text: docText, query, active: ui.paletteOpen })`, add `searchCommands(...)` to the palette's `dynamic` commands next to `pageCommands`, send `goToMatch`, and set the placeholder.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck` and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: search the open document from the command palette`.

### Task 7: Browser checks and wrap-up

**Files:**
- Modify: `scripts/e2e/run.mjs` (a `search` group), `STATUS.md`

- [ ] **Step 1: Add the `search` group** (uses the real printed PDF from `printReportPdf`, a long generated text file and a scanned PDF). Desktop: open the real PDF in Pages, Ctrl+K, type `recognition`: `Find` rows appear with `p. N` hints, in page order, capped at 20 with a count row; choose one on a later page: the palette closes and that page is in view; switch to Reflow, search again, choose a hit: the reader scrolls and the matched words are selected (`getSelection().toString()` equals the query, case aside) and sit near the top; a query with no match shows the "No matches" row; the long text file: a unique `Paragraph 250` jumps near it with the words selected and the percentage hint; a scanned PDF shows the scanned message. Phone 360×800: the palette and its rows fit inside the screen and a hit on a phone jumps and selects. Read the screenshots.
- [ ] **Step 2: Run** `npm run build` then `npm run e2e -- --build search`. Expected: PASS. If a check fails, fix the product or the check and say which.
- [ ] **Step 3: Update STATUS.md** (a "Document search" section with what it does and its limits: Pages mode jumps to the page, not to the word; scanned PDFs are not searchable; matches are literal, case-insensitive) and run the complete verification: `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e -- --build` (zero CSP violations).
- [ ] **Step 4: Commit** `test: browser checks for document search, and update status`. Push `feat/document-search` and stop; the owner reviews the pull request.
