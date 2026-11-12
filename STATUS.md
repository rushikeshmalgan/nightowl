# Nocturne Reader: build status

Updated 2026-11-12. Work is on branch `feat/nocturne-rebuild`; `main` is untouched.

- Spec: `docs/superpowers/specs/2026-11-11-nocturne-reader-design.md`
- Plan (32 tasks): `docs/superpowers/plans/2026-11-11-nocturne-reader.md`
- Method: one task at a time, tests first, one commit per task.

## Done

- **Phase 1, Tasks 1–8:** project scaffold, design tokens and themes, Scrubber slider, idle fade, hotkeys and command palette, text reader (bionic, focus ruler, read aloud, auto-scroll), app shell.
- **Phase 2, Tasks 9–13:** IndexedDB schema, preferences, LRU eviction, library import/open/delete/usage, reading progress, bookmarks, library panel, drag-and-drop import, storage panel, saved settings, PWA (service worker, manifest, icons). Checked in a browser: imports survive a reload and the app starts and opens documents with the network off.

At the last commit: 194 tests pass, typecheck and production build are clean.

## Next

1. **Tasks 14–19:** PDF viewer, PSD inspector, text highlights, validated imports.
2. **Tasks 20–22:** audio engine.
3. **Tasks 23–30:** music dock and CSP.
4. **Task 31:** presence. **Task 32:** remove the prototype, write the README, final check.

## Resuming

- Run with `npm install`, then `npm run dev`. Tests: `npm test`.
- A local, git-ignored ledger of per-task results and decisions is at `.superpowers/sdd/2026-11-11-nocturne-reader/progress.md`. If it is missing, go by this file and `git log`.
- Storage tests run in the node environment with `fake-indexeddb`; app-level tests use the in-memory fakes in `src/test/fakes.ts`.
- Still needed from the owner: Supabase URL and anon key (Task 31); optional audio files and playlist links (Tasks 21, 24).
