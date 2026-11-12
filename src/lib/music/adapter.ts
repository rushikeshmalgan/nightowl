import type { LanguageTag } from '../../types';
import type { SleepTarget } from '../sleepTimer';

export type SourceId = 'noise' | 'spotify' | 'youtube' | 'tracks';

export interface PlaylistItem {
  id: string;
  source: SourceId;
  /** Spotify URI, YouTube playlist or video id, noise track id, or uploaded track id. */
  ref: string;
  title: string;
  artist: string;
  language: LanguageTag | null;
  kind?: 'playlist' | 'album' | 'track' | 'video' | 'episode' | 'show' | 'artist';
}

export interface PlaybackState {
  title: string;
  artist: string;
  artUrl: string | null;
  language: LanguageTag | null;
  isPlaying: boolean;
  loading: boolean;
  /** Seconds. */
  position: number;
  /** Seconds. */
  duration: number;
  /** 0 to 1. */
  volume: number;
  canSeek: boolean;
  canSetVolume: boolean;
  canSkip: boolean;
  error: string | null;
}

/** One way of playing music. The dock drives every source through this. */
export interface MusicAdapter {
  id: SourceId;
  load(item: PlaylistItem): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  next(): void;
  previous(): void;
  getState(): PlaybackState;
  subscribe(listener: (state: PlaybackState) => void): () => void;
  dispose(): void;
}

export const EMPTY_PLAYBACK: PlaybackState = {
  title: '',
  artist: '',
  artUrl: null,
  language: null,
  isPlaying: false,
  loading: false,
  position: 0,
  duration: 0,
  volume: 1,
  canSeek: false,
  canSetVolume: false,
  canSkip: false,
  error: null,
};

/** A tiny observable state holder that adapters build on. */
export function createPlaybackStore(initial: PlaybackState) {
  let state = initial;
  const listeners = new Set<(state: PlaybackState) => void>();
  return {
    get: () => state,
    set(patch: Partial<PlaybackState>) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener(state);
    },
    subscribe(listener: (state: PlaybackState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Lets the shared sleep timer fade and pause a music source. */
export function adapterSleepTarget(adapter: MusicAdapter): SleepTarget {
  return {
    canSetVolume: adapter.getState().canSetVolume,
    getVolume: () => adapter.getState().volume,
    setVolume: (volume) => adapter.setVolume(volume),
    pause: () => adapter.pause(),
  };
}
