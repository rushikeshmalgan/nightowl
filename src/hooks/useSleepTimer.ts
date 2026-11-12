import { useCallback, useEffect, useState } from 'react';
import { sleepTimer } from '../lib/sleepTimer';

export type SleepMinutes = 0 | 15 | 30 | 60;

export interface SleepControls {
  /** The chosen length, or 0 when the timer is off. */
  minutes: SleepMinutes;
  remainingMs: number | null;
  set(minutes: SleepMinutes): void;
}

/** The app's shared sleep timer as React state. */
export function useSleepTimer(): SleepControls {
  const [minutes, setMinutes] = useState<SleepMinutes>(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(() => sleepTimer.remainingMs());

  useEffect(() => {
    const sync = () => {
      const left = sleepTimer.remainingMs();
      setRemainingMs(left);
      if (left === null) setMinutes(0);
    };
    return sleepTimer.subscribe(sync);
  }, []);

  // Count down on screen only while a timer is running.
  const running = remainingMs !== null;
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setRemainingMs(sleepTimer.remainingMs()), 1000);
    return () => clearInterval(tick);
  }, [running]);

  const set = useCallback((next: SleepMinutes) => {
    if (next === 0) {
      sleepTimer.cancel();
      return;
    }
    sleepTimer.start(next);
    setMinutes(next);
  }, []);

  return { minutes, remainingMs, set };
}
