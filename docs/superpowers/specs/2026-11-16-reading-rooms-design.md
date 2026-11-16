# NightOwl Reader — Reading Rooms (Design)

Date: 2026-11-16
Status: Draft for approval
Source: the community / social-reading idea from the readers' WhatsApp feedback (parked in the mobile spec's non-goals), picked up now. The owner chose approach B below.

## 1. Intent

Night readers study and read alone. A room lets a few people read **alongside** each other: see who else is in, how far along they are, and share a focus timer. The point is quiet accountability ("three of us are reading right now"), not conversation. Nothing about it may get in the way of reading.

**Goals**
- Create a room and get a short code; join by typing the code or opening a link; leave at any time.
- See each member: a random owl nickname, the kind of document open (PDF / PSD / text), progress (page of total), and a status (reading, in focus, away).
- **Same document:** when two members have the same file open, their rows say "same document" and a **Go to their page** button jumps your view to where they are (once, on tap; it never follows or moves your screen by itself). Titles are never shared, so this works without them.
- **Back to where you were:** after a jump, a **Back to p. 7** button (or "Back to 41%") appears on that row until you use it, scroll on, or open another document; it returns you to the spot you left.
- A shared focus timer (15, 25 or 45 minutes) that anyone in the room can start; everyone sees the same countdown.
- A few fixed emoji nudges (👋 🔥 ☕ 🌙) that appear briefly for everyone.
- Works on a phone (bottom sheet) and on desktop (side panel), with 44px touch targets on a phone.
- Rooms are unavailable, with a visible reason, when offline or in local mode.

**Non-goals**
- Accounts, friends lists, persistent rooms, room history, a public room directory.
- Free-text chat, voice or video. (No text a stranger can type means nothing to moderate.)
- Sharing documents, shared scrolling, "follow the host".
- Notifications outside the app.

**Anti-goals** (failure even if it technically works)
- Anything that pops over the text, plays a sound or steals focus while someone reads.
- Sending anything identifying: file names, document text, or a stable user id.
- A room code that can be guessed by trying a few.

## 2. Constraints

- **No new runtime dependency.** `@supabase/supabase-js` is already used for the reader count (`src/features/presence`). Rooms reuse `getSupabase`, `createThrottledTracker` and `nextBackoffMs`.
- **Supabase free tier** (docs, 2026-11): 200 concurrent connections, 100 messages/second, 20 presence messages/second, 5 presence calls per client per 30 seconds, 256 KB broadcast payload, 100 channels per connection. The room channel shares the one websocket the reader count already opens, so rooms add no connections. Presence is therefore used only for who is in and their status; frequent updates go over Broadcast, throttled.
- **Documents stay on the device.** Only the small facts listed under Goals are shared.
- **Ephemeral.** No database, no tables: a room exists while someone is in it.
- Follows the project's method: tests first, one commit per task, browser checks in the `phone` group (360×800) plus a two-browser room check, STATUS.md updated.

## 3. Approaches considered

- **A. Document-type lounges.** Make the existing PDF / PSD / Text groups joinable lists. Cheapest, but nothing to do inside; adds little over the tappable reader count.
- **B. Reading rooms by code (chosen).** Described in this document. Fits the night-study idea, reuses the presence code, keeps files local, free tier.
- **C. Shared reading.** A host's position drives everyone. Needs the document uploaded for others to read: storage limits, copyright exposure, and it breaks the "your files stay on your device" promise. Ruled out.

## 4. The design (approach B)

**Joining.** A "Rooms" button on the rail (users icon) opens the Rooms panel: a bottom sheet below 640px (existing `SHEET_LAYOUT`, `SheetHandle`, `useExclusiveSheets`), a side drawer above. Not in a room, it offers "Create a room" and a code box. A link `…/#room=OWL4F2K` opens the app and offers to join (it asks first; it never joins silently). The code lives in the URL hash, which is not sent to any server.

**Codes.** 6 characters from a 31-character alphabet without look-alikes (no 0/O/1/I/L), shown as `OWL-4F2K`; about 887 million combinations. The channel is `nightowl-room:<code>`.

**Members and size.** At most 8 per room; a full room says so. Each tab gets a random owl nickname (a word list, e.g. "Quiet Owl", "Night Heron") kept for the browser session, with a re-roll button before joining. The nickname is never typed by anyone.

**What is sent.**
- Presence (changes rarely, within the 5-per-30-seconds limit, via the existing throttled tracker): `{ nick, doc: 'pdf'|'psd'|'text'|'none', fp, status: 'reading'|'focus'|'away' }`. `away` after 2 minutes without input. `fp` is the document fingerprint (below), or empty when nothing is open.
- Broadcast: `progress { page, total, offset, length }` at most once per 10 seconds and only when it changed (`page` and `total` are PDF pages; for a text file `offset` and `length` are characters); `timer { durationMs }` when someone starts or stops it; `nudge { emoji }` limited to one per 3 seconds per sender.
- Nothing else. Never a file name, never text, never an id beyond the random per-session key.

**Same document.** Each app computes a short fingerprint of the open file: a SHA-256 over the file size plus its first, middle and last 64 KB, cut to 16 hex characters (fast even for a large PSD). Two members count as being on the same document only if the fingerprint **and** the document's page count (PDF) or length (text) both match, which makes a chance match between different files very unlikely. This recognises identical copies, such as the same download; a re-saved or edited copy has a different fingerprint and will not match, and its rows simply show page numbers without the jump. It is computed only while in a room, cached per document, and shared in presence. Two members with the same fingerprint are "on the same document". The fingerprint cannot be turned back into the file or its name, though someone who already holds the same file can tell that it matches; that only happens inside a room you chose to join.

**How position is shown and followed.** A PDF shows `p. 12 / 40`; the page number is the PDF's own, identical in Pages and Reflow and on every device. A text file shows a percentage (`62%`), but what is shared is the exact character position at the top of the reader's screen (the reader already tracks text by character position for highlights), because a text "page" is a screenful and differs between a phone and a desktop. **Go to their page** jumps a PDF to that page and a text file to that exact spot, scrolled into view. It changes your view once, and only when you tap; afterwards **Back to p. 7** (or "Back to 41%") returns you to where you were.

**Rows on a narrow screen.** A row is one line (nickname, type, position, status) that wraps instead of truncating; the "same document" label and the Go to / Back button sit on a second line, each button at least 44px tall. It must hold up with large system text, and the list scrolls inside the sheet.

**Focus timer.** Anyone starts 15, 25 or 45 minutes; the starter's message carries the duration and every client counts down locally from when it receives it (a second or two of drift is fine). A late joiner is told the remaining time by a member. When it ends, members see a quiet "Focus complete" line in the panel and the rail button; no sound. Starting a new one replaces the old. Anyone can stop it for themselves.

**Nudges.** The four emoji float briefly in the panel and give the rail button a short pulse when the panel is closed. They never cover the reading area.

**Offline and limits.** Without a connection, or in local mode, the Rooms button is disabled with the reason "Rooms need a connection". If Supabase refuses (a limit, a full room) the panel says "This room is busy, try again in a moment" instead of failing silently. Leaving, closing the tab or losing the connection removes the member; a room with no one in it simply no longer exists.

**Sketch (phone sheet)**
```
Room  OWL-4F2K   [copy link]            ✕
------------------------------------------
Quiet Owl      PDF   p. 12 / 40   reading
  same document as you   [ Go to p. 12 ]
Night Heron    text  62%          reading
You            PDF   p. 7 / 40    focus
------------------------------------------
Focus  [ 15 ] [ 25 ] [ 45 ]     18:00 left
[ 👋 ] [ 🔥 ] [ ☕ ] [ 🌙 ]      [ Leave ]
```

**Where it lives.** New `src/features/rooms/`: pure helpers (code generation and parsing, nickname list, member summary, rate limits) with node tests; a `useRoom` hook over a fake Realtime channel in tests; `RoomPanel`. Also `src/features/rooms/fingerprint.ts` (the file fingerprint), and in the reader an `offset` and `length` on `ReaderPosition` (the character at the top of a text file's screen, found with the existing `offsetsFromRange` helper) plus `ReaderHandle.goToOffset` (`ReaderCanvas.tsx`, building on `goToHighlight`) to follow a text file, and a remembered pre-jump position for the Back button. Touches `src/features/shell/ui.ts` (a `roomsOpen` panel flag), `useExclusiveSheets.ts`, `src/app/App.tsx` (rail item, panel, hash join, progress and document type feed), `src/app/commands.ts` ("Open rooms", "Leave room") and the e2e suite.

## 5. Left to the builder

Exact word lists and copy; timing constants within the limits above; how a late joiner learns the others' progress and the running timer (a "hello" that members answer is one way); visual polish of the member list and the nudge animation; the e2e arrangement for two browsers.

## 6. Calls made without the owner (please check)

1. No chat of any kind, only four fixed emoji.
2. Room size 8, to stay inside the free tier's 100 messages/second with several busy rooms.
3. Codes of 6 characters, join by code or a hash link, always confirmed before joining.
4. Random nicknames, not editable except a re-roll; no accounts.
5. Progress shown as page / total for PDFs and a percentage for text files (screenful pages differ between devices), at most once per 10 seconds.
11. Same-document detection uses a 16-character fingerprint of size plus the first, middle and last 64 KB (and also requires the same page count or length), not a full-file hash, so it stays fast for large files. It matches identical copies only. Titles are never shared and there is no title switch: the owner picked same-file detection only.
6. Timer lengths 15 / 25 / 45 minutes; local countdown; no sound.
7. Rooms vanish when empty; nothing is stored.
8. Rooms are off when offline, with the reason shown.
10. The 8-member cap is checked after joining: if more than 8 are present, the members whose random keys sort last leave with "This room is full", so two simultaneous joiners cannot both stay. Two people starting the timer together: the later message wins. "In focus" simply means a timer is running.
9. Rooms sit on top of the Reflow and UI-refresh branches (rail, status line and sheets are shared), so they merge after those. Because the branch is stacked on them, the whole feature can be built and checked end to end now; only the merge order waits.
12. A **Back to p. 7** button after a jump, so a peek ahead never loses your place (from an outside review of this design).
13. Text jumps use the exact character position, not a percentage of the scroll height.

## 7. Possible later (not in this project)

- A quiet cue when everyone in the room has reached the same page.
- A content-based fingerprint (from the PDF's text) so a re-saved copy of the same book still matches.
