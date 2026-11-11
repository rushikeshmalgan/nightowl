# Nocturne Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the single-file Nocturne Reader prototype as an offline-first Vite + React + TypeScript app with a redesigned UI, real PDF/PSD parsing, an IndexedDB library, a music dock (Spotify / YouTube / uploaded tracks) and live Supabase presence, all on free tiers.

**Architecture:** A client-only SPA. Hooks and `src/lib/**` own every side effect (Dexie, Supabase, `AudioContext`, player APIs); components render and dispatch. Music sources sit behind one `MusicAdapter` interface so the dock never knows which source it drives. Presence, streamed audio and embeds degrade to local/offline behaviour.

**Tech Stack:** Vite, React, TypeScript (strict), Tailwind v4, Zustand, Dexie, `pdfjs-dist`, `ag-psd`, `@supabase/supabase-js`, `vite-plugin-pwa`, `cmdk`, `@fontsource` fonts, Vitest + jsdom + `fake-indexeddb` + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-nocturne-reader-design.md`

## Global Constraints

- Free tiers only. No ads, trackers or analytics. No always-on server. Supabase free plan: 200 concurrent connections, 20 presence messages/s, 5 presence calls per client per 30 s.
- Only hooks and `src/lib/**` touch Dexie, Supabase or `AudioContext`. Components render and dispatch.
- Env vars, all optional: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUDIO_CDN_BASE`.
- Layout: 48px left rail (`w-12`), 56px music dock (`h-14`), reading canvas ≥ 80% of viewport width, no top header, slim status line.
- Night palette: canvas `#090A0F`, surface `#12141C`, text `#E2E8F0`, muted `#64748B`, accent `#F59E0B`. Themes: `night`, `sepia`, `oled`, `crimson` (no `warmSlate`).
- Style: 1px `border-white/5` hairlines, 4–6px radii, no drop shadows, glows or gradients, 4/8px grid. Transitions `200ms cubic-bezier(0.16, 1, 0.3, 1)` on specific properties, never `transition: all`; honour `prefers-reduced-motion`.
- Warmth: 2200–6500K, default 5000K; overlay opacity = `(6500 − K) / 4300 × 0.35`, multiply blend; Crimson uses a red overlay.
- Idle fade: all chrome to `opacity: 0` after 3 s without pointer or key input; scrolling and auto-scroll do not wake it; the YouTube tile is exempt.
- Hotkeys: `Cmd/Ctrl+K` palette, `+B` bionic, `+M` play/pause active source, `\` tuning panel, plus arrows, `F`, `S`, `A`. Handlers never fire inside text inputs and call `preventDefault` only for combos they own.
- Document types: `.pdf .psd .txt .md .json .csv`. Music upload: `.mp3 .aac`.
- LRU limit 500 MB applies to documents only; uploaded tracks are never auto-evicted. Request `navigator.storage.persist()`.
- PSD size warning above 100 MB. Spotify embed ready timeout 8 s. Presence `track()` calls ≥ 6 s apart. Sleep timer 15/30/60 min with a 5 s fade.
- YouTube: `youtube-nocookie.com` host, `controls: 0`, visible tile ≥ 200×200 while active. Spotify: no volume control, 30-second previews without a Spotify login.
- Language tags `EN`, `HI`, `INST`, `NATURE`. Categories: English Focus, Hindi / Bollywood Chill, Instrumental & Classical, Nature & White Noise.
- TypeScript only; no `any` without a one-line comment. Work on branch `feat/nocturne-rebuild`. Data-layer tests start with `// @vitest-environment node` (Node `Blob`/`File` + `fake-indexeddb`); component and hook tests use jsdom. The prototype `nocturne_reader_night_document_platform.tsx` stays untouched until Task 32.

## Review Focus

1. **Hindi text files** (Devanagari, UTF-8 with BOM): decode with no leading BOM or mojibake, and bionic bolding never splits a character cluster. → Task 6.
2. **Password-protected or corrupt PDF/PSD:** a plain inline reason, nothing saved. → Task 19.
3. **One imported document larger than 500 MB:** it is kept, nothing loops trying to evict it, and the UI shows an over-limit notice. → Tasks 9, 12.
4. **Pasted music links:** `youtu.be`, `music.youtube.com` and Spotify `intl-xx` URLs parse; `javascript:`, `data:`, look-alike hosts and plain-`http` streams are rejected. → Task 24.
5. **Browser blocks audio until a gesture** (`resume()` rejects or the context stays suspended): the UI shows paused with a message, never "playing". → Task 21.

---

## Phase 1 — Scaffold and design system

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `vitest.setup.ts`, `.gitignore`, `.env.example`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: npm scripts `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`); Vitest default env jsdom with globals and jest-dom; `export default function App()`.

- [ ] **Step 1: Branch and install.** Run `git switch -c feat/nocturne-rebuild`. Write the config files, then install runtime deps `react react-dom zustand dexie pdfjs-dist ag-psd @supabase/supabase-js cmdk lucide-react @fontsource-variable/geist @fontsource-variable/geist-mono @fontsource-variable/newsreader @fontsource/opendyslexic` and dev deps `vite @vitejs/plugin-react typescript tailwindcss @tailwindcss/vite vite-plugin-pwa vitest jsdom fake-indexeddb @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/react @types/react-dom`. Check each font name with `npm view <name> version`; if one does not exist use the `@fontsource/<name>` equivalent. `.env.example` lists the three env vars, empty, with a comment each.
- [ ] **Step 2: Write the failing test** `src/App.test.tsx`: `render(<App />); expect(screen.getByRole('application', { name: 'Nocturne Reader' })).toBeInTheDocument()`. Run `npx vitest run src/App.test.tsx`. Expected: FAIL (`App` missing).
- [ ] **Step 3: Implement** `App` rendering `<div role="application" aria-label="Nocturne Reader">`; `main.tsx` mounts it; `index.css` has `@import "tailwindcss";` and imports the four font packages; `vitest.setup.ts` imports `@testing-library/jest-dom/vitest` and polyfills `ResizeObserver` and `Element.prototype.scrollIntoView` (needed by `cmdk`).
- [ ] **Step 4: Verify.** `npm test`, `npm run typecheck` and `npm run build` all pass.
- [ ] **Step 5: Commit** `git add -A ':!gemini-code-*'` (this also adds the spec and plan under `docs/`; the two `gemini-code-*.txt` prompt files stay untracked) then `git commit -m "chore: scaffold Vite React TS app, add design spec and plan"`.

### Task 2: Types, tokens, warmth maths, UI store

**Files:**
- Create: `src/types.ts`, `src/design/tokens.css`, `src/lib/warmth.ts`, `src/store/ui.ts`
- Modify: `src/index.css` (import `tokens.css`)
- Test: `src/lib/warmth.test.ts`, `src/store/ui.test.ts`

**Interfaces:**
- Produces in `types.ts`: `DocType = 'pdf'|'psd'|'text'`; `ThemeId = 'night'|'sepia'|'oled'|'crimson'`; `LanguageTag = 'EN'|'HI'|'INST'|'NATURE'`; `DocRecord {id,name,type,size,blob,addedAt,lastOpenedAt}`; `DocMeta = Omit<DocRecord,'blob'>`; `ThumbnailRecord {docId,page,blob}`; `ProgressRecord {docId,page,scrollTop}`; `BookmarkRecord {id,docId,page,label,createdAt}`; `HighlightRecord {id,docId,start,end,note,createdAt}`; `TrackRecord {id,title,artist,language: LanguageTag|null,duration,blob?,url?,addedAt}`; `PrefRecord {key,value}`.
- Produces in `warmth.ts`: `KELVIN_MIN=2200`, `KELVIN_MAX=6500`, `KELVIN_DEFAULT=5000`, `kelvinToOverlayOpacity(k:number):number` (clamped), `overlayColor(theme:ThemeId):string` (`'#ff0000'` for crimson, else `'#ff9300'`).
- Produces in `ui.ts`: `UiSettings {theme,warmthK,brightness,contrast,fontSize,lineHeight,scrollSpeed,speechRate,zoom,bionic,focusRuler,dyslexic,nightPages,autoScroll}`; `DEFAULT_SETTINGS` (night, 5000, 90, 105, 18, 1.8, 1, 1, 100, all booleans false); `UiState` (= `UiSettings` plus booleans `paletteOpen, tuningOpen, libraryOpen, audioOpen` and actions `set(key,value)`, `toggle(key)` for any boolean key, `reset()`); `useUi` Zustand store of `UiState`; theme changes write `document.documentElement.dataset.theme`.

- [ ] **Step 1: Write failing tests.** `warmth.test.ts`: `kelvinToOverlayOpacity(6500)===0`; `(2200)===0.35`; `(5000)` `toBeCloseTo(0.1221, 3)`; `(1000)===0.35` and `(9000)===0` (clamped); `overlayColor('crimson')==='#ff0000'`. `ui.test.ts`: defaults equal `DEFAULT_SETTINGS`; `set('theme','sepia')` sets `document.documentElement.dataset.theme==='sepia'`; `toggle('bionic')` flips; `reset()` restores defaults.
- [ ] **Step 2: Run** `npx vitest run src/lib src/store`. Expected: FAIL.
- [ ] **Step 3: Implement** the modules. `tokens.css` defines CSS variables per `[data-theme]` (Night exact hexes above; Sepia `#1b1713/#26211c/#d6c7b2/#e5a95d`; OLED `#000000/#0A0A0A/#A0A0A0/#F59E0B`; Crimson `#120505/#1c0a0a/#f87171/#ef4444`, as canvas/surface/text/accent) and a Tailwind v4 `@theme` block mapping them to `--color-canvas`, `--color-surface`, `--color-ink`, `--color-muted`, `--color-accent`, plus `--ease-spring: cubic-bezier(0.16, 1, 0.3, 1)` and font families (Geist Variable, Geist Mono Variable, Newsreader Variable).
- [ ] **Step 4: Run** the same command. Expected: PASS; `npm run typecheck` clean.
- [ ] **Step 5: Commit** `feat: design tokens, warmth maths, UI store`.

### Task 3: Scrubber component

**Files:**
- Create: `src/components/Scrubber.tsx`
- Test: `src/components/Scrubber.test.tsx`

**Interfaces:**
- Produces: `Scrubber(props: { label: string; value: number; min: number; max: number; step: number; format?: (v:number)=>string; onChange:(v:number)=>void; disabled?: boolean; title?: string })`.

- [ ] **Step 1: Write failing tests** (user-event): the element `role="slider"` has `aria-label`, `aria-valuenow/min/max`; `ArrowRight`/`ArrowUp` call `onChange(value+step)`, `ArrowLeft`/`ArrowDown` `value−step`; `Home`→`min`, `End`→`max`; `PageUp` adds 10 steps clamped to `max`; results are rounded to the step's decimals (`1.8 + 0.1` → `1.9`); the readout text equals `format(value)` (e.g. `5000K`); pointerdown at 50% of the track (mock `getBoundingClientRect` width 200) calls `onChange` with the midpoint snapped to `step`; when `disabled`, keys and pointer do nothing and `aria-disabled="true"`.
- [ ] **Step 2: Run** `npx vitest run src/components/Scrubber.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `Scrubber` with pointer capture drag and tabular-numeric (`font-mono`) readout; no native range input.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: accessible Scrubber control`.

### Task 4: useIdleFade

**Files:**
- Create: `src/hooks/useIdleFade.ts`
- Test: `src/hooks/useIdleFade.test.ts`

**Interfaces:**
- Produces: `useIdleFade(opts?: { delayMs?: number; enabled?: boolean }): { idle: boolean }` (default `delayMs` 3000, `enabled` true).

- [ ] **Step 1: Write failing tests** (fake timers, `renderHook`): `idle` is `false` initially; `true` after `advanceTimersByTime(3000)`; a `pointermove` on `window` resets it to `false` and restarts the timer; `keydown` does the same; a `scroll` and a `wheel` event do not wake it; `enabled:false` keeps `idle` `false`; listeners are removed on unmount (`removeEventListener` spy).
- [ ] **Step 2: Run** `npx vitest run src/hooks/useIdleFade.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with window listeners for `pointermove`, `pointerdown`, `keydown`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: idle fade hook`.

### Task 5: Hotkeys, command registry, command palette

**Files:**
- Create: `src/hooks/useHotkeys.ts`, `src/lib/commands.ts`, `src/components/CommandPalette.tsx`
- Test: `src/hooks/useHotkeys.test.ts`, `src/components/CommandPalette.test.tsx`

**Interfaces:**
- Produces: `matchHotkey(e: KeyboardEvent, combo: string): boolean` (`'mod+k'` where `mod` = Ctrl or Meta; a bare key such as `'f'` only matches with no modifier); `HotkeyMap = Record<string, () => void>`; `useHotkeys(map: HotkeyMap): void`; `Command {id, title, group: 'Document'|'View'|'Audio'|'Music'|'Storage', hotkey?, keywords?, run(): void}`; `CommandPalette(props: { open: boolean; onOpenChange:(o:boolean)=>void; commands: Command[]; dynamic?: (query: string) => Command[] })` (`dynamic` results are appended to the list for the current query).

- [ ] **Step 1: Write failing tests.** `useHotkeys`: `matchHotkey` accepts Ctrl+K and Meta+K for `'mod+k'`, rejects plain `k`, rejects Ctrl+F for `'f'`; the hook calls the handler and `preventDefault` for `mod+b`; does nothing when `event.target` is an `input`, `textarea` or `contenteditable`; does not `preventDefault` for unmapped keys. `CommandPalette`: when open it shows a dialog; typing `bion` leaves "Toggle bionic reading" visible and hides "Switch theme"; `Enter` calls that command's `run` and `onOpenChange(false)`; `Escape` calls `onOpenChange(false)`; with `dynamic: q => /^\d+$/.test(q) ? [{id:'p', title:`Go to page ${q}`, group:'Document', run}] : []`, typing `12` shows "Go to page 12".
- [ ] **Step 2: Run** `npx vitest run src/hooks/useHotkeys.test.ts src/components/CommandPalette.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** with `cmdk`; palette styled with section 6 tokens (hairline border, no shadow).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: hotkeys and command palette`.

### Task 6: Bionic text, UTF-8 decoding, TextView

**Files:**
- Create: `src/lib/bionic.ts`, `src/lib/text.ts`, `src/data/seeds.ts`, `src/components/TextView.tsx`
- Test: `src/lib/bionic.test.ts`, `src/lib/text.test.ts` (`// @vitest-environment node`), `src/components/TextView.test.tsx`

**Interfaces:**
- Produces: `bionicSplit(word: string): { head: string; tail: string }` (head = `ceil(graphemes/2)` grapheme clusters via `Intl.Segmenter`); `readText(blob: Blob): Promise<string>` (UTF-8, strips a leading U+FEFF); `SEED_DOCS: Array<{ name: string; text: string }>` — `Sleep & Night Ergonomics.md` and `Nocturne Engine Specs.txt`, text copied from the prototype's `samples[0]` and `samples[2]`; `TextView(props: { text: string; mono: boolean; bionic: boolean; dyslexic: boolean; fontSize: number; lineHeight: number })`.

- [ ] **Step 1: Write failing tests (Review Focus 1).** `bionicSplit('hello')` → `{head:'hel', tail:'lo'}`; `('a')` → `{head:'a', tail:''}`; for `'नमस्ते'` `head + tail === word` and the grapheme count of `head` equals `ceil(n/2)`. `readText` of UTF-8 bytes for `'नमस्ते दुनिया'` returns that exact string; bytes prefixed `EF BB BF` return no leading `'﻿'`. `TextView` with `bionic` renders one `<strong>` per word whose text is the head; without it renders no `<strong>`; applies inline `font-size` and `line-height`; `mono` switches the `font-mono` class, otherwise the serif class.
- [ ] **Step 2: Run** `npx vitest run src/lib/bionic.test.ts src/lib/text.test.ts src/components/TextView.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Words are split on whitespace while preserving it; `dyslexic` sets the OpenDyslexic family.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: text view with grapheme-safe bionic reading`.

### Task 7: Reader behaviours (auto-scroll, TTS, focus ruler)

**Files:**
- Create: `src/hooks/useAutoScroll.ts`, `src/hooks/useTts.ts`, `src/components/FocusRuler.tsx`
- Test: `src/hooks/useAutoScroll.test.ts`, `src/hooks/useTts.test.ts`, `src/components/FocusRuler.test.tsx`

**Interfaces:**
- Produces: `useAutoScroll(ref: RefObject<HTMLElement>, enabled: boolean, speed: number): void` (adds `2 * speed` px to `scrollTop` every 50 ms); `useTts(text: string, rate: number): { supported: boolean; speaking: boolean; toggle(): void }`; `FocusRuler(props: { y: number })`.

- [ ] **Step 1: Write failing tests.** `useAutoScroll` (fake timers): with `speed 1.5` after 200 ms `scrollTop` is `12`; disabled does nothing; clearing on unmount. `useTts`: with `window.speechSynthesis` undefined `supported` is `false` and `toggle()` neither throws nor calls `alert`; with a fake `speechSynthesis`, `toggle()` calls `speak` with an utterance whose `rate` equals the argument and sets `speaking` true, a second `toggle()` calls `cancel`; utterance `onend` resets `speaking`. `FocusRuler` renders a band of 60px height centred on `y` (inline `top: y-30`) with `pointer-events: none`.
- [ ] **Step 2: Run** `npx vitest run src/hooks/useAutoScroll.test.ts src/hooks/useTts.test.ts src/components/FocusRuler.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the three modules.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: auto-scroll, TTS and focus ruler`.

### Task 8: App shell

**Files:**
- Create: `src/components/Rail.tsx`, `StatusLine.tsx`, `TuningPanel.tsx`, `Chrome.tsx`, `WarmthOverlay.tsx`, `ReaderCanvas.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `useUi`, `kelvinToOverlayOpacity`, `overlayColor`, `useIdleFade`, `useHotkeys`, `CommandPalette`, `buildCommands`, `Scrubber`, `TextView`, `useAutoScroll`, `useTts`, `FocusRuler`, `SEED_DOCS`.
- Produces: `Chrome(props: { idle: boolean; children })` (inline `opacity` 0/1, `pointer-events` none/auto, `data-testid="chrome"`); `buildCommands(deps: { ui: UiState; … }): Command[]` in `src/lib/commands.ts`; `ReaderCanvas(props: { doc: { name: string; text: string } | null })` (text documents only in this task).

- [ ] **Step 1: Write failing tests** in `App.test.tsx`: the `navigation` named "Tools" has class `w-12`; `getByTestId('warmth-overlay')` `opacity` ≈ `0.1221`; `Ctrl+K` opens the palette dialog; `\` sets `data-open="true"` on the `complementary` named "Tuning"; with fake timers 3000 ms makes `getByTestId('chrome')` opacity `'0'`, and a `pointermove` restores `'1'`; the first seed document's title appears in the status line.
- [ ] **Step 2: Run** `npx vitest run src/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the shell.** The rail holds icon buttons with hotkey hints (Library, Tuning, Audio, Palette, Bionic). `TuningPanel` has a theme picker and Scrubbers: Warmth 2200–6500 step 100 `K`; Brightness 30–120 `%`; Contrast 70–150 `%`; Font size 12–32 `px`; Line spacing 1.2–2.5 step 0.1 `x`; Scroll speed 0.25–3 step 0.05 `x`; Speech rate 0.5–2 step 0.05 `x`; Zoom 60–180 step 10 `%`; plus dyslexic and reset. Panel slides via `transform` on right-edge hover or `\`. All hotkeys from Global Constraints are wired; palette commands cover theme, bionic, ruler, TTS, auto-scroll, tuning, library, audio.
- [ ] **Step 4: Run** the full suite `npm test`, `npm run typecheck`, `npm run build`. Expected: PASS. Then run `npm run dev` and confirm in a browser the rail, status line and 3-second fade work.
- [ ] **Step 5: Commit** `feat: Nocturne app shell with redesigned UI`.

---

## Phase 2 — Local cache and PWA

### Task 9: Database, preferences, LRU planner

**Files:**
- Create: `src/lib/db.ts`, `src/lib/prefs.ts`, `src/lib/lru.ts`
- Test: `src/lib/db.test.ts`, `src/lib/lru.test.ts` (both `// @vitest-environment node`, `import 'fake-indexeddb/auto'`)

**Interfaces:**
- Produces: `class NocturneDB extends Dexie` with tables `documents` (key `id`, index `lastOpenedAt`), `thumbnails` (key `[docId+page]`), `progress` (key `docId`), `bookmarks` (`id`, index `docId`), `highlights` (`id`, index `docId`), `tracks` (`id`), `prefs` (key `key`); `createDb(name: string): NocturneDB`; `db = createDb('nocturne')`; `getPref<T>(key: string, fallback: T): Promise<T>`; `setPref(key: string, value: unknown): Promise<void>`; `LIMIT_BYTES = 500 * 1024 * 1024`; `planEviction(docs: Array<{id:string; size:number; lastOpenedAt:number}>, protectedId: string|null, limitBytes: number): { evictIds: string[]; overLimit: boolean }`.

- [ ] **Step 1: Write failing tests.** `db`: all seven tables exist; a stored `Blob` round-trips with the same `size`. `prefs`: `setPref('a',1)` then `getPref('a',0)` is `1`; missing key returns the fallback. `lru`: with docs 3×200 B and limit 500 B the oldest `lastOpenedAt` id is evicted first and nothing else; `[]` when under the limit; `protectedId` is never in `evictIds`; **(Review Focus 3)** one protected doc of 600 B with limit 500 B returns `{ evictIds: [], overLimit: true }`; evicting everything evictable but still over limit returns `overLimit: true`.
- [ ] **Step 2: Run** `npx vitest run src/lib/db.test.ts src/lib/lru.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `planEviction` sorts non-protected docs by `lastOpenedAt` ascending and evicts until the total is ≤ `limitBytes`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: Dexie schema, prefs and LRU planner`.

### Task 10: Library operations

**Files:**
- Create: `src/lib/fileTypes.ts`, `src/lib/library.ts`
- Test: `src/lib/fileTypes.test.ts`, `src/lib/library.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Consumes: `NocturneDB`, `planEviction`, `LIMIT_BYTES`, `getPref`/`setPref`, `SEED_DOCS`.
- Produces: `detectDocType(name: string): DocType|null` (case-insensitive); `ACCEPT_ATTR = '.pdf,.psd,.txt,.md,.json,.csv'`; `isAudioFile(name: string): boolean` (`.mp3`, `.aac`); in `library.ts`: `importDocument(db, file: File, opts?: { thumbnail?: Blob; limitBytes?: number }): Promise<{ok:true; doc: DocMeta; overLimit: boolean} | {ok:false; error: string}>`; `listDocuments(db): Promise<DocMeta[]>` (most recently opened first); `openDocument(db, id): Promise<DocRecord|null>` (updates `lastOpenedAt`); `deleteDocument(db, id): Promise<void>` (also removes thumbnails, progress, bookmarks, highlights); `clearAll(db, opts: {includeTracks: boolean}): Promise<void>` (every table except `prefs`); `Usage {documentBytes:number; trackBytes:number; usedBytes:number|null; quotaBytes:number|null}`; `getUsage(db, estimate?): Promise<Usage>`; `requestPersistence(): Promise<boolean>`; `seedIfEmpty(db): Promise<void>` (inserts `SEED_DOCS` as text documents once; a `seeded` pref stops re-seeding after the user deletes them).

- [ ] **Step 1: Write failing tests.** `detectDocType('A.PDF')==='pdf'`, `('x.md')==='text'`, `('x.docx')===null`; `isAudioFile('a.MP3')`. `importDocument`: rejects `x.docx` with error `'Unsupported file type. Use .pdf, .psd, .txt, .md, .json or .csv.'`; rejects a 0-byte file with `'File is empty.'`; stores a valid file and returns its `DocMeta`; with `limitBytes` 500 and three older 200-byte docs, importing a 200-byte doc evicts the oldest and never the new one; a 600-byte import with limit 500 is kept and returns `overLimit: true`; when `db.documents.add` throws `QuotaExceededError` once it evicts and retries once, and when it throws twice returns `{ok:false, error:'Storage is full. Clear some documents and try again.'}`. `openDocument` returns `null` for a missing id and bumps `lastOpenedAt` otherwise. `deleteDocument` removes related rows. `clearAll({includeTracks:false})` keeps `tracks` and `prefs`; `true` removes tracks. `seedIfEmpty` seeds twice-called once, and does not re-seed after deleting the seeds. `getUsage` sums blob sizes by table. `requestPersistence()` resolves `false` when `navigator.storage` is undefined.
- [ ] **Step 2: Run** `npx vitest run src/lib/fileTypes.test.ts src/lib/library.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** each function; IDs from `crypto.randomUUID()`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: library import, eviction, usage`.

### Task 11: Progress, bookmarks

**Files:**
- Create: `src/lib/progress.ts`
- Test: `src/lib/progress.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Produces: `saveProgress(db, p: ProgressRecord): Promise<void>`; `getProgress(db, docId): Promise<ProgressRecord|null>`; `addBookmark(db, b: {docId; page; label}): Promise<BookmarkRecord>`; `listBookmarks(db, docId?: string): Promise<BookmarkRecord[]>` (newest first); `deleteBookmark(db, id): Promise<void>`.

- [ ] **Step 1: Write failing tests:** `saveProgress` twice keeps one row with the latest values; `getProgress` of an unknown doc is `null`; `addBookmark` returns a record with an id and `createdAt`; `listBookmarks(db, 'a')` returns only doc `a`'s bookmarks, newest first; `deleteBookmark` removes it.
- [ ] **Step 2: Run** `npx vitest run src/lib/progress.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the five functions.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: reading progress and bookmarks`.

### Task 12: Library UI and persistence wiring

**Files:**
- Create: `src/lib/format.ts`, `src/hooks/useLocalCache.ts`, `src/hooks/usePrefsSync.ts`, `src/components/LibraryPanel.tsx`, `src/components/StoragePanel.tsx`, `src/components/DropOverlay.tsx`
- Modify: `src/App.tsx`, `src/components/ReaderCanvas.tsx`
- Test: `src/lib/format.test.ts`, `src/hooks/useLocalCache.test.ts`, `src/hooks/usePrefsSync.test.ts`, `src/components/LibraryPanel.test.tsx`, `src/components/ReaderCanvas.test.tsx` (new)

**Interfaces:**
- Consumes: Task 9–11 modules (mocked with `vi.mock` in jsdom tests, because jsdom `Blob` and `fake-indexeddb` do not mix).
- Produces: `formatBytes(n: number): string`; `useLocalCache(): { documents: DocMeta[]; usage: Usage; overLimit: boolean; importFile(file: File): Promise<{ok:true; doc: DocMeta}|{ok:false; error:string}>; open(id: string): Promise<DocRecord|null>; remove(id: string): Promise<void>; clearAll(includeTracks: boolean): Promise<void> }`; `usePrefsSync(): void` (hydrates `theme, warmthK, brightness, contrast, fontSize, lineHeight` from prefs on mount, writes changes back); `LibraryPanel`, `StoragePanel`, `DropOverlay`; `ReaderCanvas` now takes `doc: DocRecord | null` and decodes text documents with `readText`.

- [ ] **Step 1: Write failing tests.** `formatBytes(0)==='0 B'`, `(1536)==='1.5 KB'`, `(5*1024*1024)==='5.0 MB'`. `useLocalCache`: after a successful `importFile` the `documents` list refreshes; a failed import returns the error and adds nothing; `overLimit` becomes true when the library reports it. `usePrefsSync`: stored `theme: 'sepia'` hydrates the store; changing `warmthK` calls `setPref('warmthK', …)`. `LibraryPanel`: lists documents with sizes, delete calls `remove`; **(Review Focus 3)** when `overLimit` shows `role="status"` text `Over the 500 MB limit`; opening an id whose `open` resolves `null` shows `This document is no longer in the library.`; the clear-all button asks for confirmation before calling `clearAll(true)`. `ReaderCanvas` renders the decoded text of a text document (`readText` mocked).
- [ ] **Step 2: Run** `npx vitest run src/lib/format.test.ts src/hooks src/components/LibraryPanel.test.tsx src/components/ReaderCanvas.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** The file input uses `ACCEPT_ATTR`; `DropOverlay` shows on `dragover`; text documents decode with `readText`; progress saved via `saveProgress`; a bookmark button in the status line uses `addBookmark`. Add palette commands `Open <document name>` (one per document) and `Clear cache`.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`. Expected: PASS. In a browser: import a `.txt`, reload, confirm it persists and the storage figure updates.
- [ ] **Step 5: Commit** `feat: IndexedDB library UI and preference persistence`.

### Task 13: PWA and offline

**Files:**
- Modify: `vite.config.ts`, `src/main.tsx`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`

**Interfaces:**
- Produces: a service worker (`dist/sw.js`) and `dist/manifest.webmanifest`; precache covers the shell, fonts and the PDF worker; runtime route for audio files from `VITE_AUDIO_CDN_BASE`: cache-first with range-request support.

- [ ] **Step 1: Configure** `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Nocturne Reader', short_name: 'Nocturne', theme_color: '#090A0F', background_color: '#090A0F', display: 'standalone', icons: [{src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'}, {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'}] }, workbox: { globPatterns: ['**/*.{js,css,html,woff2,mjs}'], runtimeCaching: [{urlPattern: ({url}) => /\.(mp3|aac)$/i.test(url.pathname), handler: 'CacheFirst', options: {cacheName: 'nocturne-audio', rangeRequests: true, cacheableResponse: {statuses: [0, 200]}}}] } })`; call `requestPersistence()` once in `main.tsx`; generate two simple solid-colour icons.
- [ ] **Step 2: Verify the build.** `npm run build`. Expected: `dist/sw.js` and `dist/manifest.webmanifest` exist; `dist/sw.js` references `index.html`.
- [ ] **Step 3: Verify offline** with the Playwright tools: run `npm run preview`, open `http://localhost:4173`, import a `.txt`, await `navigator.serviceWorker.ready`, set the browser context offline, reload. Expected: the app renders and the imported document opens from the library.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: PWA precache and offline start`.

---

## Phase 3 — PDF, PSD, highlights

### Task 14: PDF library and layout helpers

**Files:**
- Create: `src/lib/pdfUtil.ts`, `src/lib/pdf.ts`
- Test: `src/lib/pdfUtil.test.ts`

**Interfaces:**
- Produces in `pdfUtil.ts` (no `pdfjs` import): `visiblePages(scrollTop: number, viewportHeight: number, pageHeights: number[], bufferPx: number): number[]` (1-based page numbers whose box intersects the viewport ± buffer); `describePdfError(err: unknown): string` (`name === 'PasswordException'` → `'This PDF is password-protected and cannot be opened.'`; `'InvalidPDFException'` or `'FormatError'` → `'This file is not a valid PDF.'`; anything else → `'This PDF could not be opened.'`).
- Produces in `pdf.ts`: `PdfHandle { numPages: number; getPageSize(n: number, scale: number): Promise<{width:number;height:number}>; renderPage(n: number, canvas: HTMLCanvasElement, scale: number): Promise<void>; renderTextLayer(n: number, container: HTMLElement, scale: number): Promise<void>; destroy(): void }`; `openPdf(data: ArrayBuffer): Promise<PdfHandle>` (worker bundled via `pdfjs-dist`'s worker file imported with Vite `?url`); `renderFirstPageThumbnail(data: ArrayBuffer, maxWidth?: number): Promise<Blob>` (default 160).

- [ ] **Step 1: Write failing tests** for `pdfUtil`: with heights `[100,100,100]`, `visiblePages(0, 150, h, 0)` → `[1,2]`; `visiblePages(150, 100, h, 0)` → `[2,3]`; buffer 100 widens by a page either side, clamped to existing pages; empty `pageHeights` → `[]`; `describePdfError({name:'PasswordException'})` is the password message; an unknown error gives the generic message.
- [ ] **Step 2: Run** `npx vitest run src/lib/pdfUtil.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files. `renderTextLayer` uses `pdfjs-dist`'s `TextLayer` class. `pdf.ts` is verified in Task 15's browser check.
- [ ] **Step 4: Run** `npx vitest run src/lib/pdfUtil.test.ts` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: pdf.js wrapper and layout helpers`.

### Task 15: PdfViewer

**Files:**
- Create: `src/components/PdfViewer.tsx`
- Test: `src/components/PdfViewer.test.tsx` (mocks `../lib/pdf`)

**Interfaces:**
- Consumes: `openPdf`, `PdfHandle`, `visiblePages`.
- Produces: `PdfViewer` (`forwardRef<{ goToPage(n: number): void }, { data: ArrayBuffer; initialPage: number; initialScrollTop: number; zoom: number; nightPages: boolean; onProgress(p: { page: number; numPages: number; scrollTop: number }): void; onError(message: string): void }>`).

- [ ] **Step 1: Write failing tests** (mock `openPdf` returning 5 pages of height 800): placeholders for all 5 pages are rendered at the size from `getPageSize`; only pages from `visiblePages` get `renderPage`; scrolling to the bottom renders page 5; `nightPages` sets `data-night-pages="true"` on the scroll container; `goToPage(3)` sets `scrollTop` to the top of page 3; `onProgress` is called at most once per 500 ms during scrolling (fake timers) with the current `page`; `initialPage`/`initialScrollTop` are restored on mount; a rejecting `openPdf` calls `onError(describePdfError(err))`.
- [ ] **Step 2: Run** `npx vitest run src/components/PdfViewer.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Lazy canvas rendering at `devicePixelRatio`; the text layer overlays each rendered canvas; night pages is a CSS `filter: invert(0.92) hue-rotate(180deg)` on canvases only.
- [ ] **Step 4: Run** the test, then a browser check: import a real multi-page PDF, scroll, select text, toggle night pages, reload and confirm the position restores. Expected: all behave.
- [ ] **Step 5: Commit** `feat: lazy PDF viewer with night pages`.

### Task 16: PSD parsing and compositing

**Files:**
- Create: `src/lib/psd.ts`, `tests/fixtures/makePsd.ts`
- Test: `src/lib/psd.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Produces: `PsdLayer {id: string; name: string; kind: 'layer'|'group'; visible: boolean; opacity: number /*0–100*/; blendMode: string; left: number; top: number; width: number; height: number; imageData?: { width: number; height: number; data: Uint8ClampedArray }; children: PsdLayer[]}`; `parsePsd(data: ArrayBuffer): { width: number; height: number; layers: PsdLayer[] }` (`ag-psd` `readPsd` with `useImageData: true`, `skipCompositeImageData: true`, `skipThumbnail: true`); `DrawItem {layer: PsdLayer; opacity: number /*0–1, multiplied through parent groups*/}`; `compositeOrder(layers: PsdLayer[], overrides: Record<string, {visible?: boolean; opacity?: number}>): DrawItem[]` (draw order bottom-to-top, hidden layers and all children of hidden groups excluded); `canvasBlendMode(mode: string): GlobalCompositeOperation` (maps multiply, screen, overlay, darken, lighten, color dodge → `color-dodge`, color burn → `color-burn`, hard light, soft light, difference, exclusion, hue, saturation, color, luminosity; `normal`, `pass through` and unknown → `source-over`). `makePsdBuffer(): ArrayBuffer` in the fixture builds a 4×4 PSD with layers `bg`, `fg`, and a group `grp` containing `inner`, using `writePsd` with `imageData`.

- [ ] **Step 1: Write failing tests:** `parsePsd(makePsdBuffer())` returns `width 4`, layer names in file order with `grp.kind==='group'` and `grp.children[0].name==='inner'`; `compositeOrder` of the parsed tree lists `bg, fg, inner` in that order; an override `{grp:{visible:false}}` removes `inner`; an override `{fg:{opacity:50}}` gives `fg` opacity `0.5`; group opacity 50 with child opacity 50 gives `0.25`; `canvasBlendMode('multiply')==='multiply'`, `('color dodge')==='color-dodge'`, `('normal')` and `('made-up')` are `'source-over'`.
- [ ] **Step 2: Run** `npx vitest run src/lib/psd.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** If `ag-psd` returns children top-to-bottom for the fixture, reverse once in `parsePsd` so the tree is bottom-to-top, and let the test pin that.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: PSD layer parsing and compositing order`.

### Task 17: PsdInspector

**Files:**
- Create: `src/components/PsdInspector.tsx`
- Test: `src/components/PsdInspector.test.tsx` (mocks `../lib/psd`)

**Interfaces:**
- Consumes: `parsePsd`, `compositeOrder`, `canvasBlendMode`, `Scrubber`.
- Produces: `PSD_WARN_BYTES = 100 * 1024 * 1024`; `PsdInspector(props: { data: ArrayBuffer; onError(message: string): void })`.

- [ ] **Step 1: Write failing tests:** shows `Parsing…` until parsed, then the layer tree with indentation for groups; the eye button is `aria-pressed` and toggling it calls `compositeOrder` again with `{[id]: {visible: false}}`; the opacity Scrubber calls it with `{[id]: {opacity: n}}`; a `data.byteLength` of `PSD_WARN_BYTES + 1` shows `This PSD is 100.0 MB or larger. Parsing may be slow.` with an `Open anyway` button and does not call `parsePsd` until it is clicked; a throwing `parsePsd` calls `onError`.
- [ ] **Step 2: Run** `npx vitest run src/components/PsdInspector.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** The composite canvas draws each `DrawItem` with `globalAlpha`, `globalCompositeOperation = canvasBlendMode(...)` and `putImageData` onto an offscreen canvas then `drawImage` at `(left, top)`.
- [ ] **Step 4: Run** the test, then a browser check with a real `.psd`: toggle a layer, confirm the composite changes. Expected: PASS.
- [ ] **Step 5: Commit** `feat: PSD layer inspector`.

### Task 18: Text highlights

**Files:**
- Create: `src/lib/highlights.ts`, `src/lib/highlightStore.ts`
- Modify: `src/components/TextView.tsx`
- Test: `src/lib/highlights.test.ts`, `src/lib/highlightStore.test.ts` (`// @vitest-environment node`), `src/components/TextView.test.tsx`

**Interfaces:**
- Produces: `mergeRanges(ranges: Array<{start:number; end:number}>): Array<{start:number; end:number}>` (sorted, overlapping and touching ranges merged); `Segment {text: string; start: number; highlighted: boolean}`; `segmentText(text: string, ranges: Array<{start:number; end:number}>): Segment[]` (segments cover `text` exactly once); `offsetsFromRange(range: Range): {start: number; end: number} | null` (uses `data-start` on the segment element containing each boundary); store: `addHighlight(db, h: {docId; start; end; note}): Promise<HighlightRecord>`, `listHighlights(db, docId): Promise<HighlightRecord[]>`, `deleteHighlight(db, id): Promise<void>`. `TextView` gains `highlights: HighlightRecord[]` and `onHighlight(range: {start:number; end:number}): void`.

- [ ] **Step 1: Write failing tests:** `mergeRanges([{5,10},{8,12},{12,15}])` → `[{5,15}]`; `segmentText('abcdef', [{1,3}])` joins back to `'abcdef'` with the middle segment highlighted; overlapping stored highlights render without duplicated text; `offsetsFromRange` on a jsdom range starting at offset 2 inside a segment with `data-start="10"` gives `start: 12`; store add/list/delete round-trips; `TextView` renders `<mark>` for highlighted segments.
- [ ] **Step 2: Run** `npx vitest run src/lib/highlights.test.ts src/lib/highlightStore.test.ts src/components/TextView.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Selecting text in `TextView` shows a small "Highlight" button that calls `onHighlight`; an optional note is entered in the highlights list.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: text highlights with notes`.

### Task 19: Import pipeline, error panel, viewer routing

**Files:**
- Create: `src/lib/importPipeline.ts`, `src/components/ErrorPanel.tsx`
- Modify: `src/hooks/useLocalCache.ts`, `src/components/ReaderCanvas.tsx`, `src/lib/commands.ts`, `src/App.tsx`
- Test: `src/lib/importPipeline.test.ts` (`// @vitest-environment node`, mocks `./pdf` and `./psd`), `src/components/ReaderCanvas.test.tsx` (extend), `src/lib/commands.test.ts`

**Interfaces:**
- Consumes: `detectDocType`, `importDocument`, `openPdf`, `renderFirstPageThumbnail`, `describePdfError`, `parsePsd`, viewers.
- Produces: `prepareImport(file: File): Promise<{ok: true; type: DocType; thumbnail?: Blob} | {ok: false; error: string}>` (validates PDFs by opening them and renders the page-1 thumbnail, validates PSDs by parsing); `ErrorPanel(props: { message: string; onClear?: () => void })`; `ReaderCanvas` routes by `doc.type` to `TextView`, `PdfViewer` or `PsdInspector`, shows `ErrorPanel` on load errors, and maps `ArrowLeft`/`ArrowRight` to `goToPage` for PDFs; `pageCommands(query: string, numPages: number|null, goTo: (n: number) => void): Command[]` returns one `Go to page N` command when `query` is a whole number from 1 to `numPages`, else `[]`, and is passed to the palette as `dynamic`.

- [ ] **Step 1: Write failing tests (Review Focus 2).** `prepareImport` with `openPdf` rejecting a `PasswordException` returns `{ok:false, error:'This PDF is password-protected and cannot be opened.'}`; a corrupt PSD (`parsePsd` throws) returns `{ok:false, error:'This PSD could not be read.'}`; a valid PDF returns `ok:true` with a thumbnail Blob; a `.txt` skips validation. Through `useLocalCache.importFile` (library mocked to a real node DB in a data test), a failed `prepareImport` leaves `db.documents.count()` at `0`. `ReaderCanvas` renders `TextView`/`PdfViewer`/`PsdInspector` for the three types and `ErrorPanel` when the child calls `onError`. `pageCommands('5', 10, fn)` returns one command that calls `fn(5)`; `('0', 10)`, `('11', 10)`, `('abc', 10)` and `('5', null)` return `[]`.
- [ ] **Step 2: Run** `npx vitest run src/lib/importPipeline.test.ts src/components/ReaderCanvas.test.tsx src/lib/commands.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `importFile` calls `prepareImport` first; on success passes `thumbnail` to `importDocument`; PDF thumbnails go to the `thumbnails` table with `page: 1`.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, then a browser check importing a password-protected PDF and a renamed non-PDF `.pdf`. Expected: inline error, nothing added to the library.
- [ ] **Step 5: Commit** `feat: validated imports, error panel, viewer routing`.

---

## Phase 4 — Audio engine

### Task 20: Tracks, synth recipes, level maths

**Files:**
- Create: `src/lib/audio/tracks.ts`, `src/lib/audio/synth.ts`, `src/lib/audio/levels.ts`
- Test: `src/lib/audio/synth.test.ts`, `src/lib/audio/levels.test.ts`

**Interfaces:**
- Produces: `TrackId = 'lofi'|'rain'|'pink'`; `AudioTrack {id: TrackId; name: string; file: string}`; `AUDIO_TRACKS` = Lo-Fi `lofi.mp3`, Rain `rain.mp3`, Pink Noise `pink.mp3`; `fillPinkNoise(out: Float32Array): void`; `SynthHandle {stop(): void}`; `createSynth(ctx: AudioContext, id: TrackId, destination: AudioNode): SynthHandle` (lofi: detuned sine/triangle pad chord plus filtered crackle noise; rain: band-passed noise with slow random amplitude modulation plus a low rumble; pink: looped pink-noise buffer); `rmsLevel(buf: Uint8Array): number` (0–1 from `getByteTimeDomainData`).

- [ ] **Step 1: Write failing tests:** `fillPinkNoise` over 16384 samples keeps every value within `[-1, 1]` and lag-1 autocorrelation `> 0.3` (white noise would be ≈ 0); with a fake `AudioContext` that records created nodes, `createSynth(ctx,'lofi',dest)` starts at least 2 oscillators, `'pink'` starts exactly 1 buffer source, and `stop()` calls `stop()` on every started source and `disconnect()` on every node; `rmsLevel(new Uint8Array(128).fill(128))===0`; alternating `0`/`255` returns `> 0.9`.
- [ ] **Step 2: Run** `npx vitest run src/lib/audio`. Expected: FAIL.
- [ ] **Step 3: Implement** with the Paul Kellet pink-noise filter.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: synth recipes and pink noise`.

### Task 21: Sleep timer and audio engine

**Files:**
- Create: `src/lib/sleepTimer.ts`, `src/lib/audio/streamed.ts`, `src/lib/audio/engine.ts`, `src/lib/audio/instance.ts`
- Test: `src/lib/sleepTimer.test.ts`, `src/lib/audio/engine.test.ts`

**Interfaces:**
- Consumes: `createSynth`, `AUDIO_TRACKS`, `TrackId`.
- Produces: `SleepTarget {canSetVolume: boolean; getVolume(): number; setVolume(v: number): void; pause(): void}`; `createSleepTimer(opts: {resolve: () => SleepTarget; fadeMs?: number /*default 5000*/}): SleepTimer`; `SleepTimer {start(minutes: 15|30|60): void; cancel(): void; remainingMs(): number|null; subscribe(fn: () => void): () => void}` (starting a new timer cancels the old one; the target is resolved when the fade begins); `setSleepTargetResolver(fn: () => SleepTarget): void` and singleton `sleepTimer` exported from `sleepTimer.ts`; `loadStream(url: string, opts?: {createAudio?: (url: string) => HTMLAudioElement; timeoutMs?: number /*default 5000*/}): Promise<HTMLAudioElement>` in `streamed.ts` (an `<audio loop crossOrigin="anonymous">` that resolves on `canplay` and rejects on `error` or timeout); `AudioEngineState {playing: boolean; trackId: TrackId; volume: number; source: 'stream'|'synth'|null; error: string|null}`; `class AudioEngine { constructor(opts?: {cdnBase?: string; createContext?: () => AudioContext; createAudio?: (url: string) => HTMLAudioElement}); getState(): AudioEngineState; subscribe(fn: (s: AudioEngineState) => void): () => void; getAnalyser(): AnalyserNode|null; play(trackId?: TrackId): Promise<void>; pause(): void; setTrack(id: TrackId): Promise<void>; setVolume(v: number): void; resumeIfSuspended(): Promise<void>; attachElement(el: HTMLMediaElement): void; detachElement(el: HTMLMediaElement): void; dispose(): void }`; `getAudioEngine(): AudioEngine` in `instance.ts` (reads `import.meta.env.VITE_AUDIO_CDN_BASE`, registers the engine as the sleep-target resolver). Default volume 0.5; streams are `<audio loop crossOrigin="anonymous">` routed through the master gain and analyser; a stream counts as failed on `error` or after 5000 ms without `canplay`.

- [ ] **Step 1: Write failing tests.** Sleep timer (fake timers): `start(15)` with a volume-capable target ramps the volume down over the last 5 s then calls `pause` at 15 min and restores the original volume; `canSetVolume:false` calls `pause` at exactly 15 min with no `setVolume` calls; `cancel()` prevents `pause`; starting 30 after 15 cancels the first; `remainingMs()` decreases and is `null` after `cancel`; the resolver is called only when the fade begins. Engine (fake context and audio): `play()` with no `cdnBase` gives `source:'synth'`; with `cdnBase` and an audio element that fires `canplay` gives `'stream'` with URL `${cdnBase}/lofi.mp3`; firing `error` gives `'synth'`; no event within 5000 ms gives `'synth'`; `setVolume(2)` clamps to `1`; `pause()` sets `playing:false`; **(Review Focus 5)** a context whose `resume()` rejects, or stays `'suspended'` after resolving, leaves `playing:false` and `error: 'Audio is blocked until you click or press a key.'`; `resumeIfSuspended()` resolves a suspended context and clears the error; with no `AudioContext` constructor available `play()` leaves `error: 'Audio is not supported in this browser.'`.
- [ ] **Step 2: Run** `npx vitest run src/lib/sleepTimer.test.ts src/lib/audio/engine.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: audio engine and shared sleep timer`.

### Task 22: useAudioEngine, AudioPanel, visuals

**Files:**
- Create: `src/hooks/useAudioEngine.ts`, `src/components/AudioPanel.tsx`, `src/components/Waveform.tsx`, `src/components/LedPulse.tsx`
- Modify: `vite.config.ts` (audio runtime cache already from Task 13; confirm), `src/App.tsx`
- Test: `src/hooks/useAudioEngine.test.ts`, `src/components/AudioPanel.test.tsx`

**Interfaces:**
- Consumes: `getAudioEngine`, `AUDIO_TRACKS`, `sleepTimer`, `rmsLevel`, `getPref`/`setPref`, `Scrubber`.
- Produces: `useAudioEngine(): { state: AudioEngineState; analyser: AnalyserNode|null; play(): Promise<void>; pause(): void; toggle(): Promise<void>; setTrack(id: TrackId): Promise<void>; setVolume(v: number): void }` (persists `audioTrack` and `audioVolume` prefs; adds one-time `pointerdown`/`keydown`/`visibilitychange` listeners that call `resumeIfSuspended()`); `Waveform(props: {analyser: AnalyserNode|null; active: boolean})`; `LedPulse(props: {level: number; source: 'stream'|'synth'|null})`; `AudioPanel`.

- [ ] **Step 1: Write failing tests** (engine mocked): `toggle()` plays then pauses; `setTrack('rain')` persists `audioTrack`; the first `pointerdown` calls `resumeIfSuspended` once; `AudioPanel` lists the three tracks with the current one `aria-pressed`, a volume Scrubber, sleep-timer buttons `Off/15m/30m/60m` that call `sleepTimer.start(15)` or `.cancel()`, and shows the engine error text in `role="alert"`; `LedPulse` shows a `data-source="synth"` attribute for the fallback.
- [ ] **Step 2: Run** `npx vitest run src/hooks/useAudioEngine.test.ts src/components/AudioPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** `Waveform` draws `getByteTimeDomainData` on a canvas each animation frame while `active`; no fake sine data anywhere.
- [ ] **Step 4: Run** `npm test`. Then in a browser: press play, hear each synth track, drag volume, confirm the waveform follows the sound and the LED pulses. Expected: PASS.
- [ ] **Step 5: Commit** `feat: audio panel with waveform and LED`.

---

## Phase 5 — Music dock and ad-free hardening

### Task 23: Adapter contract and useMusicSource

**Files:**
- Create: `src/lib/music/adapter.ts`, `src/hooks/useMusicSource.ts`
- Test: `src/hooks/useMusicSource.test.ts`

**Interfaces:**
- Consumes: `SleepTarget`, `setSleepTargetResolver`, `sleepTimer` (Task 21); `LanguageTag` (Task 2).
- Produces in `adapter.ts`: `SourceId = 'noise'|'spotify'|'youtube'|'tracks'`; `PlaylistItem {id: string; source: SourceId; ref: string; title: string; artist: string; language: LanguageTag|null; kind?: 'playlist'|'album'|'track'|'video'|'episode'|'show'|'artist'}`; `PlaybackState {title: string; artist: string; artUrl: string|null; language: LanguageTag|null; isPlaying: boolean; loading: boolean; position: number /*s*/; duration: number /*s*/; volume: number /*0–1*/; canSeek: boolean; canSetVolume: boolean; canSkip: boolean; error: string|null}`; `MusicAdapter {id: SourceId; load(item: PlaylistItem): Promise<void>; play(): Promise<void>; pause(): void; seek(seconds: number): void; setVolume(v: number): void; next(): void; previous(): void; getState(): PlaybackState; subscribe(fn: (s: PlaybackState) => void): () => void; dispose(): void}`; `adapterSleepTarget(a: MusicAdapter): SleepTarget`.
- Produces `useMusicSource(adapters: Record<SourceId, MusicAdapter>): { activeSource: SourceId; state: PlaybackState; select(source: SourceId, item?: PlaylistItem): Promise<void>; play(): Promise<void>; pause(): void; toggle(): Promise<void>; seek(s: number): void; setVolume(v: number): void; next(): void; previous(): void; setSleepTimer(minutes: 0|15|30|60): void; sleepRemainingMs: number|null }` (registers `adapterSleepTarget(active)` via `setSleepTargetResolver`).

- [ ] **Step 1: Write failing tests** (fake adapters): `select('youtube', item)` pauses the previously active adapter and calls `load(item)` on the new one; `state` mirrors the active adapter's `subscribe` updates and ignores inactive ones; `toggle()` plays when paused and pauses when playing; `setSleepTimer(15)` with fake timers pauses the **currently active** adapter at 15 min even if the source changed after the timer started; for an adapter with `canSetVolume:false` the volume is never touched; `setSleepTimer(0)` cancels.
- [ ] **Step 2: Run** `npx vitest run src/hooks/useMusicSource.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook and types.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: music adapter contract and source controller`.

### Task 24: Playlists config and music URL parsing

**Files:**
- Create: `src/lib/music/playlists.ts`, `src/lib/music/parseUrl.ts`, `scripts/verify-playlists.mjs`
- Test: `src/lib/music/playlists.test.ts`, `src/lib/music/parseUrl.test.ts`

**Interfaces:**
- Produces: `Category {id: string; name: string; tags: string[]; items: PlaylistItem[]}`; `CATEGORIES: Category[]` (`english-focus` tags Lofi/Jazz/Ambient; `hindi-chill` tags Acoustic/Sufi/Night Vibes; `instrumental`; `nature`, whose items include `noise` sources `rain` and `pink`); `parseMusicUrl(input: string): {source: 'youtube'; kind: 'playlist'|'video'; id: string} | {source: 'spotify'; kind: 'playlist'|'album'|'track'|'episode'|'show'|'artist'; id: string; uri: string} | null`; `parseStreamUrl(input: string): string|null` (accepts only `https:`).

- [ ] **Step 1: Write failing tests (Review Focus 4).** `parseMusicUrl` accepts `https://www.youtube.com/playlist?list=PL123`, `https://www.youtube.com/watch?v=abc`, `https://youtu.be/abc`, `https://music.youtube.com/playlist?list=PL123`, `https://open.spotify.com/playlist/37i9?si=x`, `https://open.spotify.com/intl-hi/playlist/37i9`, `spotify:playlist:37i9`; rejects `javascript:alert(1)`, `data:text/html,x`, `https://youtube.com.evil.com/watch?v=abc`, `https://evilyoutube.com/watch?v=abc`, `''`, and plain text. `parseStreamUrl('http://x/a.mp3')` is `null`, `('https://x/stream')` returns it, `('javascript:1')` is `null`. `playlists.test.ts`: four categories with the exact names from Global Constraints; every item has non-empty `id`, `title`, `ref`; `language` is one of the four tags or `null`; ids are unique; `nature` contains at least one `noise` item; every `hindi-chill` item has `language: 'HI'`.
- [ ] **Step 2: Run** `npx vitest run src/lib/music/playlists.test.ts src/lib/music/parseUrl.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Parse with `new URL()` and compare `hostname` against an exact allowlist (`www.youtube.com`, `youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`, `open.spotify.com`). Pick at least 2 real presets per category (YouTube playlists or Spotify playlists), recording tags and language. `scripts/verify-playlists.mjs` requests `https://open.spotify.com/oembed?url=…` and `https://www.youtube.com/oembed?url=…` for every preset and exits non-zero if any is not HTTP 200.
- [ ] **Step 4: Run** the tests and `node scripts/verify-playlists.mjs`. Expected: tests pass; every preset prints OK. Replace any failing preset and re-run.
- [ ] **Step 5: Commit** `feat: curated playlists and music URL parsing`.

### Task 25: Uploaded and stream tracks

**Files:**
- Create: `src/lib/tracks.ts`, `src/components/TrackUpload.tsx`
- Test: `src/lib/tracks.test.ts` (`// @vitest-environment node`), `src/components/TrackUpload.test.tsx`

**Interfaces:**
- Produces: `addUploadedTrack(db, file: File, meta?: {title?: string; artist?: string; language?: LanguageTag; duration?: number}): Promise<TrackRecord>`; `addStreamTrack(db, url: string, meta: {title: string; artist?: string; language?: LanguageTag}): Promise<TrackRecord>`; `listTracks(db): Promise<TrackRecord[]>`; `deleteTrack(db, id): Promise<void>`; `TrackUpload(props: { onAdded(t: TrackRecord): void })`.

- [ ] **Step 1: Write failing tests:** `addUploadedTrack` accepts `Night Drive.MP3`, stores the blob with title `Night Drive`; rejects `a.wav` with `'Only .mp3 and .aac files can be added.'`; rejects a 0-byte file; `addStreamTrack` with `http://…` throws `'Stream URLs must start with https://'`; `listTracks` newest first; `deleteTrack` removes it. `TrackUpload` (lib mocked): choosing a file calls `addUploadedTrack`; submitting an invalid URL shows `role="alert"` with the error and calls nothing.
- [ ] **Step 2: Run** `npx vitest run src/lib/tracks.test.ts src/components/TrackUpload.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** `TrackUpload` reads duration from an `<audio>` metadata event before saving.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: uploaded and stream tracks`.

### Task 26: YouTube adapter and player tile

**Files:**
- Create: `src/lib/music/loadScript.ts`, `src/lib/music/youtube.ts`, `src/components/YouTubeAudioPlayer.tsx`
- Test: `src/lib/music/youtube.test.ts`, `src/components/YouTubeAudioPlayer.test.tsx`

**Interfaces:**
- Produces: `loadScript(src: string): Promise<void>` (memoised per URL, rejects on error); `YouTubeAdapter = MusicAdapter & { mount(el: HTMLElement): void }`; `createYouTubeAdapter(deps?: {loadYT?: () => Promise<YTNamespace>}): YouTubeAdapter` (id `'youtube'`; no network until the first `load()`; script `https://www.youtube.com/iframe_api`; `YT.Player` created with `host: 'https://www.youtube-nocookie.com'`, `width: 200`, `height: 200`, `playerVars: {controls: 0, playsinline: 1, rel: 0, enablejsapi: 1, origin: location.origin}`); `YouTubeAudioPlayer(props: { adapter: YouTubeAdapter; active: boolean })`.

- [ ] **Step 1: Write failing tests** (fake `YT.Player`): creating the adapter calls no `loadScript`; `load({ref: 'PL123', kind: 'playlist'})` loads the script once and creates the player with the nocookie host, 200×200 and `controls: 0`; `play()` calls `playVideo`; `onStateChange(1)` sets `isPlaying`, `onStateChange(2)` clears it; title/artist come from `getVideoData()` and `artUrl` is `https://i.ytimg.com/vi/<video_id>/hqdefault.jpg`; position polling updates `position` from `getCurrentTime()`; `setVolume(0.5)` calls `player.setVolume(50)`; `onError(150)` calls `nextVideo()` and three consecutive errors set `error: 'No playable videos in this playlist.'`; `seek(30)` calls `seekTo(30, true)`. Component: when `active` the tile has `min-width: 200px`, `min-height: 200px`, is not inside `Chrome`, and has `data-idle-exempt`; when inactive it is not rendered.
- [ ] **Step 2: Run** `npx vitest run src/lib/music/youtube.test.ts src/components/YouTubeAudioPlayer.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Poll position every 500 ms only while playing.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: YouTube adapter with visible player tile`.

### Task 27: Spotify adapter and embed

**Files:**
- Create: `src/lib/music/spotifyOembed.ts`, `src/lib/music/spotify.ts`, `src/components/SpotifyPlayer.tsx`
- Test: `src/lib/music/spotify.test.ts`, `src/lib/music/spotifyOembed.test.ts`, `src/components/SpotifyPlayer.test.tsx`

**Interfaces:**
- Produces: `fetchSpotifyMeta(url: string, fetchFn?: typeof fetch): Promise<{title: string; thumbnailUrl: string|null}>` (GET `https://open.spotify.com/oembed?url=<encoded>`); `createSpotifyAdapter(deps?: {loadApi?: () => Promise<IFrameAPI>; fetchMeta?: typeof fetchSpotifyMeta; readyTimeoutMs?: number /*default 8000*/}): SpotifyAdapter`, where `SpotifyAdapter = MusicAdapter & { mount(el: HTMLElement): void }` (id `'spotify'`; script `https://open.spotify.com/embed/iframe-api/v1`; `createController(el, {uri, width: '100%', height: 152})`; `canSetVolume: false`, `canSkip: false`); `SpotifyPlayer(props: { adapter; active: boolean })`.

- [ ] **Step 1: Write failing tests** (fake `IFrameAPI`): no script load before `load()`; `load` calls `createController` with the item's URI; `play()` calls `resume()`, `pause()` calls `pause()`, `seek(40)` calls `seek(40)`; `playback_update {position: 5000, duration: 30000, isPaused: false}` gives `position 5`, `duration 30`, `isPlaying true`; `canSetVolume` is `false` and `setVolume` is a no-op; title and `artUrl` come from the mocked oEmbed; artist comes from the preset item; no `ready` within `readyTimeoutMs` sets `error: "Spotify didn't load."`; `fetchSpotifyMeta` requests the encoded oEmbed URL and returns `{title, thumbnailUrl}` and `null` thumbnail when absent; `SpotifyPlayer` with an adapter in error shows an `Open in Spotify` link to the item's URL and is not rendered when inactive.
- [ ] **Step 2: Run** `npx vitest run src/lib/music/spotify.test.ts src/lib/music/spotifyOembed.test.ts src/components/SpotifyPlayer.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** The embed iframe stays rendered while active, because it is the playback surface. Confirm 152 as Spotify's standard compact height in the browser check.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: Spotify embed adapter`.

### Task 28: Night Noise and My Tracks adapters

**Files:**
- Create: `src/lib/music/noise.ts`, `src/lib/music/tracksAdapter.ts`, `src/lib/music/defaultAdapters.ts`
- Test: `src/lib/music/noise.test.ts`, `src/lib/music/tracksAdapter.test.ts`

**Interfaces:**
- Consumes: `AudioEngine`, `AUDIO_TRACKS`, `TrackRecord`, `listTracks`.
- Produces: `createNoiseAdapter(engine: AudioEngine): MusicAdapter` (id `'noise'`; `load` maps `item.ref` to a `TrackId` and calls `engine.setTrack`; title from `AUDIO_TRACKS`, artist `'Nocturne'`, language `'NATURE'`, `canSeek: false`, `canSetVolume: true`, `canSkip: false`); `createTracksAdapter(engine: AudioEngine, deps?: {createAudio?: () => HTMLAudioElement; createObjectUrl?: (b: Blob) => string; revokeObjectUrl?: (u: string) => void}): MusicAdapter` (id `'tracks'`; queue of `TrackRecord`s; `next`/`previous` move through it; blob tracks play from an object URL, stream tracks from `url`; elements get `crossOrigin='anonymous'` and are attached with `engine.attachElement`; if loading fails CORS, retry without `crossOrigin`, skip `attachElement` and control volume via `element.volume`); `DefaultAdapters {adapters: Record<SourceId, MusicAdapter>; youtube: YouTubeAdapter; spotify: SpotifyAdapter}`; `createDefaultAdapters(): DefaultAdapters`.

- [ ] **Step 1: Write failing tests:** noise `load({ref:'rain'})` calls `engine.setTrack('rain')`, `play()` calls `engine.play()`, state mirrors engine state; tracks adapter loading a blob track calls `createObjectUrl` and starts the element, `dispose()` revokes the URL; a stream track uses its `url`; `next()` at the end of the queue wraps to the first; an `error` event sets `state.error`; after a CORS-style first failure the adapter retries without `crossOrigin` and `attachElement` is not called, and `setVolume(0.3)` sets `element.volume`; attached case routes volume through `engine.setVolume`.
- [ ] **Step 2: Run** `npx vitest run src/lib/music/noise.test.ts src/lib/music/tracksAdapter.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `createDefaultAdapters` wires all four adapters around `getAudioEngine()`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: Night Noise and My Tracks adapters`.

### Task 29: MusicDock and wiring

**Files:**
- Create: `src/components/MusicDock.tsx`, `src/hooks/useMusicPrefs.ts`
- Modify: `src/App.tsx`, `src/lib/commands.ts`
- Test: `src/components/MusicDock.test.tsx`, `src/hooks/useMusicPrefs.test.ts`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `useMusicSource`, `CATEGORIES`, `parseMusicUrl`, `TrackUpload`, `listTracks`, `Scrubber`, `YouTubeAudioPlayer`, `SpotifyPlayer`, `Chrome`.
- Produces: `MusicDock(props: { music: ReturnType<typeof useMusicSource>; categories: Category[]; tracks: TrackRecord[]; online: boolean; onAddCustom(item: PlaylistItem): void })` (the dock parses pasted links with `parseMusicUrl` and passes the resulting item); `useMusicPrefs(): { source: SourceId; category: string; customPlaylists: PlaylistItem[]; setSource(s: SourceId): void; setCategory(id: string): void; addCustom(item: PlaylistItem): void }` persisted under prefs keys `musicSource`, `musicCategory`, `customPlaylists`; `App` accepts `adapters?: DefaultAdapters` for tests.

- [ ] **Step 1: Write failing tests:** the dock has `h-14` and shows title, artist, a language tag (`HI`), the album art `<img>` when `artUrl` is set; the play button is labelled `Play`/`Pause` from `isPlaying`; the scrub Scrubber is disabled unless `canSeek`; the volume Scrubber is disabled with title `Spotify controls its own volume.` when `!canSetVolume`; four source buttons with `aria-pressed` on the active one; four category tabs, choosing an item calls `select(item.source, item)`; when `online` is false the Spotify and YouTube sources are disabled with `Needs a connection`; pasting a link calls `onAddCustom` with the parsed item only when `parseMusicUrl` accepts it, otherwise shows `That link is not a Spotify or YouTube link.`. `useMusicPrefs`: `addCustom` persists to the `customPlaylists` pref and a fresh hook instance rehydrates it; `setSource` persists `musicSource`. In `App.test`: `Ctrl+M` calls the active adapter's `play()` then `pause()`; the palette lists "Switch to YouTube"; with YouTube active the tile sits outside the faded `chrome` element (stays at opacity `1` after the idle timeout while the dock fades).
- [ ] **Step 2: Run** `npx vitest run src/components/MusicDock.test.tsx src/hooks/useMusicPrefs.test.ts src/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** The sleep-timer control reuses `setSleepTimer`; `A` toggles Night Noise via `select('noise')` + `toggle()`.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`. In a browser, open each source and use the dock for each. Expected: PASS.
- [ ] **Step 5: Commit** `feat: music dock with source switcher and category tabs`.

### Task 30: Content-Security-Policy

**Files:**
- Create: `vite/csp.ts`
- Modify: `vite.config.ts`
- Test: `vite/csp.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Produces: `buildCsp(opts: {supabaseUrl?: string}): string`; `cspPlugin(env: {supabaseUrl?: string}): Plugin` (`apply: 'build'`; injects `<meta http-equiv="Content-Security-Policy" content="…">` via `transformIndexHtml`).

- [ ] **Step 1: Write failing tests:** the policy contains `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`; `script-src` includes `'self'`, `'wasm-unsafe-eval'`, `https://www.youtube.com`, `https://s.ytimg.com`, `https://open.spotify.com` and contains neither `'unsafe-eval'` nor `*`; `frame-src` is exactly `https://www.youtube-nocookie.com https://www.youtube.com https://open.spotify.com`; `img-src` includes `data: blob: https://i.ytimg.com`; `media-src` is `'self' blob: https:`; `connect-src` includes `https://open.spotify.com` and, given `supabaseUrl: 'https://abc.supabase.co'`, both `https://abc.supabase.co` and `wss://abc.supabase.co`; without a Supabase URL neither appears; an invalid `supabaseUrl` throws `'VITE_SUPABASE_URL is not a valid URL'`; `transformIndexHtml` adds exactly one meta tag.
- [ ] **Step 2: Run** `npx vitest run vite/csp.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `style-src 'self' 'unsafe-inline'` (React inline styles), `font-src 'self'`, `worker-src 'self' blob:`. Wire `cspPlugin` into `vite.config.ts` reading `loadEnv`.
- [ ] **Step 4: Verify in a browser.** `npm run build` then `grep "Content-Security-Policy" dist/index.html` finds the tag. Run `npm run preview`; with the Playwright tools collect console messages while: importing a text file, a PDF and a PSD, selecting Night Noise, YouTube (a real playlist), Spotify (a real playlist) and an uploaded `.mp3`. Expected: zero messages mentioning "Content Security Policy". For any origin the player scripts genuinely need, add only that origin to `buildCsp` with a test line.
- [ ] **Step 5: Commit** `feat: build-time CSP allowlist`.

---

## Phase 6 — Presence

### Task 31: Presence

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/presence.ts`, `src/hooks/usePresence.ts`, `src/components/PresenceBadge.tsx`
- Modify: `src/components/StatusLine.tsx`, `src/App.tsx`
- Test: `src/lib/presence.test.ts`, `src/hooks/usePresence.test.ts`, `src/components/PresenceBadge.test.tsx`

**Interfaces:**
- Produces: `getSupabase(): SupabaseClient|null` (`null` unless both env vars are set); `Room = 'pdf'|'psd'|'text'|'none'`; `summarizePresence(state: Record<string, Array<{room: Room}>>): {total: number; byRoom: {pdf: number; psd: number; text: number}}` (each key counted once, using its latest entry; `none` counts toward `total` only); `createThrottledTracker(track: (payload: {room: Room}) => Promise<unknown>, minGapMs?: number /*default 6000*/): (room: Room) => void` (first call immediate, later calls inside the gap collapse to one trailing call with the latest room); `nextBackoffMs(attempt: number): number` = `min(30000, 1000 * 2 ** attempt)`; `usePresence(room: Room, deps?: {getClient?: () => SupabaseClient|null}): {status: 'connecting'|'online'|'offline'; total: number|null; byRoom: {pdf:number; psd:number; text:number}|null}`; `PresenceBadge(props: ReturnType<typeof usePresence>)`.

- [ ] **Step 1: Write failing tests.** `summarizePresence` with 12 `pdf`, 3 `psd`, 8 `text` keys gives `total 23` and that breakdown; a key with two entries counts once using the latest; `nextBackoffMs(0)===1000`, `(3)===8000`, `(10)===30000`. Throttle (fake timers): three calls within 6 s send one immediately and one trailing call carrying the last room after the gap. Hook (mock channel): no client → `status:'offline'`, `total:null`, no network call; `subscribe` callback `'SUBSCRIBED'` → `'online'` and `track` called with a payload whose keys are exactly `['room']` (no file names); `'CHANNEL_ERROR'`, `'TIMED_OUT'` and `'CLOSED'` each → `'offline'` with a retry scheduled after `nextBackoffMs(0)`; a `window` `offline` event → `'offline'`; a presence `sync` updates `total` and `byRoom`; a room change calls `track` through the throttle. Badge: online shows `23 online · PDF 12 · PSD 3 · Text 8`; offline shows `Local mode`; connecting shows `Connecting…`.
- [ ] **Step 2: Run** `npx vitest run src/lib/presence.test.ts src/hooks/usePresence.test.ts src/components/PresenceBadge.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** One channel `nocturne-presence` with `config: {presence: {key: crypto.randomUUID()}}`; the room comes from the open document's type (`none` when nothing is open); unsubscribe on unmount.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`. Without keys the badge shows `Local mode`. With the user's keys, two browser tabs show a total of 2 (manual check).
- [ ] **Step 5: Commit** `feat: live presence with offline fallback`.

---

## Wrap-up

### Task 32: Remove prototype, README, final verification

**Files:**
- Delete: `nocturne_reader_night_document_platform.tsx`
- Modify: `README.md`, `.env.example`

- [ ] **Step 1: Delete the prototype** with `git rm nocturne_reader_night_document_platform.tsx`; confirm `npm run build` still passes.
- [ ] **Step 2: Write `README.md`:** what the app is; `npm install`, `npm run dev`, `npm test`, `npm run build`; the three env vars; how to create a free Supabase project and where to paste the URL and anon key; how to host audio on Cloudflare R2 (free tier), enable CORS and set `VITE_AUDIO_CDN_BASE`; the hotkeys; the ad-free note stating that ads served inside YouTube or Spotify players are not removed; the Spotify limits (30-second previews without login, no volume control).
- [ ] **Step 3: Run the full verification.** `npm test`, `npm run typecheck`, `npm run build`: all pass. With the Playwright tools against `npm run preview`, check and record each: seeded documents open; import a generated PDF and PSD; layer toggle changes the composite; the chrome fades at 3 s and wakes on mouse movement; `Ctrl+K` palette opens and runs a command; theme switches; reload offline still opens documents; each music source loads (mocked or real) with zero CSP console messages; an uploaded `.mp3` plays offline.
- [ ] **Step 4: Report** the verification results to the user, listing what was checked automatically and what still needs the user (live Supabase presence with their keys; real Spotify/YouTube playback).
- [ ] **Step 5: Commit** `chore: remove prototype, add README`.
