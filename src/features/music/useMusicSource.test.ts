import { act, renderHook } from '@testing-library/react';
import { adapterSleepTarget } from './adapter';
import { sleepTimer } from '../audio/sleepTimer';
import { item, makeFakeAdapters } from '../../test/fakeAdapter';
import { useMusicSource } from './useMusicSource';

const MIN = 60_000;

afterEach(() => {
  sleepTimer.cancel();
  vi.useRealTimers();
});

function setup() {
  const adapters = makeFakeAdapters();
  const view = renderHook(() => useMusicSource(adapters));
  return { adapters, ...view };
}

describe('useMusicSource', () => {
  it('starts on night noise', () => {
    const { result } = setup();
    expect(result.current.activeSource).toBe('noise');
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('switching source pauses the old one and loads the item on the new one', async () => {
    const { result, adapters } = setup();
    await act(async () => {
      await result.current.play();
    });
    const playlist = item('lofi-hindi', 'youtube', 'Lofi Hindi');
    await act(async () => {
      await result.current.select('youtube', playlist);
    });
    expect(adapters.noise.pause).toHaveBeenCalled();
    expect(adapters.youtube.load).toHaveBeenCalledWith(playlist);
    expect(result.current.activeSource).toBe('youtube');
    expect(result.current.state.title).toBe('Lofi Hindi');
  });

  it('loads a new item on the same source without pausing it first', async () => {
    const { result, adapters } = setup();
    await act(async () => {
      await result.current.select('youtube', item('a', 'youtube'));
    });
    adapters.youtube.pause.mockClear();
    await act(async () => {
      await result.current.select('youtube', item('b', 'youtube', 'Second'));
    });
    expect(adapters.youtube.pause).not.toHaveBeenCalled();
    expect(result.current.state.title).toBe('Second');
  });

  it('mirrors the active adapter and ignores the others', async () => {
    const { result, adapters } = setup();
    await act(async () => {
      await result.current.select('spotify', item('s', 'spotify'));
    });
    act(() => adapters.spotify.emit({ position: 12, duration: 30 }));
    expect(result.current.state).toMatchObject({ position: 12, duration: 30, canSetVolume: false });
    act(() => adapters.youtube.emit({ title: 'Not active', position: 99 }));
    expect(result.current.state.position).toBe(12);
    expect(result.current.state.title).not.toBe('Not active');
  });

  it('toggle plays when paused and pauses when playing', async () => {
    const { result, adapters } = setup();
    await act(async () => {
      await result.current.toggle();
    });
    expect(adapters.noise.play).toHaveBeenCalledTimes(1);
    expect(result.current.state.isPlaying).toBe(true);
    await act(async () => {
      await result.current.toggle();
    });
    expect(adapters.noise.pause).toHaveBeenCalledTimes(1);
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('sends seek, volume and skip to the active adapter only', async () => {
    const { result, adapters } = setup();
    await act(async () => {
      await result.current.select('youtube', item('a', 'youtube'));
    });
    act(() => {
      result.current.seek(42);
      result.current.setVolume(0.3);
      result.current.next();
      result.current.previous();
    });
    expect(adapters.youtube.seek).toHaveBeenCalledWith(42);
    expect(adapters.youtube.setVolume).toHaveBeenCalledWith(0.3);
    expect(adapters.youtube.next).toHaveBeenCalledTimes(1);
    expect(adapters.youtube.previous).toHaveBeenCalledTimes(1);
    expect(adapters.noise.seek).not.toHaveBeenCalled();
  });

  it('reports a load failure on the new source and still switches to it', async () => {
    const { result, adapters } = setup();
    adapters.spotify.load.mockRejectedValueOnce(new Error("Spotify didn't load."));
    await act(async () => {
      await result.current.select('spotify', item('s', 'spotify'));
    });
    expect(result.current.activeSource).toBe('spotify');
    expect(result.current.loadError).toBe("Spotify didn't load.");
  });

  it('the sleep timer pauses whichever source is active when it fires', async () => {
    vi.useFakeTimers();
    const { result, adapters } = setup();
    await act(async () => {
      await result.current.play();
    });
    act(() => result.current.setSleepTimer(15));
    expect(result.current.sleepMinutes).toBe(15);
    // The reader changes source while the timer is running.
    await act(async () => {
      await result.current.select('youtube', item('a', 'youtube'));
      await result.current.play();
    });
    adapters.noise.pause.mockClear();
    act(() => {
      vi.advanceTimersByTime(15 * MIN);
    });
    expect(adapters.youtube.pause).toHaveBeenCalled();
    expect(adapters.noise.pause).not.toHaveBeenCalled();
    expect(result.current.sleepRemainingMs).toBeNull();
    expect(result.current.sleepMinutes).toBe(0);
  });

  it('never touches the volume of a source it cannot control', async () => {
    vi.useFakeTimers();
    const { result, adapters } = setup();
    await act(async () => {
      await result.current.select('spotify', item('s', 'spotify'));
      await result.current.play();
    });
    act(() => result.current.setSleepTimer(15));
    act(() => {
      vi.advanceTimersByTime(15 * MIN);
    });
    expect(adapters.spotify.setVolume).not.toHaveBeenCalled();
    expect(adapters.spotify.pause).toHaveBeenCalled();
  });

  it('setSleepTimer(0) cancels', async () => {
    vi.useFakeTimers();
    const { result, adapters } = setup();
    await act(async () => {
      await result.current.play();
    });
    act(() => result.current.setSleepTimer(30));
    act(() => result.current.setSleepTimer(0));
    act(() => {
      vi.advanceTimersByTime(60 * MIN);
    });
    expect(adapters.noise.pause).not.toHaveBeenCalled();
    expect(result.current.sleepRemainingMs).toBeNull();
  });
});

describe('adapterSleepTarget', () => {
  it('exposes the adapter volume, pause and whether volume can be set', () => {
    const adapters = makeFakeAdapters();
    adapters.youtube.emit({ volume: 0.6 });
    const target = adapterSleepTarget(adapters.youtube);
    expect(target.canSetVolume).toBe(true);
    expect(target.getVolume()).toBe(0.6);
    target.setVolume(0.2);
    expect(adapters.youtube.setVolume).toHaveBeenCalledWith(0.2);
    target.pause();
    expect(adapters.youtube.pause).toHaveBeenCalled();
    expect(adapterSleepTarget(adapters.spotify).canSetVolume).toBe(false);
  });
});
