/** A scripted music adapter for tests of the source controller and the dock. */
import { createPlaybackStore, EMPTY_PLAYBACK } from '../features/music/adapter';
import type { MusicAdapter, PlaybackState, PlaylistItem, SourceId } from '../features/music/adapter';

type Mocked<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? T[K] & import('vitest').Mock<(...args: A) => R> : T[K];
};

export type FakeAdapter = Mocked<MusicAdapter> & {
  /** Pushes a state change, as a real player would on its own events. */
  emit(patch: Partial<PlaybackState>): void;
  loaded: PlaylistItem[];
};

export function makeFakeAdapter(id: SourceId, initial: Partial<PlaybackState> = {}): FakeAdapter {
  const store = createPlaybackStore({ ...EMPTY_PLAYBACK, canSeek: true, canSetVolume: true, canSkip: true, ...initial });
  const loaded: PlaylistItem[] = [];
  return {
    id,
    loaded,
    emit: (patch) => store.set(patch),
    load: vi.fn(async (item: PlaylistItem) => {
      loaded.push(item);
      store.set({ title: item.title, artist: item.artist, language: item.language, error: null });
    }),
    play: vi.fn(async () => {
      store.set({ isPlaying: true });
    }),
    pause: vi.fn(() => {
      store.set({ isPlaying: false });
    }),
    seek: vi.fn((seconds: number) => {
      store.set({ position: seconds });
    }),
    setVolume: vi.fn((volume: number) => {
      if (store.get().canSetVolume) store.set({ volume });
    }),
    next: vi.fn(),
    previous: vi.fn(),
    getState: vi.fn(() => store.get()),
    subscribe: vi.fn((listener: (state: PlaybackState) => void) => store.subscribe(listener)),
    dispose: vi.fn(),
  };
}

export function makeFakeAdapters(): Record<SourceId, FakeAdapter> {
  return {
    noise: makeFakeAdapter('noise', { canSeek: false, canSkip: false }),
    spotify: makeFakeAdapter('spotify', { canSetVolume: false, canSkip: false }),
    youtube: makeFakeAdapter('youtube'),
    tracks: makeFakeAdapter('tracks'),
  };
}

export const item = (id: string, source: SourceId, title = id): PlaylistItem => ({
  id,
  source,
  ref: `ref-${id}`,
  title,
  artist: 'Test Artist',
  language: 'EN',
});
