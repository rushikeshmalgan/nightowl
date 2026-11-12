import { act, renderHook } from '@testing-library/react';
import { useSleepTimer } from './useSleepTimer';

const fake = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { remaining: null as number | null };
  return {
    state,
    listeners,
    timer: {
      start: vi.fn((minutes: number) => {
        state.remaining = minutes * 60_000;
        for (const listener of listeners) listener();
      }),
      cancel: vi.fn(() => {
        state.remaining = null;
        for (const listener of listeners) listener();
      }),
      remainingMs: vi.fn(() => state.remaining),
      subscribe: vi.fn((listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
    },
  };
});

vi.mock('./sleepTimer', () => ({ sleepTimer: fake.timer }));

beforeEach(() => {
  vi.clearAllMocks();
  fake.state.remaining = null;
  fake.listeners.clear();
});

describe('useSleepTimer', () => {
  it('is off to begin with', () => {
    const { result } = renderHook(() => useSleepTimer());
    expect(result.current.minutes).toBe(0);
    expect(result.current.remainingMs).toBeNull();
  });

  it('starts the shared timer', () => {
    const { result } = renderHook(() => useSleepTimer());
    act(() => result.current.set(15));
    expect(fake.timer.start).toHaveBeenCalledWith(15);
    expect(result.current.minutes).toBe(15);
    expect(result.current.remainingMs).toBe(15 * 60_000);
  });

  it('cancels with Off', () => {
    const { result } = renderHook(() => useSleepTimer());
    act(() => result.current.set(30));
    act(() => result.current.set(0));
    expect(fake.timer.cancel).toHaveBeenCalled();
    expect(result.current.minutes).toBe(0);
    expect(result.current.remainingMs).toBeNull();
  });

  it('goes back to off when the timer fires', () => {
    const { result } = renderHook(() => useSleepTimer());
    act(() => result.current.set(15));
    act(() => {
      fake.state.remaining = null;
      for (const listener of fake.listeners) listener();
    });
    expect(result.current.minutes).toBe(0);
  });

  it('stops listening on unmount', () => {
    const { unmount } = renderHook(() => useSleepTimer());
    expect(fake.listeners.size).toBe(1);
    unmount();
    expect(fake.listeners.size).toBe(0);
  });
});
