# Reading Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (the owner chose native execution). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a few readers join a room by code, see each other's document type, position and status, jump to each other's page when they have the same file, and share a focus timer and emoji nudges.

**Architecture:** One Supabase Realtime channel per room (`nightowl-room:<code>`) on the client the reader count already uses. Presence carries who is in and a small status; Broadcast carries progress, timer, nudges and a "hello" for late joiners. Pure modules (codes, nicknames, validation, fingerprint) are tested in Node; a `useRoom` hook is tested over a fake channel; `RoomPanel` reuses the existing sheet components.

**Tech Stack:** React, TypeScript, Tailwind v4, `@supabase/supabase-js` (existing), Vitest + Testing Library, `playwright-core` e2e.

**Spec:** `docs/superpowers/specs/2026-11-16-reading-rooms-design.md`. Branch `feat/reading-rooms`, stacked on `feat/pdf-reflow`.

## Global Constraints

- No new runtime dependency.
- Supabase free tier: 200 concurrent connections, 100 messages/second, 20 presence messages/second, 5 presence calls per client per 30 seconds, 256 KB broadcast payload. Rooms share the one websocket of the reader count.
- Room code: 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31, no 0 O 1 I L), displayed `OWL-` + code (e.g. `OWL-4F2K9X`); channel `nightowl-room:<code>`; link `#room=<code>`, always confirmed before joining.
- At most 8 members. If more than 8 are present, the members whose random keys sort last leave with "This room is full".
- Presence payload is exactly `{ nick, doc, fp, len, status }`; broadcast events are only `progress`, `timer`, `nudge`, `hello`. Never a file name, text, or id beyond the per-session random key.
- `progress` at most once per 10 s and only when changed; a nudge at most once per 3 s per sender; `away` after 2 minutes without input; timer lengths 15 / 25 / 45 minutes; four nudges 👋 🔥 ☕ 🌙; no chat, no free text, no sound.
- Fingerprint: SHA-256 over the file size plus its first, middle and last 64 KB, 16 hex characters. "Same document" needs the fingerprint **and** the page count (PDF) or length (text) to match.
- Rooms are disabled offline with the reason "Rooms need a connection"; a full room says "This room is full"; a refused join says "This room is busy, try again in a moment".
- Phone: bottom sheet below 640px with `SHEET_LAYOUT`, `SheetHandle` and `useExclusiveSheets`; 44px targets; rows wrap, never truncate.
- Tests first; one commit per task; `git add` explicit paths only; every UI task checked at 360×800 in the e2e `phone` group with the screenshot read; STATUS.md updated at the end.

## Review Focus

1. **Two people take the 8th seat at once:** exactly one stays (Task 1 `shouldLeaveFullRoom`, Task 3).
2. **Messy codes:** lowercase, spaces, an `owl-` prefix, look-alike characters, wrong length: accepted when they normalise to a valid code, otherwise "That code does not look right." (Tasks 1 and 5).
3. **The reader opens another document, or closes it, while in a room:** the row's type, fingerprint, length and progress update at once, and nothing from the old document lingers (Tasks 3 and 6).
4. **The connection drops mid-room and returns:** the panel says it is reconnecting, rejoins with backoff, and nobody appears twice (Task 3).
5. **A stranger sends garbage:** wrong types, huge numbers, HTML in a nickname, a progress past the end: ignored or shown as plain text, never crashing the panel (Tasks 1, 3 and 5).

---

### Task 1: Room model, codes and nicknames (pure)

**Files:**
- Create: `src/features/rooms/roomCode.ts`, `roomCode.test.ts`, `nickname.ts`, `nickname.test.ts`, `roomModel.ts`, `roomModel.test.ts`
- Modify: `docs/superpowers/specs/2026-11-16-reading-rooms-design.md` (code example is 6 characters, presence carries `len`)

**Interfaces — Produces:**
- `roomCode.ts`: `ROOM_CODE_ALPHABET`, `ROOM_CODE_LENGTH = 6`, `generateRoomCode(randomInt?: (max: number) => number): string` (default from `crypto.getRandomValues`), `formatRoomCode(code: string): string` (`OWL-` + code), `parseRoomCode(input: string): string | null` (trim, uppercase, drop a leading `OWL`, hyphens and spaces; null unless 6 valid characters), `roomCodeFromHash(hash: string): string | null` (`#room=…`), `roomLink(code: string, base: string): string` (base without its hash + `#room=` + code), `roomChannelName(code: string): string`.
- `nickname.ts`: `randomNickname(randomInt?): string` ("Quiet Owl" style, from lists of at least 12 adjectives and 12 birds), `sessionNickname(storage?: Pick<Storage, 'getItem' | 'setItem'>): string` and `rerollNickname(storage?): string` (kept in `sessionStorage`; a throwing or missing storage still returns a nickname).
- `roomModel.ts`: constants `MAX_MEMBERS = 8`, `AWAY_AFTER_MS = 120_000`, `PROGRESS_GAP_MS = 10_000`, `NUDGE_GAP_MS = 3_000`, `TIMER_CHOICES = [15, 25, 45] as const`, `NUDGES = ['👋', '🔥', '☕', '🌙'] as const`; types `DocKind = 'pdf' | 'psd' | 'text' | 'none'`, `MemberStatus = 'reading' | 'focus' | 'away'`, `MemberMeta = { nick: string; doc: DocKind; fp: string; len: number; status: MemberStatus }`, `Progress = { page?: number; total?: number; offset?: number; length?: number }`, `Member = MemberMeta & { key: string; me: boolean; progress: Progress | null }`; functions `parseMeta(raw: unknown): MemberMeta | null` (nick 1–24 characters after trim; `fp` empty or 1–16 lowercase hex; `len` an integer from 0 to 1e9), `parseProgress(raw: unknown): Progress | null` (a page within 1..total with total ≤ 100000, or an offset within 0..length with length ≤ 1e9; anything else null), `membersFromPresence(state: Record<string, unknown[]>, myKey: string, progress: Record<string, Progress>): Member[]` (latest valid entry per key, me first then by nickname), `sameDocument(a: Member, b: Member): boolean`, `shouldLeaveFullRoom(keys: string[], myKey: string, max?: number): boolean`, `formatPosition(doc: DocKind, p: Progress | null): string` (`p. 12 / 40`, `62%`, or empty), `createRateLimiter(minGapMs: number, now?: () => number): () => boolean` (true when allowed, and records the use).

- [ ] **Step 1: Write the failing tests.** `roomCode.test.ts`: generated codes are 6 characters from the alphabet and never contain `0 O 1 I L`; `generateRoomCode(() => 0)` is `AAAAAA`; `parseRoomCode('owl-4f2k9x')`, `' 4F2 K9X '` and `'4F2K9X'` all give `4F2K9X`; `'4F2K9'`, `'4F2K9XX'`, `'4F2K9O'`, `''` give null; `roomCodeFromHash('#room=4f2k9x')` is `4F2K9X` and `'#other'` is null; `roomLink('4F2K9X', 'https://x.app/read#old')` is `https://x.app/read#room=4F2K9X`. `nickname.test.ts`: two seeds give different nicknames, the nickname stays the same across calls with one storage, `rerollNickname` changes the stored one, a storage whose methods throw still returns a nickname. `roomModel.test.ts`: `parseMeta` accepts a good payload and rejects a nick of 25 characters, `doc: 'epub'`, `fp: 'xyz'`, `len: -1`; `parseProgress` rejects `{page: 99, total: 40}`, `{offset: 5, length: 3}`, `{page: NaN, total: 4}` and a total of 1e9; `membersFromPresence` ignores invalid entries, keeps the latest entry per key and puts me first; `sameDocument` is true only when both `fp` are non-empty and equal and `len` is equal (and false for two PSDs with empty `fp`); `shouldLeaveFullRoom` keeps the 8 smallest keys and is false for 8 or fewer, in any input order; `formatPosition('pdf', {page: 12, total: 40})` is `p. 12 / 40`, `('text', {offset: 620, length: 1000})` is `62%`, `('psd', null)` is empty; the rate limiter allows the first call, refuses another within the gap and allows it after.
- [ ] **Step 2: Run** `npx vitest run src/features/rooms`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules to the interfaces above. Node tests only; no DOM.
- [ ] **Step 4: Run** the same command plus `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: room codes, nicknames and the room model` (include this plan and the spec correction).

### Task 2: Document fingerprint

**Files:**
- Create: `src/features/rooms/fingerprint.ts`, `src/features/rooms/fingerprint.test.ts` (first line `// @vitest-environment node`)

**Interfaces — Produces:** `fingerprintBlob(blob: Blob): Promise<string>` — 16 lowercase hex characters.

- [ ] **Step 1: Write the failing tests.** Same bytes give the same value; a copy with one byte changed in the first 64 KB, in the middle and in the last 64 KB each gives a different value; a different size with identical sampled bytes gives a different value; an empty blob and a 10-byte blob return 16 hex characters; for a 5 MB blob the function calls `slice` three times and no slice is longer than 65536 bytes.
- [ ] **Step 2: Run** `npx vitest run src/features/rooms/fingerprint.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with `crypto.subtle.digest('SHA-256', …)` over the size (as text) followed by the three slices; return the first 8 digest bytes as hex.
- [ ] **Step 4: Run** the test and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: fingerprint a document by size and sampled bytes`.

### Task 3: The room hook

**Files:**
- Create: `src/features/rooms/useRoom.ts`, `src/features/rooms/useRoom.test.ts`

**Interfaces — Consumes:** Task 1 (`roomChannelName`, `generateRoomCode`, `parseRoomCode`, `sessionNickname`, `rerollNickname`, the model functions and constants), `nextBackoffMs` from `src/features/presence/presence.ts`, `getSupabase` from `src/features/presence/supabase.ts`.
**Produces:**
```ts
export type RoomPhase = 'idle' | 'joining' | 'joined' | 'full' | 'busy' | 'reconnecting';
export interface RoomLocal { doc: DocKind; fp: string; len: number; progress: Progress | null }
export interface RoomTimer { durationMs: number; endsAt: number }   // endsAt on the local clock
export interface RoomNudge { id: number; from: string; emoji: string }
export interface RoomState { phase: RoomPhase; code: string | null; myKey: string; nick: string; members: Member[]; timer: RoomTimer | null; timerDone: boolean; nudges: RoomNudge[] }
export interface RoomControls { create(): void; join(code: string): void; leave(): void; startTimer(minutes: 15 | 25 | 45): void; stopTimer(): void; sendNudge(emoji: string): void; rerollNick(): void }
export function useRoom(local: RoomLocal, deps?: { getClient?: () => SupabaseClient | null; now?: () => number; storage?: Pick<Storage, 'getItem' | 'setItem'> }): RoomState & RoomControls
```
Broadcast payloads all carry `key` (the sender's presence key). `timer` is `{ key, durationMs, remainingMs? }` (stopping a timer is local to the person who stops it, so there is no stop message); `nudge` is `{ key, emoji }`; `progress` is `{ key, ...Progress }`; `hello` is `{ key }`.

- [ ] **Step 1: Write the failing tests** over a fake client shaped like `usePresence.test.ts`'s (add `send`, a way to deliver a broadcast, and `presenceState`). Each as its own test: with no client the phase stays `idle` and `join` does nothing; `create` joins a channel named `nightowl-room:<generated code>`; the presence payload has exactly the keys `nick, doc, fp, len, status`; members come from presence sync, me first; a change of `local` (another document, then none) re-tracks presence and clears my progress; progress is sent once immediately, not again within 10 s, not at all when unchanged, and again after the gap when it changed; an incoming `hello` makes me send my progress once and, if my timer runs, a `timer` with `remainingMs`; a joiner sends `hello` once after subscribing; `startTimer(25)` broadcasts and sets `timer`, my status becomes `focus`, and when the countdown ends `timerDone` is true; an incoming `timer` sets `endsAt = now() + durationMs` (or `remainingMs`), a later one replaces it, `stopTimer` clears it on this device only and sends nothing; nudges from others appear in `nudges`, a second one from the same sender within 3 s is dropped, my own `sendNudge` is limited to one per 3 s and only to the four allowed emoji; with 9 present and my key sorting last the phase becomes `full` and the channel is removed, while a key that sorts first stays; subscribe errors before ever joining give `busy`, after joining give `reconnecting` and a rejoin with backoff that leaves one entry per key; `leave` removes the channel and resets state; payloads with wrong types, a `key` that is not a string, an unknown `emoji`, or a progress past its total are ignored; no input for 2 minutes makes my status `away` and any input restores it.
- [ ] **Step 2: Run** `npx vitest run src/features/rooms/useRoom.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `useRoom`. Follow `usePresence.ts` for the channel lifecycle (forget the channel before `removeChannel` so the CLOSED it causes is not a failure, backoff retry, `online`/`offline` window events) and `createThrottledTracker` in `presence.ts:34` for presence updates (a typed twin of it is fine). Broadcast with `self: false`; every incoming payload goes through the Task 1 parsers.
- [ ] **Step 4: Run** the test, `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: join a reading room, share progress, a timer and nudges`.

### Task 4: Exact text positions in the reader

**Files:**
- Create: `src/features/reader/textPosition.ts`, `src/features/reader/textPosition.test.ts`
- Modify: `src/features/reader/ReaderCanvas.tsx`, `src/features/reader/ReaderCanvas.test.tsx`

**Interfaces — Produces:**
- `textPosition.ts`: `rangeAtOffset(root: HTMLElement, offset: number): Range | null` (walks text nodes, counting characters, so it works across Bionic `<strong>` splits and highlight `<mark>`s), `topOffset(scroller: HTMLElement, article: HTMLElement, margin?: number): number | null` (the character at the top of the screen: `caretRangeFromPoint` or `caretPositionFromPoint` when available, otherwise the start of the first `[data-start]` segment still on screen).
- `ReaderPosition` gains optional `offset?: number; length?: number` (text only). `ReaderHandle` gains `goToOffset(offset: number): void` (scrolls the text so that character sits just under the status line).

- [ ] **Step 1: Write the failing tests.** `rangeAtOffset` finds the right node and offset in plain text, in text split by `<strong>` (Bionic) and inside a `<mark>`, returns null past the end, and a range's `toString()` starts at that character; `topOffset` uses an injected caret function and falls back to the first on-screen segment when it is missing; in `ReaderCanvas.test.tsx`, scrolling a text document reports `offset` and `length` through `onPosition`, a PDF report is unchanged (no `offset`), and `goToOffset(n)` scrolls by the difference between that range's top and the scroller's top plus the margin.
- [ ] **Step 2: Run** `npx vitest run src/features/reader`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers and the ReaderCanvas changes (report in the existing text `onScroll`; `goToOffset` in the imperative handle).
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS (existing reader tests unchanged).
- [ ] **Step 5: Commit** `feat: report and jump to an exact spot in a text document`.

### Task 5: The Rooms panel

**Files:**
- Create: `src/features/rooms/RoomPanel.tsx`, `src/features/rooms/RoomPanel.test.tsx`

**Interfaces — Consumes:** Tasks 1 and 3 (`RoomState & RoomControls`, `Member`, `formatPosition`, `sameDocument`, `formatRoomCode`, `roomLink`, `parseRoomCode`), `SHEET_LAYOUT` and `SheetHandle` from `src/features/shell`.
**Produces:**
```ts
export type JumpTarget = { kind: 'page'; page: number } | { kind: 'offset'; offset: number; length: number };
export interface RoomPanelProps {
  room: RoomState & RoomControls;
  online: boolean;
  me: JumpTarget | null;                 // where I am now, for "Back to"
  onGoTo(target: JumpTarget): void;
  pendingCode?: string | null;           // from a #room= link: ask before joining
  onPendingHandled(): void;
  onClose(): void;
}
```

- [ ] **Step 1: Write the failing tests** (jsdom, `setMedia` for narrow). Offline shows "Rooms need a connection" and no controls; not in a room: a Create button and a code box, nickname with a re-roll button; a messy code (`' owl-4f2 k9x '`) joins with `4F2K9X`, a bad one shows "That code does not look right." and joins nothing; `pendingCode` shows "Join room OWL-4F2K9X?" with Join and Not now, joining only on Join; phases show "Joining…", "This room is full", "This room is busy, try again in a moment", "Reconnecting…"; in a room: the code in `OWL-…` form, a Copy link button that copies `roomLink(...)`; one row per member showing nickname, type and `formatPosition`, my row marked "You"; a nickname containing `<b>x</b>` renders as plain text; a member with the same document shows "same document" and a Go to button for their position (`p. 12` or `62%`) calling `onGoTo`; after a jump a Back button ("Back to p. 7" / "Back to 41%") calls `onGoTo` with where I was and disappears, and also disappears when `me` moves away from the destination (a different PDF page, or a text offset more than 1500 characters off) or the document changes; no Go to for a member on a different document; timer buttons 15 / 25 / 45 start it, a running countdown shows with Stop, "Focus complete" shows when `timerDone`; four nudge buttons (👋 🔥 ☕ 🌙) call `sendNudge`; Leave calls `leave`; every button has a 44px class on narrow; the panel is `region` named "Rooms" with `SheetHandle` whose close calls `onClose`.
- [ ] **Step 2: Run** `npx vitest run src/features/rooms/RoomPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `RoomPanel` (a left drawer from `sm` up like the Library panel, `SHEET_LAYOUT` below). Rows wrap; the same-document label and the Go to / Back button sit on a second line.
- [ ] **Step 4: Run** the test and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: the Rooms panel`.

### Task 6: Wire rooms into the app

**Files:**
- Modify: `src/features/shell/ui.ts`, `src/features/shell/useExclusiveSheets.ts` (+ their tests), `src/features/shell/Rail.tsx` (optional `pulse` on a rail item), `src/app/App.tsx`, `src/app/commands.ts`, `src/app/App.test.tsx`, `src/app/commands.test.ts`

**Interfaces — Consumes:** Tasks 2–5, `usePresence`'s `status` (already in `App.tsx`).

- [ ] **Step 1: Write the failing tests.** `ui.ts`: `roomsOpen` exists, is false by default and is reset by `reset()`; `useExclusiveSheets` treats `roomsOpen` like the other sheets on a narrow screen; `commands.test.ts`: "Open rooms" always, "Leave room" only when `room.phase === 'joined'`; `App.test.tsx` (with `useRoom` and `fingerprintBlob` mocked): the Rooms rail button is disabled with "Rooms need a connection" in local mode and enabled when presence is online, opening it shows the panel, opening Library/Audio/Feedback closes it and the reverse, a `#room=4F2K9X` hash opens the panel with the join question and the hash is cleared afterwards, the document type, fingerprint (only while joined), length and progress are passed to `useRoom`, switching to another document updates them, and the rail item pulses when a nudge or "Focus complete" arrives while the panel is closed.
- [ ] **Step 2: Run** `npx vitest run src/app src/features/shell`. Expected: FAIL.
- [ ] **Step 3: Implement.** `Users` icon rail button; `RoomPanel` rendered with the app's position mapped to `RoomLocal` (a PDF sends `page` and `total`, a text file `offset` and `length`, a PSD only its type) and to `me`; the backdrop and `closeSheets` include `roomsOpen`; the fingerprint is computed in an effect keyed by document id and cached.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add Rooms to the app`.

### Task 7: Browser checks and wrap-up

**Files:**
- Modify: `scripts/e2e/run.mjs` (a `rooms` group), `STATUS.md`

- [ ] **Step 1: Add the `rooms` group** using two browser contexts (desktop 1280 and phone 360×800 touch) against the live connection; each check returns "skipped" when presence does not connect. Checks: A creates a room and shows `OWL-` and a code; B opens `#room=<code>` and is asked before joining, then joins; both list two members; A and B import the same article PDF and see "same document"; A moves to page 3 and within 15 s B's row shows `p. 3`; B taps Go to and lands on page 3, then Back returns; a nudge from A shows in B and the rail pulses with the panel closed; A starts the 15-minute timer and B shows a countdown within 5 s; the phone rows stay inside 360px; A leaves and disappears from B; a ninth context is told the room is full (skip if the connection limit stops the test). Read the screenshots.
- [ ] **Step 2: Run** `npm run e2e -- phone rooms`. Expected: PASS. Fix the product or the check, whichever is wrong, and say which.
- [ ] **Step 3: Update STATUS.md** (a "Reading rooms" entry with counts, what is open) and run the complete verification: `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e -- --build`. Expected: all pass, zero CSP violations.
- [ ] **Step 4: Commit** `docs: update status for reading rooms`. Push `feat/reading-rooms`, then stop and report.
