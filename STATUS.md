# NightOwl Reader: build status

Updated 2026-11-20. Everything described below is merged into `main` and is what runs at https://nightowl-mauve.vercel.app. Until a CI workflow is merged, every test and browser-check number in this file is self-reported from a local run, recorded when that work finished.

| Pull request | Merged | What |
| --- | --- | --- |
| #1, #2 | 2026-11-11, 2026-11-12 | The rebuild of the prototype into this app (all 32 plan tasks) |
| #3 | 2026-11-13 | The mobile pass (phases 1–4) and the mobile polish that followed it |
| #4 | 2026-11-16 | The UI refresh: a paper theme, new design tokens, restyled panels |
| #5 | 2026-11-16 | PDF Reflow, the tappable reader count and Reading rooms (three stacked branches in one PR) |

- Spec: `docs/superpowers/specs/2026-11-11-nocturne-reader-design.md`
- Plan (32 tasks): `docs/superpowers/plans/2026-11-11-nocturne-reader.md`
- Method: one task at a time, tests first, one commit per task.

## Done (history; the numbers are the ones recorded when each phase finished)

- **Phase 1, Tasks 1–8:** project scaffold, design tokens and themes, Scrubber slider, idle fade, hotkeys and command palette, text reader (bionic, focus ruler, read aloud, auto-scroll), app shell.
- **Phase 2, Tasks 9–13:** IndexedDB schema, preferences, LRU eviction, library import/open/delete/usage, reading progress, bookmarks, library panel, drag-and-drop import, storage panel, saved settings, PWA (service worker, manifest, icons). Checked in a browser: imports survive a reload and the app starts and opens documents with the network off.

- **Phase 3, Tasks 14–19:** PDF viewer (lazy pages, selectable text, night pages, saved position), PSD layer inspector with live composite, text highlights with notes, validated imports with plain error messages, per-type viewer routing.

- **Phase 4, Tasks 20–22:** ambient audio engine (Lo-Fi, Rain, Pink Noise synthesized in the browser, optional streamed files with fallback), sleep timer with fade, audio panel with live waveform and LED, `A` and `Ctrl/Cmd+M` hotkeys.

- **Phase 5, Tasks 23–30:** music dock along the bottom with four sources (Night Noise, Spotify, YouTube, My Tracks), category tabs (English Focus, Hindi / Bollywood Chill, Instrumental & Classical, Nature & White Noise), pasted Spotify/YouTube links, uploaded .mp3/.aac and https streams, shared sleep timer, and a strict Content-Security-Policy (no ad, tracking or analytics scripts can load).

At the last commit: 531 unit tests pass, typecheck is clean, and `npm run e2e -- --build` passes 28 checks against the production build with zero CSP violations, including live Spotify and YouTube embeds.

**Known limits:** Spotify plays in its own embedded player (play, pause and seek happen there, not in the dock), because Spotify's scripting API needs `eval()`, which the security policy blocks. Without a Spotify login it plays 30-second previews. No Sufi or YouTube preset could be confirmed, so those come from pasted links.

- **Phase 6, Tasks 31–32:** live reader count via Supabase presence (verified live with your project: 1 tab shows "1 online", 2 tabs both show "2 online"), local mode without keys, prototype removed, README written.

**Final check:** 555 unit tests pass, typecheck and build are clean, and `npm run e2e -- --build` passes 34/34 browser checks against the production build with zero CSP violations and no page errors. Covered: real PDF/PSD files, refused corrupt files, idle fade, palette, offline reload, uploaded track playing offline, live Spotify and YouTube embeds, ambient audio, live presence.

## Mobile pass, phases 1–4 (PR #3)

Spec: `docs/superpowers/specs/2026-11-13-mobile-responsive-design.md`. Plan: `docs/superpowers/plans/2026-11-13-mobile-responsive-phases-1-4.md` (6 tasks, one commit each, tests first).

- **Hover strip:** the Tuning panel's edge strip exists only on devices with hover and a fine pointer, so a touch on the right edge no longer opens it. The old bug was reproduced on an emulated phone first.
- **Bottom sheets:** below 640px, Tuning, Library and Audio are full-width sheets (at most 75% of the screen, above the dock) with a grab handle, a 44px close button, swipe-down and tap-outside to dismiss, and one open at a time. From 640px up they are the same side drawers as before.
- **Zoom control:** floating − / + buttons (44px targets on a phone) over the reading area, tied to the Zoom setting, with a reset to 100%.
- **PDF gating:** while a PDF is open, Bionic reading and the dyslexia-friendly font are disabled with the reason shown (rail button, Tuning toggle, `Ctrl+B`, command palette, status flag). Saved settings are kept, so they apply again on the next text document.

**Verified:** 639 unit tests, typecheck and build clean, and `npm run e2e -- --build` passes 55/55 against the production build with zero CSP violations (the two console errors listed are from the offline test switching the network off). 19 of those checks run on an emulated 375×667 touch phone (no hover); screenshots of each sheet, the zoom control and the PDF states were read by eye.

**Phase 5 (PDF Reflow) was built afterwards, see below. Phase 6 (in-document search) is not built.**

**Found, not fixed (out of scope):**

- PDF overflow on phones, the missing status-line title, the cramped dock and the 32px rail buttons: fixed in the polish follow-up below.
- The disabled-control copy deliberately does not mention Reflow until that exists (reasons live in `src/features/reader/textStyling.ts`).
- The Feedback panel and the Browse-music panel are not sheets yet (not in the spec's list); both now fit beside the rail.
- A PSD ignores Bionic and the dyslexia font but its controls stay live; the spec gates PDFs only.
- While a sheet is open on a phone, its backdrop covers the rail, so switching panels takes one extra tap.

## Mobile polish (follow-up, also in PR #3)

Plan: `docs/superpowers/plans/2026-11-13-mobile-polish.md` (6 tasks). Prompted by screenshots from a 360×800 phone with a real PDF open.

- **PDF fits the screen:** on a narrow screen pages shrink to the width (never enlarged, so desktop is unchanged). Zoom is relative to that fit, and zooming or rotating keeps the same page and spot in view.
- **Status line:** the document title shows on a phone; the reader count is shortened and the state words are left to the rail's pressed buttons.
- **Music dock:** on a phone it keeps the title, previous/play/next and Browse (44px targets), with the sleep timer inside Browse and a countdown in the dock while it runs. Source buttons appear from 1024px, so Browse is no longer pushed off a tablet screen.
- **Rail and panels:** rail buttons are 44px on a phone and the rail scrolls when the screen is short; the Feedback and Browse panels fit beside the rail.

**Verified:** 665 unit tests, typecheck and build clean, and `npm run e2e -- --build` passes 63/63 against the production build with zero CSP violations. 8 new checks run on an emulated 360×800 touch phone (one at 768×1024); each was seen failing first, and the screenshots were read.

**Still open:** a fitted letter page on a phone renders at about half size, so small print is readable only zoomed in, panning sideways; Reflow (phase 5) is the real fix. Saved PDF positions are pixel offsets, so reopening at a different width lands slightly off.

## UI refresh (PR #4)

Made in a separate session. A `paper` theme joins Night, Sepia, OLED and Crimson; the design tokens in `src/design/tokens.css` were reworked and the panels restyled; the reader count reads "N reading now" (the per-document breakdown was a tooltip, made tappable in PR #5). Two behaviours changed: the chrome layer forwards the mouse wheel to the reader when nothing under the pointer can scroll that way, and the side panels on desktop end above the music dock like the phone sheets. When it was committed, 665 unit tests passed and the typecheck was clean (checked before it went in); the browser suite's presence checks were updated for the new wording.

## PDF Reflow, phase 5 (PR #5)

Plan: `docs/superpowers/plans/2026-11-15-pdf-reflow.md` (8 tasks, one commit each, tests first). Merged in PR #5, built on top of the UI refresh (PR #4).

- **Reflow view:** a Pages / Reflow button in the status line switches a PDF to one readable text column. PDFs open in Pages; each PDF remembers its view and its reflow position. Hyphenated words are joined, repeated headers, footers and page numbers are dropped, and a "Page N" divider (not part of the text) marks each page.
- **Reading settings apply:** font size, line spacing, Bionic reading and the dyslexia font work in Reflow (still disabled in Pages, with the reason); read-aloud speaks the reflowed text; switching views keeps your page.
- **Scanned PDFs:** with no text to reflow, the PDF stays on Pages, a notice says why, and the switch is dimmed.
- **Reader count:** tapping it opens a small panel ("N reading PDFs / PSDs / text"), so the room breakdown works on touch; the tooltip stays for the mouse.
- **Bug fixed on the way:** the progress hook briefly handed a document the previous document's saved position and view.

**Verified:** 732 unit tests, typecheck and build clean, and `npm run e2e -- --build` passes 67/67 against the production build with zero CSP violations. Five new checks run on an emulated 360×800 touch phone (an article-style PDF and a scanned one); screenshots were read.

**Known limits:** tables come out as plain lines; Pages mode reports page N-1 at the very end of a short last page (pre-existing).

## Reading rooms (PR #5)

Spec: `docs/superpowers/specs/2026-11-16-reading-rooms-design.md`. Plan: `docs/superpowers/plans/2026-11-16-reading-rooms.md` (7 tasks, one commit each, tests first, plus one fix found on the way).

- **Rooms button** (rail; a bottom sheet on a phone, a drawer on desktop). Create a room and get a code like `OWL-4F2K9X`, or join by typing a code or opening a `#room=CODE` link (it asks first, never joins silently). Up to 8 people. No accounts, no chat: each tab gets a random owl nickname.
- **Who is in:** nickname, document type, position (`p. 12 / 40` for a PDF, `62%` for text) and status (reading, focus, away after 2 minutes without input).
- **Same document:** each app shares only a short fingerprint of the open file (size plus the first, middle and last 64 KB), never a name. When two people have the same file, a row says "same document as you" with **Go to p. 12** (or **Go to 62%**, to the exact character) and then **Back to p. 7**.
- **Focus timer** (15 / 25 / 45 minutes, counted down on each device; Stop affects only your own screen) and four emoji nudges (👋 🔥 ☕ 🌙). A nudge or a finished timer pulses the Rooms button while the panel is closed. No sound.
- **Free tier:** one Realtime channel per room on the connection the reader count already uses; progress is sent at most every 10 seconds and only when it changed, nudges at most every 3 seconds. Rooms are disabled with "Rooms need a connection" in local mode.
- **Fix found on the way:** a text file's exact position used the browser's "what is under this point" lookup, which on a phone returns the sheet's backdrop, so a reader with the Rooms sheet open would have reported position 0. It now measures the text's own boxes.

**Verified:** 867 unit tests, typecheck and build clean, and `npm run e2e -- --build` passes 77/77 against the production build with zero CSP violations. The `rooms` browser group runs a desktop and a 360×800 phone in one room against the live connection (create, join by link, same long text file with an exact jump and Back, same PDF with Go to and Back, nudge pulse, timer, layout inside 360px, leaving); it reports "skipped" when the connection cannot be made. Screenshots were read.

**Known limits:** same-document detection matches identical copies only (a re-saved PDF will not match); the ninth-member rule is unit-tested but not exercised in a browser; Pages mode still counts the page above when a short last page cannot scroll to the top (pre-existing).

## Next

1. **Review the open pull requests from the 2026-11-20 audit**, each separate and none merged automatically: the Reflow running-header fix with a real-PDF browser check, in-document search (phase 6 of the mobile design), a CI workflow, and this status fix.
2. **Delete the merged remote branches** once the owner agrees: `feat/nocturne-rebuild`, `feat/mobile-responsive`, `feat/ui-refresh`, `feat/pdf-reflow-v2`, `feat/reading-rooms`, and the superseded `feat/pdf-reflow` (an earlier copy of three Reflow commits that were rebased into `feat/pdf-reflow-v2`; `git cherry` shows an equivalent of each on `main`).
3. **Small follow-ups, any order:** make the Browse and Feedback panels real bottom sheets on a phone; stop showing Bionic reading and the dyslexia font as live on a PSD, where they do nothing; save a PDF's position as page plus spot (it is a pixel offset, so reopening at another width lands slightly off); Pages mode counts the page above when a short last page cannot scroll to the top; on a phone a sheet's backdrop covers the rail, so switching panels takes an extra tap.
4. **Optional:** host `lofi.mp3`, `rain.mp3`, `pink.mp3` and set `VITE_AUDIO_CDN_BASE`; add Sufi or YouTube presets.


## Resuming

- Run with `npm install`, then `npm run dev`. Tests: `npm test`. Browser checks: `npm run e2e` (uses the installed Edge or Chrome, headless); `npm run e2e -- --build` runs the production build with its Content-Security-Policy, and `npm run e2e -- <group>` runs one group. The presence and rooms groups need the git-ignored `.env` with the Supabase keys, the suite starts a server on port 5199 (so it must be free), and it uses live Spotify and YouTube embeds, so it depends on the network.
- Per-plan ledgers of results and decisions (git-ignored, so they exist only on the machine and worktree that ran the plan) are under `.superpowers/sdd/<plan-name>/progress.md`. If one is missing, go by this file, the plans and specs under `docs/superpowers/`, and `git log`.
- Code is organised by feature under `src/features/` (see the README's Project layout). The plan and spec mention the older `src/components`, `src/hooks`, `src/lib` paths; those files now live in their feature folder.
- Storage tests run in the node environment with `fake-indexeddb`; app-level tests use the in-memory fakes in `src/test/fakes.ts`.
- Environment: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (live reader count and rooms; without them the app runs in local mode and Rooms is disabled) and `VITE_FEEDBACK_KEY` (the feedback form) must be set in Vercel for production and for previews, and in `.env` locally; `VITE_AUDIO_CDN_BASE` is optional.
