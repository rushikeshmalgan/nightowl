import { useEffect } from 'react';
import type { RefObject } from 'react';

const TICK_MS = 50;
const PX_PER_TICK = 2;

/** Scrolls the element down by `2 * speed` pixels every 50 ms while enabled. */
export function useAutoScroll(ref: RefObject<HTMLElement | null>, enabled: boolean, speed: number): void {
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const el = ref.current;
      if (el) el.scrollTop += PX_PER_TICK * speed;
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [ref, enabled, speed]);
}
