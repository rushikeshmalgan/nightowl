# Nocturne Reader — Production Rebuild + UI Redesign (Design Spec)

Date: 2026-11-11
Status: Draft for review
Sources: `gemini-code-1794417242771.txt` (full-stack/production prompt), `gemini-code-1794417245922.txt` (UI redesign prompt), `nocturne_reader_night_document_platform.tsx` (current prototype). Added 2026-11-11 after the first draft: a music-streaming prompt pasted in chat, and the ad-free approach observed at deluxsalon.in (a YouTube IFrame API radio that carries no ads of its own).

## 1. Intent

Turn the single-file prototype (`nocturne_reader_night_document_platform.tsx`, 1,088 lines, simulated data, `localStorage` storage, fake file parsing) into a real, offline-first night-reading web app, and replace its generic "AI dashboard" look with a quiet, editorial, utility-focused interface (Linear / Raycast / Arc feel).

**Success criteria**
- The live reader count and room breakdown come from real connections, and the app degrades to a clean local mode when presence is unavailable.
- Uploaded PDF and PSD files are actually parsed and rendered (PDF pages with selectable text; PSD layer tree with working visibility/opacity and a composite preview).
- Documents, reading progress, bookmarks, highlights and preferences persist in IndexedDB. The app loads and works with no network after the first visit.
- Storage is observable (`navigator.storage.estimate()`), clearable, and auto-evicts least-recently-opened documents above 500 MB.
- Ambient audio works with zero configuration (synth) and upgrades to streamed tracks when CDN URLs are configured.
- A music dock plays English, Hindi, instrumental and nature music from Spotify embeds, YouTube playlists, user-supplied stream URLs and uploaded local tracks, one source active at a time.
- The app is ad-free by design: it ships no ads, trackers or analytics, enforced by a Content-Security-Policy (section 7.8).
- The UI matches section 6 and passes the verification in section 9.

**Constraints**
- **Everything runs on free tiers.** Presence uses Supabase's free plan (200 concurrent connections, 2M messages/month, 20 presence messages/s, project auto-pauses after 1 week of inactivity). Optional audio hosting uses Cloudflare R2's free tier (10 GB storage, no egress fees). Figures checked against the vendors' pricing/docs pages on 2026-11-11. No paid service and no always-on server is required.
- The user supplies their own Supabase project URL and anon key. Until then the app runs in local offline mode.
- The user supplies and hosts the royalty-free audio tracks. Until then audio uses the synth fallback.
- Spotify and YouTube playback uses their official embed APIs, which need no API key or paid plan. Spotify embeds play 30-second previews unless the listener is logged in to Spotify (Premium listeners hear full tracks). Ads that YouTube or Spotify serve inside their own players are outside the app's control: a web page cannot remove them (the players are cross-origin iframes) and the app does not try to.

## 2. Decisions

| Decision | Choice | Reason |
|---|---|---|
| Foundation | Vite + React + TypeScript SPA | Client-only app, no SSR need, simplest PWA/offline path |
| Presence backend | Supabase Realtime presence | Free, no server to host, named in the original prompt. Socket.io would need an always-on host and free hosts sleep |
| Local data | Dexie (IndexedDB) | Real Blob storage; replaces `localStorage` |
| UI state | Zustand | Small, no provider tree |
| Offline | `vite-plugin-pwa` (Workbox) | Precache shell, fonts, PDF worker; runtime-cache audio |
| Styling | Tailwind CSS v4, tokens in CSS (`@theme`) | CSS-first theming fits multiple palettes |
| Fonts | Self-hosted via `@fontsource` | CDN fonts break offline |
| Command palette | `cmdk` | Accessible, small |
| PDF | `pdfjs-dist` | Standard |
| PSD | `ag-psd` | Layer tree + per-layer canvases |
| Music sources | Spotify embed + iFrame API; YouTube IFrame Player API (privacy-enhanced host); custom stream URL; uploaded tracks | No keys or paid plans. The Spotify Web Playback SDK (Premium + OAuth) is out of scope |
| Ad-free enforcement | No ad/analytics code, CSP allowlist, `youtube-nocookie.com` embeds, lazy-loaded player scripts | Same ad-free approach as deluxsalon.in, made enforceable |
| Tests | Vitest, jsdom, `fake-indexeddb` | Fast unit coverage of side-effect logic |

The original `.tsx` stays untouched at the repo root until the new app replaces it, then is removed in a dedicated step.

## 3. Phases

One project, built in this order. Each phase ends in a working, verifiable app.

1. **Scaffold + design system.** Vite/TS/Tailwind project, tokens and palettes, fonts, rail layout, status line, slide-out tuning panel, custom scrubbers, idle fade, command palette, hotkeys. Text documents only (seeded samples).
2. **Local cache + PWA.** Dexie schema, `useLocalCache`, import/open/delete, progress and bookmarks, storage metrics, LRU eviction, `storage.persist()`, service worker, offline behaviour.
3. **PDF + PSD.** PDF viewer, PSD inspector, thumbnails, text highlights.
4. **Audio engine.** `useAudioEngine` with synth fallback, streamed tracks, analyser visuals, preferences, sleep timer.
5. **Music dock + ad-free hardening.** `MusicDock`, Spotify / YouTube / My Tracks sources, category tabs, track upload, CSP.
6. **Presence.** `usePresence`, real counter and breakdown, offline fallback.

## 4. Architecture

Only hooks and `lib/` code touch Dexie, Supabase or `AudioContext`. Components render and dispatch.

```
src/
  main.tsx, App.tsx
  design/      tokens.css (palette variables + @theme), fonts.css
  components/  Rail, StatusLine, TuningPanel, CommandPalette, Scrubber,
               ReaderCanvas, TextView, PdfViewer, PsdInspector, AudioPanel,
               LedPulse, Waveform, PresenceBadge, StoragePanel, ErrorPanel,
               MusicDock, SpotifyPlayer, YouTubeAudioPlayer, TrackUpload
  hooks/       usePresence, useAudioEngine, useLocalCache, useMusicSource,
               useIdleFade, useHotkeys
  lib/         db.ts, lru.ts, pdf.ts, psd.ts, supabase.ts, bionic.ts,
               audio/synth.ts, audio/streamed.ts, audio/tracks.ts,
               music/playlists.ts, music/adapter.ts, music/spotifyOembed.ts,
               music/loadScript.ts
  store/       ui.ts
```

Environment variables (all optional): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUDIO_CDN_BASE`.

## 5. Data model (Dexie)

| Table | Fields |
|---|---|
| `documents` | id, name, type (`pdf`/`psd`/`text`), size, blob, addedAt, lastOpenedAt |
| `thumbnails` | docId, page, blob |
| `progress` | docId, page, scrollTop |
| `bookmarks` | id, docId, page, label, createdAt |
| `highlights` | id, docId, start, end, note, createdAt (text documents only) |
| `tracks` | id, title, artist, language, duration, blob (uploaded file) or url (custom stream), addedAt |
| `prefs` | key, value — theme, warmthK, brightness, contrast, fontSize, lineHeight, audio track, volume, music source, last category, custom playlist links |

**Cache management (`useLocalCache`, `lru.ts`)**
- Usage is reported from `navigator.storage.estimate()` and from the sum of `documents.size` plus thumbnails.
- When stored document bytes exceed 500 MB after an import, evict documents ordered by oldest `lastOpenedAt` (plus their thumbnails, progress, bookmarks, highlights) until under the limit. The document just imported is never evicted.
- A clear-all action empties every table except `prefs` (uploaded music `tracks` included, after a confirmation).
- Uploaded `tracks` are never auto-evicted, because the user added them deliberately. They count toward the usage figure, and the storage panel shows documents and tracks separately. The 500 MB LRU limit applies to documents.
- On first run, request `navigator.storage.persist()`.
- On `QuotaExceededError` during a write: run eviction once, retry once, then surface an error.
- First run seeds two text documents derived from the prototype's "Sleep & Night Ergonomics" and "Nocturne Engine Specs" content. The prototype's fake PSD sample is dropped.

**Accepted file types:** `.pdf`, `.psd`, `.txt`, `.md`, `.json`, `.csv`. The prototype's `.doc/.docx/.png/.jpg` are dropped because nothing parses them. Music upload (section 7.7) separately accepts `.mp3` and `.aac`.

## 6. UI design

**Layout**
- 48px left rail with the tools; no top header. A slim status line (file name, page, presence badge, LED).
- Reading canvas ≥ 80% of viewport width.
- Tuning panel (warmth, brightness, contrast, font size, line height, scroll speed, speech rate) slides out on hover over the right edge or `\`.
- 1px `border-white/5` hairlines, 4–6px radii, no drop shadows, glows or gradients, 4/8px grid.

**Palette tokens (default "Night")**

| Token | Value |
|---|---|
| canvas | `#090A0F` |
| surface | `#12141C` |
| text | `#E2E8F0` |
| text-muted | `#64748B` |
| accent | `#F59E0B` |
| active | deep olive/slate |

Other themes are token sets: **Sepia**, **OLED** (true black, opt-in only), **Crimson** (night-vision red). The prototype's `warmSlate` is dropped (it was unreachable from the UI).

**Typography (self-hosted):** Geist Sans for UI; Geist Mono for readouts, code/markdown/txt/json/csv; Newsreader for serif reading mode; OpenDyslexic replaces the prototype's Comic Sans placeholder for the dyslexic toggle.

**Warmth filter:** the overlay stays. Control is in Kelvin, 2200–6500K, default 5000K (equivalent to the prototype's 35%). Overlay opacity = `(6500 − K) / 4300 × 0.35`, multiply blend. Crimson theme keeps the red overlay.

**Idle fade (`useIdleFade`):** all chrome fades to `opacity: 0` after 3 seconds without pointer or key input. Scrolling and auto-scroll do not wake it; pointer movement or any key does. `prefers-reduced-motion` removes the transition but keeps the behaviour. One exception: the YouTube player tile (section 7.7) stays fully visible while YouTube is the active source, because YouTube requires its embedded player to stay viewable.

**Hotkeys (`useHotkeys`):** `Cmd/Ctrl+K` palette, `+B` bionic reading, `+M` play/pause the active audio or music source, `\` tuning panel. The prototype's keys remain: arrows (pages / focus line), `F` focus ruler, `S` TTS, `A` ambient audio. All actions are also reachable from the palette because browsers reserve some combos. Every key handler calls `preventDefault` only for combos it owns, and never fires inside text inputs.

**Command palette:** `cmdk`; open document, switch theme, toggle bionic/ruler/TTS/audio/night-pages, switch music source or category, jump to page, clear cache.

**Scrubbers:** custom pointer + keyboard slider (`role="slider"`, `aria-valuenow/min/max`, arrow/Home/End/PageUp/PageDown) with a tabular-numeric readout (`5000K`, `1.15x`, `18px`).

**Audio visuals:** a minimal waveform canvas in the audio panel and an LED pulse next to the sound selector, both driven by an `AnalyserNode`. The prototype's fake sine bars are removed.

**Transitions:** `200ms cubic-bezier(0.16, 1, 0.3, 1)` on specific properties (opacity, transform, colors, borders), not `transition: all`.

## 7. Feature behaviour

### 7.1 Audio (`useAudioEngine`)
- One `AudioContext` → master `GainNode` → `AnalyserNode` → destination.
- Tracks (`tracks.ts`): **Lo-Fi**, **Rain**, **Pink Noise**. Each has a synth recipe (`synth.ts`; pink noise via a proper pink-noise filter, not white noise) and an optional file `${VITE_AUDIO_CDN_BASE}/<name>.mp3`.
- If a file URL is configured and loads, stream it (looped); otherwise, or on any load/decoding error, use the synth. A small LED state shows which source is active.
- The context resumes on the first pointer/key event and on `visibilitychange` to visible.
- Track and volume persist in `prefs`. Sleep timer (off/15/30/60 min) fades out over 5 seconds, then stops.
- Streamed files are runtime-cached (cache-first, range requests) so they play offline once heard. R2 must have CORS enabled for the analyser to read the stream.

### 7.2 PDF (`PdfViewer`, `lib/pdf.ts`)
- `pdfjs-dist`, worker bundled with the app (precached).
- Continuous scroll; pages render lazily near the viewport at `devicePixelRatio`; zoom; selectable text layer.
- **Night pages** toggle: inverts page rendering (CSS filter on the canvas) so documents are not blinding white; text layer unaffected.
- Progress (page, scrollTop) saved on a throttle and restored on open.
- Page 1 thumbnail generated on import and stored.

### 7.3 PSD (`PsdInspector`, `lib/psd.ts`)
- `ag-psd` parses to a layer tree (groups, names, visibility, opacity, blend mode, per-layer canvas and position).
- The inspector shows the tree with visibility and opacity controls. A composite canvas redraws only visible layers (children of hidden groups excluded) in document order using `globalAlpha` and mapped blend modes (unmapped modes draw as normal).
- Parsing is on the main thread with a loading state; files over 100 MB show a warning first. The Blob is stored; layer metadata is re-derived on open.

### 7.4 Text documents
- `.txt/.md/.json/.csv` render in Newsreader (or Geist Mono for code-like types). Bionic reading, focus ruler, TTS, auto-scroll, and font/line-height controls from the prototype carry over.
- Highlights: select text → add highlight with optional note, stored as character-offset ranges. Bookmarks are available for every document type.

### 7.5 Presence (`usePresence`)
- One Supabase presence channel; each tab joins with a random anonymous key and tracks `{ room: 'pdf' | 'psd' | 'text' | 'none' }`. File names and any other document data are never sent.
- The UI shows the real total and the breakdown (`PDF 12 · PSD 3 · Text 8`). The prototype's fake city-hub pulse is removed.
- `track()` calls are throttled (≥ 6 s apart) to stay under Supabase's 5-presence-calls-per-30-seconds limit.
- Status: `connecting` | `online` | `offline`. Missing env keys, channel error/close, join rejection at the 200-connection cap, or `navigator.onLine === false` → `offline`: the badge shows local mode (no count) and the app retries with exponential backoff (capped) when keys exist.

### 7.6 PWA
- Precache: app shell, fonts, PDF worker. Runtime cache: streamed audio (7.1). Supabase websocket traffic is not cached.
- Documents come from IndexedDB, so a cold start with no network opens the last document.

### 7.7 Music dock (`MusicDock`, `SpotifyPlayer`, `YouTubeAudioPlayer`, `useMusicSource`)
- **Dock:** a floating 56px bar fixed to the bottom of the reading canvas, using the section 6 tokens. It shows album art, title, artist, a language tag, play/pause, a scrub bar, volume, sleep timer, a source switcher and the category tabs.
- **One active source at a time.** Switching sources stops the previous one. `useMusicSource` owns which source is active and exposes one unified state (title, artist, art, language, position, duration, isPlaying, `canSeek`, `canSetVolume`) and commands (play, pause, seek, setVolume, next, previous), so the dock UI never knows which source it is driving. Each player implements one adapter interface (`music/adapter.ts`).
- **Sources**
  1. **Night Noise.** The section 7.1 engine (synth or streamed CDN files), including the waveform and LED.
  2. **Spotify.** The official embed controlled through Spotify's iFrame API (`createController`, `loadEntity`, `play`, `pause`, `resume`, `seek`, the `ready` and `playback_update` events). The embed iframe stays rendered at its standard compact height because it is the playback surface; the dock drives it. The API provides no volume and no next/previous methods, so the volume slider is disabled for Spotify and track skipping uses the embed's own controls. It also provides no title or artist, so the dock reads title and cover art from Spotify's oEmbed endpoint (no key) and shows the artist when the preset config has one. Without a Spotify login the embed plays 30-second previews.
  3. **YouTube.** The YouTube IFrame Player API on the privacy-enhanced host (`youtube-nocookie.com`), with `controls: 0` and the dock as the UI (`playVideo`, `pauseVideo`, `seekTo`, `setVolume`, `getCurrentTime`, `getDuration`, `getVideoData`, `nextVideo`, `previousVideo`). Title and channel come from `getVideoData()`, art from `i.ytimg.com`. YouTube requires embedded players to be at least 200×200px and viewable, so a player tile of that size floats above the left end of the dock while YouTube is active and is never hidden, faded or covered. Playback starts from the user's click on play, which satisfies browser autoplay rules.
  4. **My Tracks.** A pasted stream URL (a direct audio URL such as an internet-radio stream) or an uploaded `.mp3` / `.aac`. Uploads are stored in the Dexie `tracks` table and play offline through an `<audio>` element routed through the section 7.1 gain and analyser, so volume, sleep timer and visuals work. If a stream does not allow cross-origin audio, it plays through a plain `<audio>` element without the analyser.
- **Category tabs** (`music/playlists.ts`). Each preset has a source, an id or URL, a title, an artist or curator, and a language tag (`EN`, `HI`, `INST`, `NATURE`):
  - English Focus: Lofi, Jazz, Ambient
  - Hindi / Bollywood Chill: Acoustic, Sufi, Night Vibes
  - Instrumental & Classical
  - Nature & White Noise (includes the section 7.1 synth tracks)

  Every preset id is checked to load before it ships. The user can paste any Spotify or YouTube URL to add their own, saved in `prefs`. Language tags come from this config because neither API provides them.
- **Sleep timer.** The shared timer from 7.1 pauses whichever source is active. Sources whose volume the app controls (Night Noise, YouTube, My Tracks) fade out; Spotify just pauses.
- **Offline.** Spotify and YouTube need a connection. Offline, their tabs show "Needs a connection" while Night Noise and My Tracks keep working.

### 7.8 Ad-free by design
- The app ships no ad, tracking or analytics code. The only third-party scripts are YouTube's and Spotify's player APIs, and each is loaded lazily the first time that source is selected (`music/loadScript.ts`).
- A Content-Security-Policy is set as a `<meta>` tag at build time (static hosts cannot always set headers): `default-src 'self'`; `script-src` allows self plus the YouTube and Spotify player-script origins; `frame-src` allows `www.youtube-nocookie.com` and `open.spotify.com`; `connect-src` allows self, the configured Supabase origin and `open.spotify.com` (oEmbed); `img-src` allows self, `data:`, `blob:`, `i.ytimg.com` and Spotify's image CDN; `media-src` allows self, `blob:` and `https:` (custom streams). The exact origin lists are confirmed in the browser check (section 9) with zero CSP violations in the console.
- YouTube embeds use `youtube-nocookie.com`, which reduces tracking.
- Ads that YouTube or Spotify serve inside their own players are not removed or altered. The README says so plainly. The ad-free sources are Night Noise, uploaded tracks and custom streams.

## 8. Error handling

- Corrupt or unsupported file → inline `ErrorPanel` with the reason; the file is not saved.
- Storage full → one eviction + retry, then an error panel with the clear-cache action.
- Audio stream failure → synth fallback, LED shows fallback state, no dialog.
- Presence failure → local offline mode, no dialog.
- YouTube `onError` (video unavailable or embedding disabled) → skip to the next video; if none is playable, show the error in the dock. Spotify embed not ready within 8 seconds → a message with an "Open in Spotify" link. A custom stream that errors → a message in the dock, other sources unaffected. An upload that is not audio or has an unsupported codec → inline error, not saved.
- `AudioContext`, `speechSynthesis`, `storage.persist` and `storage.estimate` are feature-detected; missing support disables the control with a tooltip rather than throwing (replaces the prototype's `alert()`).

## 9. Testing and verification

**Unit (Vitest + jsdom + `fake-indexeddb`)**
- `lru.ts`: eviction order, never evicts the just-imported document, stops at threshold.
- `useLocalCache`: add/open/delete, quota-exceeded retry, clear-all keeps `prefs`, usage figures.
- Presence: presence-state → total/breakdown (pure function); hook with a mocked channel for online, error, missing keys, throttle, and offline fallback.
- Audio: source selection (configured + loads → stream; unset/error → synth); sleep timer fade/stop.
- PSD: layer tree building and visible-layer composite order, using fixtures generated in-test with `ag-psd`.
- `bionic.ts`, Kelvin → overlay-opacity mapping, scrubber keyboard behaviour.
- Music: `useMusicSource` with fake adapters (one active source, switching stops the previous, unified state and capability flags such as `canSetVolume`), `tracks` table add/play/delete, sleep timer pausing the active source, `playlists.ts` validation (required fields, language tags), and a check that the built `index.html` carries the CSP.

**Build checks:** `tsc --noEmit`, production build, service worker generated.

**Browser check (Playwright):** run the dev server; open seeded docs; import a generated PDF and PSD; verify rendering, layer toggles, idle fade at 3 s, palette (`Cmd/Ctrl+K`), theme switches; reload with the network blocked and confirm the app and stored documents still open. PDF canvas rendering and live Supabase presence are verified by screenshot and mocks respectively; live presence needs the user's keys. For music: drive each source with its player API mocked, upload a generated `.mp3` and play it with the network blocked, and confirm the console shows zero CSP violations while every source loads. Real Spotify and YouTube playback is checked manually in a browser, since it needs their live players.

## 10. Out of scope

User accounts or auth, any server of our own, `.doc/.docx/image` parsing, PDF highlights, a geographic "hub" activity feed, server-side document sync, the Media Session / lock-screen controls, the Spotify Web Playback SDK and OAuth, YouTube Data API search, hidden or audio-only background YouTube playback, removing or altering ads served inside YouTube or Spotify embeds, and a browser-extension ad blocker.

## 11. Open items for the user

- Provide a Supabase project URL and anon key (free plan) to turn on live presence.
- Provide and host the royalty-free Lo-Fi / Rain / Pink Noise tracks (R2 free tier suggested) and set `VITE_AUDIO_CDN_BASE`; otherwise the synth fallback is used.
- Optionally send preferred Spotify or YouTube playlist links for the four music categories. Otherwise I pick defaults and verify each one loads.
- A Spotify listener has to be logged in to Spotify in the same browser to hear full tracks in the embed. Without that, it plays 30-second previews.
