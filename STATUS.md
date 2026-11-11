# Nocturne Reader: build status

Updated 2026-11-12. Work is on branch `feat/nocturne-rebuild`; `main` is untouched.

- Spec: `docs/superpowers/specs/2026-11-11-nocturne-reader-design.md`
- Plan (32 tasks): `docs/superpowers/plans/2026-11-11-nocturne-reader.md`
- Method: one task at a time, tests first, one commit per task.

## Done

- **Phase 1, Tasks 1–8:** project scaffold, design tokens and themes, Scrubber slider, idle fade, hotkeys and command palette, text reader (bionic, focus ruler, read aloud, auto-scroll), app shell.
- **Phase 2, Tasks 9–11:** IndexedDB schema, preferences, LRU eviction, library import/open/delete/usage, reading progress, bookmarks.
- **Task 12 (code and tests):** library panel, drag-and-drop import, storage panel, saved settings, progress and bookmark hooks.

At the last commit: 193 tests pass, typecheck and production build are clean.

## Next

1. **Task 12, step 4:** check in a browser that an imported `.txt` survives a reload and the storage figure updates. Then record Task 12 as done.
2. **Task 13:** PWA and offline start.
3. **Tasks 14–19:** PDF viewer, PSD inspector, text highlights, validated imports.
4. **Tasks 20–22:** audio engine. **23–30:** music dock and CSP. **31:** presence. **32:** remove the prototype, write the README, final check.

## Resuming

- Run with `npm install`, then `npm run dev`. Tests: `npm test`.
- A local, git-ignored ledger of per-task results and decisions is at `.superpowers/sdd/2026-11-11-nocturne-reader/progress.md`. If it is missing, go by this file and `git log`.
- Storage tests run in the node environment with `fake-indexeddb`; app-level tests use the in-memory fakes in `src/test/fakes.ts`.
- Still needed from the owner: Supabase URL and anon key (Task 31); optional audio files and playlist links (Tasks 21, 24).
