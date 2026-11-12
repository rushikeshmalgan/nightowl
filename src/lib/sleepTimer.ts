/** Whatever is currently making sound, as far as the sleep timer needs to know. */
export interface SleepTarget {
  /** False for sources such as Spotify, whose volume the app cannot set. */
  canSetVolume: boolean;
  getVolume(): number;
  setVolume(volume: number): void;
  pause(): void;
}

export interface SleepTimer {
  start(minutes: 15 | 30 | 60): void;
  cancel(): void;
  /** Milliseconds until playback stops, or null when no timer is running. */
  remainingMs(): number | null;
  /** Called when the timer starts, is cancelled, or fires. */
  subscribe(listener: () => void): () => void;
}

const FADE_STEP_MS = 250;

/**
 * Stops playback after a set time. Over the last `fadeMs` it lowers the
 * volume, then pauses and puts the volume back for next time. The target is
 * looked up when the fade begins, so it pauses whatever is playing then.
 */
export function createSleepTimer(opts: { resolve: () => SleepTarget; fadeMs?: number }): SleepTimer {
  const fadeMs = opts.fadeMs ?? 5000;
  const listeners = new Set<() => void>();

  let endAt: number | null = null;
  let startTimer: ReturnType<typeof setTimeout> | null = null;
  let stepTimer: ReturnType<typeof setInterval> | null = null;
  let endTimer: ReturnType<typeof setTimeout> | null = null;
  let fading: { target: SleepTarget; original: number } | null = null;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const clearTimers = () => {
    if (startTimer) clearTimeout(startTimer);
    if (stepTimer) clearInterval(stepTimer);
    if (endTimer) clearTimeout(endTimer);
    startTimer = stepTimer = endTimer = null;
  };

  /** Stops the timer. A volume that had begun to fade goes back to where it was. */
  const reset = () => {
    clearTimers();
    if (fading) fading.target.setVolume(fading.original);
    fading = null;
    endAt = null;
  };

  const finish = (target: SleepTarget) => {
    const original = fading?.original;
    clearTimers();
    target.pause();
    if (original !== undefined) target.setVolume(original);
    fading = null;
    endAt = null;
    notify();
  };

  const beginFade = () => {
    const target = opts.resolve();
    const end = endAt ?? Date.now();
    if (target.canSetVolume) {
      const original = target.getVolume();
      fading = { target, original };
      stepTimer = setInterval(() => {
        const left = Math.max(0, end - Date.now());
        target.setVolume(original * (left / fadeMs));
      }, FADE_STEP_MS);
    }
    endTimer = setTimeout(() => finish(target), Math.max(0, end - Date.now()));
  };

  return {
    start(minutes) {
      reset();
      const total = minutes * 60_000;
      endAt = Date.now() + total;
      startTimer = setTimeout(beginFade, Math.max(0, total - fadeMs));
      notify();
    },
    cancel() {
      const wasRunning = endAt !== null;
      reset();
      if (wasRunning) notify();
    },
    remainingMs() {
      return endAt === null ? null : Math.max(0, endAt - Date.now());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let resolver: () => SleepTarget = () => {
  throw new Error('No sleep target is registered.');
};

/** Tells the shared timer how to find what is playing right now. */
export function setSleepTargetResolver(resolve: () => SleepTarget): void {
  resolver = resolve;
}

/** The app's single sleep timer. Starting it again replaces the running one. */
export const sleepTimer: SleepTimer = createSleepTimer({ resolve: () => resolver() });
