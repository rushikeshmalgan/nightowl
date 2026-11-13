import { act, renderHook } from '@testing-library/react';
import { useIdleFade } from './useIdleFade';

describe('useIdleFade', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not idle at first', () => {
    const { result } = renderHook(() => useIdleFade());
    expect(result.current.idle).toBe(false);
  });

  it('becomes idle after 3 seconds without input', () => {
    const { result } = renderHook(() => useIdleFade());
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.idle).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.idle).toBe(true);
  });

  it('wakes on pointer movement and restarts the timer', () => {
    const { result } = renderHook(() => useIdleFade());
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      window.dispatchEvent(new Event('pointermove'));
    });
    expect(result.current.idle).toBe(false);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.idle).toBe(true);
  });

  it('wakes on a key press', () => {
    const { result } = renderHook(() => useIdleFade());
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(result.current.idle).toBe(false);
  });

  it('does not wake on scroll or wheel', () => {
    const { result } = renderHook(() => useIdleFade());
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('wheel'));
    });
    expect(result.current.idle).toBe(true);
  });

  it('scrolling does not postpone going idle', () => {
    const { result } = renderHook(() => useIdleFade());
    act(() => {
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.idle).toBe(true);
  });

  it('never goes idle when disabled', () => {
    const { result } = renderHook(() => useIdleFade({ enabled: false }));
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.idle).toBe(false);
  });

  it('honours a custom delay', () => {
    const { result } = renderHook(() => useIdleFade({ delayMs: 500 }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.idle).toBe(true);
  });

  it('removes its listeners on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useIdleFade());
    unmount();
    const removed = remove.mock.calls.map((call) => call[0]);
    expect(removed).toEqual(expect.arrayContaining(['pointermove', 'pointerdown', 'keydown']));
    remove.mockRestore();
  });
});
