  import { useCallback, useSyncExternalStore } from 'react';

/** A mouse or trackpad that can hover. Touch screens fail this, so nothing opens from a swipe. */
export const FINE_HOVER_QUERY = '(hover: hover) and (pointer: fine)';
/** Below Tailwind's `sm` breakpoint (640px): the layout where panels become bottom sheets. */
export const NARROW_QUERY = '(width < 40rem)';

/** Whether a CSS media query matches right now, updating as the device or window changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
