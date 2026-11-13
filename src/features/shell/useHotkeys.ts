import { useEffect, useRef } from 'react';

export type HotkeyMap = Record<string, () => void>;

/**
 * `mod+k` matches Ctrl+K or Cmd+K. A bare combo such as `f` or `ArrowLeft`
 * matches only when no Ctrl, Meta or Alt is held, so browser shortcuts like
 * Ctrl+F are never taken over.
 */
export function matchHotkey(e: KeyboardEvent, combo: string): boolean {
  const wantsMod = combo.startsWith('mod+');
  const wanted = (wantsMod ? combo.slice(4) : combo).toLowerCase();
  const hasMod = e.ctrlKey || e.metaKey;
  if (wantsMod !== hasMod) return false;
  if (e.altKey) return false;
  return e.key.toLowerCase() === wanted;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

export function useHotkeys(map: HotkeyMap): void {
  const latest = useRef(map);
  latest.current = map;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      for (const combo of Object.keys(latest.current)) {
        if (matchHotkey(event, combo)) {
          event.preventDefault();
          latest.current[combo]();
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
