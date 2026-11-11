import { useEffect, useState } from 'react';

const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown'] as const;

/**
 * Reports `idle: true` after `delayMs` without pointer or key input.
 * Scrolling deliberately does not count as input: reading should not
 * bring the chrome back.
 */
export function useIdleFade(opts: { delayMs?: number; enabled?: boolean } = {}): { idle: boolean } {
  const { delayMs = 3000, enabled = true } = opts;
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), delayMs);
    };
    const wake = () => {
      setIdle(false);
      arm();
    };

    arm();
    for (const name of WAKE_EVENTS) window.addEventListener(name, wake);
    return () => {
      clearTimeout(timer);
      for (const name of WAKE_EVENTS) window.removeEventListener(name, wake);
    };
  }, [delayMs, enabled]);

  return { idle };
}
