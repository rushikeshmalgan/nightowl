import { createSleepTimer } from './sleepTimer';
import type { SleepTarget } from './sleepTimer';

const MIN = 60_000;

function makeTarget(canSetVolume = true, volume = 0.8) {
  const target = {
    canSetVolume,
    volume,
    getVolume: vi.fn(() => target.volume),
    setVolume: vi.fn((v: number) => {
      target.volume = v;
    }),
    pause: vi.fn(),
  };
  return target;
}

describe('createSleepTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fades the volume over the last 5 seconds, pauses, then restores the volume', () => {
    const target = makeTarget(true, 0.8);
    const timer = createSleepTimer({ resolve: () => target as SleepTarget });
    timer.start(15);

    vi.advanceTimersByTime(15 * MIN - 5000);
    expect(target.pause).not.toHaveBeenCalled();
    expect(target.setVolume).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2500);
    expect(target.pause).not.toHaveBeenCalled();
    expect(target.volume).toBeGreaterThan(0.2);
    expect(target.volume).toBeLessThan(0.6);

    vi.advanceTimersByTime(2500);
    expect(target.pause).toHaveBeenCalledTimes(1);
    expect(target.volume).toBe(0.8);
  });

  it('only ever lowers the volume during the fade', () => {
    const target = makeTarget(true, 0.8);
    const timer = createSleepTimer({ resolve: () => target as SleepTarget });
    timer.start(15);
    vi.advanceTimersByTime(15 * MIN - 1);
    const fadeValues = target.setVolume.mock.calls.map((call) => call[0] as number);
    expect(fadeValues.length).toBeGreaterThan(3);
    for (let i = 1; i < fadeValues.length; i++) expect(fadeValues[i]).toBeLessThanOrEqual(fadeValues[i - 1]);
    expect(Math.max(...fadeValues)).toBeLessThanOrEqual(0.8);
  });

  it('just pauses a target whose volume it cannot control', () => {
    const target = makeTarget(false);
    const timer = createSleepTimer({ resolve: () => target as SleepTarget });
    timer.start(15);
    vi.advanceTimersByTime(15 * MIN - 1);
    expect(target.pause).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(target.pause).toHaveBeenCalledTimes(1);
    expect(target.setVolume).not.toHaveBeenCalled();
  });

  it('resolves the target only when the fade begins', () => {
    const target = makeTarget();
    const resolve = vi.fn(() => target as SleepTarget);
    const timer = createSleepTimer({ resolve });
    timer.start(30);
    vi.advanceTimersByTime(30 * MIN - 5001);
    expect(resolve).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents the pause and restores a volume it had started to fade', () => {
    const target = makeTarget(true, 0.8);
    const timer = createSleepTimer({ resolve: () => target as SleepTarget });
    timer.start(15);
    vi.advanceTimersByTime(15 * MIN - 2000);
    expect(target.volume).toBeLessThan(0.8);
    timer.cancel();
    vi.advanceTimersByTime(10 * MIN);
    expect(target.pause).not.toHaveBeenCalled();
    expect(target.volume).toBe(0.8);
  });

  it('starting a new timer replaces the old one', () => {
    const target = makeTarget();
    const timer = createSleepTimer({ resolve: () => target as SleepTarget });
    timer.start(15);
    vi.advanceTimersByTime(5 * MIN);
    timer.start(30);
    vi.advanceTimersByTime(15 * MIN);
    expect(target.pause).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15 * MIN);
    expect(target.pause).toHaveBeenCalledTimes(1);
  });

  it('reports the time remaining, and null when idle', () => {
    const timer = createSleepTimer({ resolve: () => makeTarget() as SleepTarget });
    expect(timer.remainingMs()).toBeNull();
    timer.start(15);
    expect(timer.remainingMs()).toBe(15 * MIN);
    vi.advanceTimersByTime(4 * MIN);
    expect(timer.remainingMs()).toBe(11 * MIN);
    timer.cancel();
    expect(timer.remainingMs()).toBeNull();
  });

  it('is idle again after it fires', () => {
    const timer = createSleepTimer({ resolve: () => makeTarget() as SleepTarget });
    timer.start(15);
    vi.advanceTimersByTime(15 * MIN);
    expect(timer.remainingMs()).toBeNull();
  });

  it('tells subscribers when it starts, is cancelled and fires', () => {
    const timer = createSleepTimer({ resolve: () => makeTarget() as SleepTarget });
    const listener = vi.fn();
    const unsubscribe = timer.subscribe(listener);
    timer.start(15);
    expect(listener).toHaveBeenCalledTimes(1);
    timer.cancel();
    expect(listener).toHaveBeenCalledTimes(2);
    timer.start(15);
    vi.advanceTimersByTime(15 * MIN);
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
    timer.start(15);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('honours a custom fade length', () => {
    const target = makeTarget(true, 1);
    const timer = createSleepTimer({ resolve: () => target as SleepTarget, fadeMs: 1000 });
    timer.start(15);
    vi.advanceTimersByTime(15 * MIN - 1001);
    expect(target.setVolume).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(target.volume).toBeLessThan(1);
  });
});
