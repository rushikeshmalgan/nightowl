import { createPlaybackStore, EMPTY_PLAYBACK } from './adapter';
import type { MusicAdapter, PlaylistItem } from './adapter';
import { loadScript } from './loadScript';
import { fetchSpotifyMeta } from './spotifyOembed';

/** The parts of Spotify's embed iFrame API this adapter uses. */
interface EmbedController {
  addListener(event: string, listener: (event: { data: Record<string, unknown> }) => void): void;
  loadUri(uri: string): void;
  resume(): void;
  pause(): void;
  seek(seconds: number): void;
  destroy(): void;
}

export interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: EmbedController) => void,
  ): void;
}

export type SpotifyAdapter = MusicAdapter & { mount(element: HTMLElement): void };

export const SPOTIFY_LOAD_ERROR = "Spotify didn't load.";
const API_URL = 'https://open.spotify.com/embed/iframe-api/v1';

/** `spotify:playlist:ID` to `https://open.spotify.com/playlist/ID`. */
export function spotifyWebUrl(uri: string): string {
  const [, kind, id] = uri.split(':');
  return `https://open.spotify.com/${kind}/${id}`;
}

async function loadSpotifyApi(): Promise<SpotifyIFrameAPI> {
  const scope = window as unknown as { onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void; __spotifyApi?: SpotifyIFrameAPI };
  if (scope.__spotifyApi) return scope.__spotifyApi;
  const ready = new Promise<SpotifyIFrameAPI>((resolve) => {
    scope.onSpotifyIframeApiReady = (api) => {
      scope.__spotifyApi = api;
      resolve(api);
    };
  });
  await loadScript(API_URL);
  return ready;
}

/**
 * Plays Spotify through its official embed. The embed is the playback
 * surface, so it stays on screen while Spotify is active. Spotify's embed
 * offers no volume or skip control; without a Spotify login it plays
 * 30-second previews.
 */
export function createSpotifyAdapter(
  deps: { loadApi?: () => Promise<SpotifyIFrameAPI>; fetchMeta?: typeof fetchSpotifyMeta; readyTimeoutMs?: number } = {},
): SpotifyAdapter {
  const loadApi = deps.loadApi ?? loadSpotifyApi;
  const fetchMeta = deps.fetchMeta ?? fetchSpotifyMeta;
  const readyTimeoutMs = deps.readyTimeoutMs ?? 8000;
  const store = createPlaybackStore({ ...EMPTY_PLAYBACK, canSeek: true, canSetVolume: false, canSkip: false });

  let host: HTMLElement | null = null;
  let controller: EmbedController | null = null;

  const describe = (item: PlaylistItem) => {
    void fetchMeta(spotifyWebUrl(item.ref)).then(
      (meta) => store.set({ title: meta.title || item.title, artUrl: meta.thumbnailUrl }),
      () => {
        // Keep the preset's own title.
      },
    );
  };

  const createEmbed = async (item: PlaylistItem): Promise<void> => {
    let api: SpotifyIFrameAPI;
    try {
      api = await loadApi();
    } catch {
      store.set({ error: SPOTIFY_LOAD_ERROR, loading: false });
      throw new Error(SPOTIFY_LOAD_ERROR);
    }
    const target = document.createElement('div');
    host?.replaceChildren(target);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        store.set({ error: SPOTIFY_LOAD_ERROR, loading: false });
        reject(new Error(SPOTIFY_LOAD_ERROR));
      }, readyTimeoutMs);
      api.createController(target, { uri: item.ref, width: '100%', height: 152 }, (created) => {
        controller = created;
        created.addListener('ready', () => {
          clearTimeout(timer);
          resolve();
        });
        created.addListener('playback_update', ({ data }) => {
          store.set({
            position: Number(data.position ?? 0) / 1000,
            duration: Number(data.duration ?? 0) / 1000,
            isPlaying: data.isPaused === false,
            loading: data.isBuffering === true,
          });
        });
      });
    });
  };

  return {
    id: 'spotify',
    mount(element) {
      host = element;
    },
    async load(item) {
      store.set({ title: item.title, artist: item.artist, language: item.language, artUrl: null, error: null, loading: true, position: 0, duration: 0 });
      describe(item);
      if (controller) controller.loadUri(item.ref);
      else await createEmbed(item);
      store.set({ loading: false });
    },
    async play() {
      controller?.resume();
    },
    pause() {
      controller?.pause();
    },
    seek(seconds) {
      controller?.seek(seconds);
    },
    setVolume() {
      // Spotify's embed has no volume control; its own player sets it.
    },
    next() {},
    previous() {},
    getState: () => store.get(),
    subscribe: (listener) => store.subscribe(listener),
    dispose() {
      controller?.destroy();
      controller = null;
    },
  };
}
