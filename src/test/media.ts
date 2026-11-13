/**
 * A controllable stand-in for `window.matchMedia`, which jsdom does not have.
 * Tests describe the device with `setMedia`; components that read a media
 * query through `useMediaQuery` then re-render as a real browser would.
 * The default device is a desktop with a mouse: hover on, wide screen.
 */
interface MediaState {
  hover: boolean;
  narrow: boolean;
}

const DEFAULTS: MediaState = { hover: true, narrow: false };
let current: MediaState = { ...DEFAULTS };
const listeners = new Set<() => void>();

function evaluate(query: string): boolean {
  if (query.includes('hover: hover')) return current.hover;
  if (query.includes('width < 40rem')) return current.narrow;
  return false;
}

/** Changes the simulated device and tells every listener. */
export function setMedia(next: Partial<MediaState>): void {
  current = { ...current, ...next };
  for (const listener of [...listeners]) listener();
}

export function resetMedia(): void {
  current = { ...DEFAULTS };
  listeners.clear();
}

export function installMatchMedia(): void {
  window.matchMedia = ((query: string) => {
    let last = evaluate(query);
    const callbacks = new Set<(event: MediaQueryListEvent) => void>();
    const check = () => {
      const now = evaluate(query);
      if (now === last) return;
      last = now;
      for (const callback of callbacks) callback({ matches: now, media: query } as MediaQueryListEvent);
    };
    const list = {
      get matches() {
        return evaluate(query);
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => {
        if (callbacks.size === 0) listeners.add(check);
        callbacks.add(callback);
      },
      removeEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => {
        callbacks.delete(callback);
        if (callbacks.size === 0) listeners.delete(check);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
    return list as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}
