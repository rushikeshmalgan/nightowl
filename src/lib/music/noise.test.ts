import { asContext, FakeAudioContext } from '../../test/fakeAudio';
import { AudioEngine } from '../audio/engine';
import { createNoiseAdapter } from './noise';

function setup() {
  const engine = new AudioEngine({ createContext: () => asContext(new FakeAudioContext()) });
  return { engine, adapter: createNoiseAdapter(engine) };
}

describe('createNoiseAdapter', () => {
  it('describes the night noise source', () => {
    const { adapter } = setup();
    expect(adapter.id).toBe('noise');
    expect(adapter.getState()).toMatchObject({
      title: 'Lo-Fi',
      artist: 'NightOwl',
      language: 'NATURE',
      canSeek: false,
      canSetVolume: true,
      canSkip: false,
      isPlaying: false,
      volume: 0.5,
    });
  });

  it('loads a track by its id', async () => {
    const { adapter, engine } = setup();
    const setTrack = vi.spyOn(engine, 'setTrack');
    await adapter.load({ id: 'n', source: 'noise', ref: 'rain', title: 'Rain', artist: '', language: 'NATURE' });
    expect(setTrack).toHaveBeenCalledWith('rain');
    expect(adapter.getState().title).toBe('Rain');
  });

  it('ignores an unknown track id', async () => {
    const { adapter, engine } = setup();
    const setTrack = vi.spyOn(engine, 'setTrack');
    await adapter.load({ id: 'n', source: 'noise', ref: 'opera', title: 'x', artist: '', language: null });
    expect(setTrack).not.toHaveBeenCalled();
  });

  it('plays and pauses the engine and mirrors it', async () => {
    const { adapter, engine } = setup();
    const listener = vi.fn();
    adapter.subscribe(listener);
    await adapter.play();
    expect(engine.getState().playing).toBe(true);
    expect(adapter.getState().isPlaying).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ isPlaying: true }));
    adapter.pause();
    expect(adapter.getState().isPlaying).toBe(false);
  });

  it('sets the engine volume and shows engine errors', async () => {
    const { adapter, engine } = setup();
    adapter.setVolume(0.3);
    expect(engine.getState().volume).toBe(0.3);
    expect(adapter.getState().volume).toBe(0.3);
  });
});
