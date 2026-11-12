import { createPlaybackStore, EMPTY_PLAYBACK } from './adapter';
import type { MusicAdapter, PlaylistItem } from './adapter';
import { loadScript } from './loadScript';

/** The parts of YouTube's IFrame Player API this adapter uses. */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  nextVideo(): void;
  previousVideo(): void;
  loadPlaylist(options: { list: string; listType: 'playlist' }): void;
  loadVideoById(id: string): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { video_id: string; title: string; author: string };
  destroy(): void;
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer;
}

export type YouTubeAdapter = MusicAdapter & { mount(element: HTMLElement): void };

export const NO_PLAYABLE_ERROR = 'No playable videos in this playlist.';
export const YOUTUBE_LOAD_ERROR = "YouTube didn't load.";

const API_URL = 'https://www.youtube.com/iframe_api';
const PLAYING = 1;
const POLL_MS = 500;
const MAX_ERRORS = 3;

/** Loads the IFrame API once and waits for YouTube's ready callback. */
async function loadYouTubeApi(): Promise<YTNamespace> {
  const scope = window as unknown as { YT?: YTNamespace & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
  if (scope.YT?.Player) return scope.YT;
  const ready = new Promise<YTNamespace>((resolve) => {
    const previous = scope.onYouTubeIframeAPIReady;
    scope.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(scope.YT as YTNamespace);
    };
  });
  await loadScript(API_URL);
  return ready;
}

/**
 * Plays YouTube playlists and videos through the official embedded player,
 * on the privacy-enhanced host, with the dock as the only controls. YouTube
 * requires the player to stay visible, so the dock shows it as a tile.
 */
export function createYouTubeAdapter(deps: { loadYT?: () => Promise<YTNamespace> } = {}): YouTubeAdapter {
  const loadYT = deps.loadYT ?? loadYouTubeApi;
  const store = createPlaybackStore({ ...EMPTY_PLAYBACK, canSeek: true, canSetVolume: true, canSkip: true });

  let host: HTMLElement | null = null;
  let player: YTPlayer | null = null;
  let current: PlaylistItem | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let errors = 0;

  const stopPolling = () => {
    if (poll) clearInterval(poll);
    poll = null;
  };

  const describeVideo = () => {
    if (!player) return;
    const video = player.getVideoData();
    store.set({
      title: video.title || current?.title || '',
      artist: video.author || current?.artist || '',
      artUrl: video.video_id ? `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg` : null,
      duration: player.getDuration() || 0,
    });
  };

  const onStateChange = ({ data }: { data: number }) => {
    const playing = data === PLAYING;
    store.set({ isPlaying: playing, loading: false });
    if (playing) {
      errors = 0;
      store.set({ error: null });
      describeVideo();
      if (!poll) {
        poll = setInterval(() => {
          if (player) store.set({ position: player.getCurrentTime() });
        }, POLL_MS);
      }
    } else {
      stopPolling();
    }
  };

  const onError = () => {
    errors += 1;
    if (errors >= MAX_ERRORS) {
      store.set({ error: NO_PLAYABLE_ERROR, isPlaying: false, loading: false });
      return;
    }
    player?.nextVideo();
  };

  const createPlayer = async (item: PlaylistItem): Promise<void> => {
    let YT: YTNamespace;
    try {
      YT = await loadYT();
    } catch {
      store.set({ error: YOUTUBE_LOAD_ERROR, loading: false });
      throw new Error(YOUTUBE_LOAD_ERROR);
    }
    const target = document.createElement('div');
    host?.replaceChildren(target);
    const isPlaylist = item.kind !== 'video';
    await new Promise<void>((resolve) => {
      player = new YT.Player(target, {
        host: 'https://www.youtube-nocookie.com',
        width: 200,
        height: 200,
        ...(isPlaylist ? {} : { videoId: item.ref }),
        playerVars: {
          controls: 0,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          ...(isPlaylist ? { listType: 'playlist', list: item.ref } : {}),
        },
        events: { onReady: () => resolve(), onStateChange, onError },
      });
    });
  };

  return {
    id: 'youtube',
    mount(element) {
      host = element;
    },
    async load(item) {
      current = item;
      errors = 0;
      store.set({ title: item.title, artist: item.artist, language: item.language, artUrl: null, error: null, loading: true, position: 0 });
      if (!player) {
        await createPlayer(item);
        store.set({ loading: false });
        return;
      }
      if (item.kind === 'video') player.loadVideoById(item.ref);
      else player.loadPlaylist({ list: item.ref, listType: 'playlist' });
    },
    async play() {
      player?.playVideo();
    },
    pause() {
      player?.pauseVideo();
    },
    seek(seconds) {
      player?.seekTo(seconds, true);
      store.set({ position: seconds });
    },
    setVolume(volume) {
      const clamped = Math.min(1, Math.max(0, volume));
      player?.setVolume(Math.round(clamped * 100));
      store.set({ volume: clamped });
    },
    next: () => player?.nextVideo(),
    previous: () => player?.previousVideo(),
    getState: () => store.get(),
    subscribe: (listener) => store.subscribe(listener),
    dispose() {
      stopPolling();
      player?.destroy();
      player = null;
    },
  };
}
