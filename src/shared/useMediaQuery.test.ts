import { act, renderHook } from '@testing-library/react';
import { setMedia } from '../test/media';
import { FINE_HOVER_QUERY, NARROW_QUERY, useMediaQuery } from './useMediaQuery';

describe('useMediaQuery', () => {
  it('uses the spec queries', () => {
    expect(FINE_HOVER_QUERY).toBe('(hover: hover) and (pointer: fine)');
    expect(NARROW_QUERY).toBe('(width < 40rem)');
  });

  it('reports whether the query matches', () => {
    const { result } = renderHook(() => ({
      hover: useMediaQuery(FINE_HOVER_QUERY),
      narrow: useMediaQuery(NARROW_QUERY),
    }));
    expect(result.current).toEqual({ hover: true, narrow: false });
  });

  it('follows the device as it changes, with no remount', () => {
    const { result } = renderHook(() => useMediaQuery(FINE_HOVER_QUERY));
    expect(result.current).toBe(true);
    act(() => setMedia({ hover: false }));
    expect(result.current).toBe(false);
    act(() => setMedia({ hover: true }));
    expect(result.current).toBe(true);
  });

  it('is false when the browser has no matchMedia', () => {
    const original = window.matchMedia;
    // @ts-expect-error simulating an old browser
    delete window.matchMedia;
    try {
      const { result } = renderHook(() => useMediaQuery(FINE_HOVER_QUERY));
      expect(result.current).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});
