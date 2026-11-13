import { createPlaybackStore, EMPTY_PLAYBACK } from '../adapter';
import type { MusicAdapter } from '../adapter';
import { fetchSpotifyMeta } from './spotifyOembed';

export type SpotifyAdapter = MusicAdapter & { mount(element: HTMLElement): void };

export const SPOTIFY_LINK_ERROR = 'That is not a Spotify link.';
const URI = /^spotify:(playlist|album|track|episode|show|artist):([A-Za-z0-9]+)$/;

/** `spotify:playlist:ID` to `https://open.spotify.com/playlist/ID`. */
export function spotifyWebUrl(uri: string): string {
  const [, kind, id] = uri.split(':');
  return `https://open.spotify.com/${kind}/${id}`;
}

/** The embed address for a Spotify URI, or null if it is not one. */
export function spotifyEmbedUrl(uri: string): string | null {
  const match = URI.exec(uri);
  return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}?theme=0` : null;
}

/**
 * Shows Spotify's own embedded player. Spotify's scripting API runs eval(),
 * which this app's Content-Security-Policy forbids, so no Spotify script is
 * loaded: the embed is a plain frame and the reader uses its controls for
 * play, pause and seeking. Without a Spotify login it plays 30-second previews.
 */
export function createSpotifyAdapter(deps: { fetchMeta?: typeof fetchSpotifyMeta } = {}): SpotifyAdapter {
  const fetchMeta = deps.fetchMeta ?? fetchSpotifyMeta;
  const store = createPlaybackStore({ ...EMPTY_PLAYBACK, externalControls: true });
  let host: HTMLElement | null = null;
  let frame: HTMLIFrameElement | null = null;

  return {
    id: 'spotify',
    mount(element) {
      host = element;
    },
    async load(item) {
      const src = spotifyEmbedUrl(item.ref);
      if (!src) {
        store.set({ error: SPOTIFY_LINK_ERROR });
        throw new Error(SPOTIFY_LINK_ERROR);
      }
      if (!frame) {
        frame = document.createElement('iframe');
        frame.width = '100%';
        frame.height = '152';
        frame.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
        frame.loading = 'lazy';
        frame.style.border = '0';
        host?.replaceChildren(frame);
      }
      frame.title = `Spotify player: ${item.title}`;
      frame.src = src;
      store.set({ title: item.title, artist: item.artist, language: item.language, artUrl: null, error: null });
      void fetchMeta(spotifyWebUrl(item.ref)).then(
        (meta) => store.set({ title: meta.title || item.title, artUrl: meta.thumbnailUrl }),
        () => {
          // Keep the preset's own title.
        },
      );
    },
    // Playback happens inside Spotify's player.
    async play() {},
    pause() {},
    seek() {},
    setVolume() {},
    next() {},
    previous() {},
    getState: () => store.get(),
    subscribe: (listener) => store.subscribe(listener),
    dispose() {
      frame?.remove();
      frame = null;
    },
  };
}
