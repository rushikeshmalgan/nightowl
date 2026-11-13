# NightOwl Reader: build status

Updated 2026-11-14. The rebuild is on `feat/nocturne-rebuild`; the mobile pass and its polish follow-up are on `feat/mobile-responsive` (branched from it, not pushed). `main` is untouched.

- Spec: `docs/superpowers/specs/2026-11-11-nocturne-reader-design.md`
- Plan (32 tasks): `docs/superpowers/plans/2026-11-11-nocturne-reader.md`
- Method: one task at a time, tests first, one commit per task.

## Done

- **Phase 1, Tasks 1–8:** project scaffold, design tokens and themes, Scrubber slider, idle fade, hotkeys and command palette, text reader (bionic, focus ruler, read aloud, auto-scroll), app shell.
- **Phase 2, Tasks 9–13:** IndexedDB schema, preferences, LRU eviction, library import/open/delete/usage, reading progress, bookmarks, library panel, drag-and-drop import, storage panel, saved settings, PWA (service worker, manifest, icons). Checked in a browser: imports survive a reload and the app starts and opens documents with the network off.

- **Phase 3, Tasks 14–19:** PDF viewer (lazy pages, selectable text, night pages, saved position), PSD layer inspector with live composite, text highlights with notes, validated imports with plain error messages, per-type viewer routing.

- **Phase 4, Tasks 20–22:** ambient audio engine (Lo-Fi, Rain, Pink Noise synthesized in the browser, optional streamed files with fallback), sleep timer with fade, audio panel with live waveform and LED, `A` and `Ctrl/Cmd+M` hotkeys.

- **Phase 5, Tasks 23–30:** music dock along the bottom with four sources (Night Noise, Spotify, YouTube, My Tracks), category tabs (English Focus, Hindi / Bollywood Chill, Instrumental & Classical, Nature & White Noise), pasted Spotify/YouTube links, uploaded .mp3/.aac and https streams, shared sleep timer, and a strict Content-Security-Policy (no ad, tracking or analytics scripts can load).

At the last commit: 531 unit tests pass, typecheck is clean, and `npm run e2e -- --build` passes 28 checks against the production build with zero CSP violations, including live Spotify and YouTube embeds.

**Known limits:** Spotify plays in its own embedded player (play, pause and seek happen there, not in the dock), because Spotify's scripting API needs `eval()`, which the security policy blocks. Without a Spotify login it plays 30-second previews. No Sufi or YouTube preset could be confirmed, so those come from pasted links.

- **Phase 6, Tasks 31–32:** live reader count via Supabase presence (verified live with your project: 1 tab shows "1 online", 2 tabs both show "2 online"), local mode without keys, prototype removed, README written.

**Final check:** 555 unit tests pass, typecheck and build are clean, and `npm run e2e -- --build` passes 34/34 browser checks against the production build with zero CSP violations and no page errors. Covered: real PDF/PSD files, refused corrupt files, idle fade, palette, offline reload, uploaded track playing offline, live Spotify and YouTube embeds, ambient audio, live presence.

## Mobile pass, phases 1–4 (branch `feat/mobile-responsive`)

Spec: `docs/superpowers/specs/2026-11-13-mobile-responsive-design.md`. Plan: `docs/superpowers/plans/2026-11-13-mobile-responsive-phases-1-4.md` (6 tasks, one commit each, tests first).

- **Hover strip:** the Tuning panel's edge strip exists only on devices with hover and a fine pointer, so a touch on the right edge no longer opens it. The old bug was reproduced on an emulated phone first.
- **Bottom sheets:** below 640px, Tuning, Library and Audio are full-width sheets (at most 75% of the screen, above the dock) with a grab handle, a 44px close button, swipe-down and tap-outside to dismiss, and one open at a time. From 640px up they are the same side drawers as before.
- **Zoom control:** floating − / + buttons (44px targets on a phone) over the reading area, tied to the Zoom setting, with a reset to 100%.
- **PDF gating:** while a PDF is open, Bionic reading and the dyslexia-friendly font are disabled with the reason shown (rail button, Tuning toggle, `Ctrl+B`, command palette, status flag). Saved settings are kept, so they apply again on the next text document.

**Verified:** 639 unit tests, typecheck and build clean, and `npm run e2e -- --build` passes 55/55 against the production build with zero CSP violations (the two console errors listed are from the offline test switching the network off). 19 of those checks run on an emulated 375×667 touch phone (no hover); screenshots of each sheet, the zoom control and the PDF states were read by eye.

**Phases 5–6 not started:** PDF reflow mode, in-document search.

**Found, not fixed (out of scope):**

- PDF overflow on phones, the missing status-line title, the cramped dock and the 32px rail buttons: fixed in the polish follow-up below.
- The disabled-control copy deliberately does not mention Reflow until that exists (reasons live in `src/features/reader/textStyling.ts`).
- The Feedback panel and the Browse-music panel are not sheets yet (not in the spec's list); both now fit beside the rail.
- A PSD ignores Bionic and the dyslexia font but its controls stay live; the spec gates PDFs only.
- While a sheet is open on a phone, its backdrop covers the rail, so switching panels takes one extra tap.

## Mobile polish (follow-up, same branch)

Plan: `docs/superpowers/plans/2026-11-13-mobile-polish.md` (6 tasks). Prompted by screenshots from a 360×800 phone with a real PDF open.

- **PDF fits the screen:** on a narrow screen pages shrink to the width (never enlarged, so desktop is unchanged). Zoom is relative to that fit, and zooming or rotating keeps the same page and spot in view.
- **Status line:** the document title shows on a phone; the reader count is shortened and the state words are left to the rail's pressed buttons.
- **Music dock:** on a phone it keeps the title, previous/play/next and Browse (44px targets), with the sleep timer inside Browse and a countdown in the dock while it runs. Source buttons appear from 1024px, so Browse is no longer pushed off a tablet screen.
- **Rail and panels:** rail buttons are 44px on a phone and the rail scrolls when the screen is short; the Feedback and Browse panels fit beside the rail.

**Verified:** 665 unit tests, typecheck and build clean, and `npm run e2e -- --build` passes 63/63 against the production build with zero CSP violations. 8 new checks run on an emulated 360×800 touch phone (one at 768×1024); each was seen failing first, and the screenshots were read.

**Still open:** a fitted letter page on a phone renders at about half size, so small print is readable only zoomed in, panning sideways; Reflow (phase 5) is the real fix. Saved PDF positions are pixel offsets, so reopening at a different width lands slightly off.

## Next

1. Decide whether to start mobile phase 5 (Reflow), the fix for reading small-print PDFs on a phone, and then phase 6 (in-document search).
2. A whole-branch code review, then decide whether to merge `feat/nocturne-rebuild` and `feat/mobile-responsive` into `main`.
3. Optional: host `lofi.mp3`, `rain.mp3`, `pink.mp3` and set `VITE_AUDIO_CDN_BASE`; add Sufi or YouTube presets.

## Resuming

- Run with `npm install`, then `npm run dev`. Tests: `npm test`. Browser checks: `npm run e2e` (uses the installed Edge or Chrome).
- A local, git-ignored ledger of per-task results and decisions is at `.superpowers/sdd/2026-11-11-nocturne-reader/progress.md`. If it is missing, go by this file and `git log`.
- Code is organised by feature under `src/features/` (see the README's Project layout). The plan and spec mention the older `src/components`, `src/hooks`, `src/lib` paths; those files now live in their feature folder.
- Storage tests run in the node environment with `fake-indexeddb`; app-level tests use the in-memory fakes in `src/test/fakes.ts`.
- Still needed from the owner: Supabase URL and anon key (Task 31); optional audio files and playlist links (Tasks 21, 24).
