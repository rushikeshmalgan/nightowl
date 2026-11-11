import { renderHook } from '@testing-library/react';
import { useAutoScroll } from './useAutoScroll';

describe('useAutoScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds 2 * speed pixels every 50 ms', () => {
    const el = document.createElement('div');
    renderHook(() => useAutoScroll({ current: el }, true, 1.5));
    vi.advanceTimersByTime(200);
    expect(el.scrollTop).toBe(12);
  });

  it('does nothing while disabled', () => {
    const el = document.createElement('div');
    renderHook(() => useAutoScroll({ current: el }, false, 1.5));
    vi.advanceTimersByTime(1000);
    expect(el.scrollTop).toBe(0);
  });

  it('stops when switched off', () => {
    const el = document.createElement('div');
    const { rerender } = renderHook(({ on }) => useAutoScroll({ current: el }, on, 1), {
      initialProps: { on: true },
    });
    vi.advanceTimersByTime(100);
    rerender({ on: false });
    vi.advanceTimersByTime(500);
    expect(el.scrollTop).toBe(4);
  });

  it('stops on unmount', () => {
    const el = document.createElement('div');
    const { unmount } = renderHook(() => useAutoScroll({ current: el }, true, 1));
    vi.advanceTimersByTime(50);
    unmount();
    vi.advanceTimersByTime(500);
    expect(el.scrollTop).toBe(2);
  });

  it('tolerates a ref with no element', () => {
    renderHook(() => useAutoScroll({ current: null }, true, 1));
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
  });
});
