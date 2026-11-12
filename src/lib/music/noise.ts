import type { AudioEngine, AudioEngineState } from '../audio/engine';
import { AUDIO_TRACKS, isTrackId } from '../audio/tracks';
import { createPlaybackStore, EMPTY_PLAYBACK } from './adapter';
import type { MusicAdapter, PlaybackState } from './adapter';

function fromEngine(state: AudioEngineState): Partial<PlaybackState> {
  const track = AUDIO_TRACKS.find((candidate) => candidate.id === state.trackId);
  return { title: track?.name ?? '', isPlaying: state.playing, volume: state.volume, error: state.error };
}

/** The built-in ambient sound, presented as a music source. */
export function createNoiseAdapter(engine: AudioEngine): MusicAdapter {
  const store = createPlaybackStore({
    ...EMPTY_PLAYBACK,
    artist: 'NightOwl',
    language: 'NATURE',
    canSetVolume: true,
    ...fromEngine(engine.getState()),
  });
  const unsubscribe = engine.subscribe((state) => store.set(fromEngine(state)));

  return {
    id: 'noise',
    async load(item) {
      if (isTrackId(item.ref)) await engine.setTrack(item.ref);
    },
    play: () => engine.play(),
    pause: () => engine.pause(),
    seek() {},
    setVolume: (volume) => engine.setVolume(volume),
    next() {},
    previous() {},
    getState: () => store.get(),
    subscribe: (listener) => store.subscribe(listener),
    dispose: unsubscribe,
  };
}
