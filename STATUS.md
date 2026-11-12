# NightOwl Reader: build status

Updated 2026-11-12. Work is on branch `feat/@@@`; `main` is untouched.

- Spec: `docs/superpowers/specs/@@@-design.md`
- Plan (32 tasks): `docs/superpowers/plans/@@@.md`
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

## Next

1. A whole-branch code review, then decide whether to merge `feat/nocturne-rebuild` into `main`.
2. Optional: host `lofi.mp3`, `rain.mp3`, `pink.mp3` and set `VITE_AUDIO_CDN_BASE`; add Sufi or YouTube presets.

## Resuming

- Run with `npm install`, then `npm run dev`. Tests: `npm test`. Browser checks: `npm run e2e` (uses the installed Edge or Chrome).
- A local, git-ignored ledger of per-task results and decisions is at `.superpowers/sdd/@@@/progress.md`. If it is missing, go by this file and `git log`.
- Storage tests run in the node environment with `fake-indexeddb`; app-level tests use the in-memory fakes in `src/test/fakes.ts`.
- Still needed from the owner: Supabase URL and anon key (Task 31); optional audio files and playlist links (Tasks 21, 24).
