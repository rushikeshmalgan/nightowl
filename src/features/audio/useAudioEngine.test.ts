import { act, renderHook, waitFor } from '@testing-library/react';
import { getAudioEngine } from './instance';
import * as prefs from '../../shared/prefs';
import { useAudioEngine } from './useAudioEngine';

vi.mock('../../shared/prefs');
vi.mock('./instance', async () => {
  const { AudioEngine } = await import('./engine');
  const { FakeAudioContext, asContext } = await import('../../test/fakeAudio');
  const engine = new AudioEngine({ createContext: () => asContext(new FakeAudioContext()) });
  return { getAudioEngine: () => engine };
});

const lib = vi.mocked(prefs);
const engine = getAudioEngine();

beforeEach(async () => {
  vi.clearAllMocks();
  lib.getPref.mockImplementation(async (_key: string, fallback: unknown) => fallback as never);
  lib.setPref.mockResolvedValue();
  engine.pause();
  await engine.setTrack('lofi');
  engine.setVolume(0.5);
});

async function ready() {
  const view = renderHook(() => useAudioEngine());
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  return view;
}

describe('useAudioEngine', () => {
  it('mirrors the engine state', async () => {
    const { result } = await ready();
    expect(result.current.state).toMatchObject({ playing: false, trackId: 'lofi', volume: 0.5 });
  });

  it('toggle plays, then pauses', async () => {
    const { result } = await ready();
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.state.playing).toBe(true);
    expect(result.current.analyser).not.toBeNull();
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.state.playing).toBe(false);
  });

  it('changes track and remembers it', async () => {
    const { result } = await ready();
    await act(async () => {
      await result.current.setTrack('rain');
    });
    expect(result.current.state.trackId).toBe('rain');
    expect(lib.setPref).toHaveBeenCalledWith('audioTrack', 'rain');
  });

  it('changes volume and remembers it', async () => {
    const { result } = await ready();
    act(() => result.current.setVolume(0.25));
    expect(result.current.state.volume).toBe(0.25);
    expect(lib.setPref).toHaveBeenCalledWith('audioVolume', 0.25);
  });

  it('restores the saved track and volume', async () => {
    const saved: Record<string, unknown> = { audioTrack: 'pink', audioVolume: 0.8 };
    lib.getPref.mockImplementation(async (key: string, fallback: unknown) => (key in saved ? saved[key] : fallback) as never);
    const { result } = await ready();
    expect(result.current.state).toMatchObject({ trackId: 'pink', volume: 0.8 });
    expect(lib.setPref).not.toHaveBeenCalled();
  });

  it('ignores saved values that make no sense', async () => {
    const saved: Record<string, unknown> = { audioTrack: 'opera', audioVolume: 'loud' };
    lib.getPref.mockImplementation(async (key: string, fallback: unknown) => (key in saved ? saved[key] : fallback) as never);
    const { result } = await ready();
    expect(result.current.state).toMatchObject({ trackId: 'lofi', volume: 0.5 });
  });

  it('unlocks audio on the first click or key press, once each', async () => {
    const resume = vi.spyOn(engine, 'resumeIfSuspended');
    await ready();
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('pointerdown'));
    expect(resume).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(resume).toHaveBeenCalledTimes(2);
    resume.mockRestore();
  });

  it('unlocks audio again whenever the tab becomes visible', async () => {
    const resume = vi.spyOn(engine, 'resumeIfSuspended');
    await ready();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(resume).toHaveBeenCalledTimes(1);
    resume.mockRestore();
  });
});
