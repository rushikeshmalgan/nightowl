import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { adapterSleepTarget } from './adapter';
import type { MusicAdapter, PlaybackState, PlaylistItem, SourceId } from './adapter';
import { setSleepTargetResolver } from '../audio/sleepTimer';
import { useSleepTimer } from '../audio/useSleepTimer';
import type { SleepMinutes } from '../audio/useSleepTimer';

export interface MusicSource {
  activeSource: SourceId;
  state: PlaybackState;
  /** Why the last `select` could not load its item, if it failed. */
  loadError: string | null;
  select(source: SourceId, item?: PlaylistItem): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<void>;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  next(): void;
  previous(): void;
  setSleepTimer(minutes: SleepMinutes): void;
  sleepMinutes: SleepMinutes;
  sleepRemainingMs: number | null;
}

/** One active music source at a time; the dock talks only to this. */
export function useMusicSource(adapters: Record<SourceId, MusicAdapter>, initial: SourceId = 'noise'): MusicSource {
  const [activeSource, setActiveSource] = useState<SourceId>(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeRef = useRef(activeSource);
  activeRef.current = activeSource;
  const sleep = useSleepTimer();

  const adapter = adapters[activeSource];

  const state = useSyncExternalStore(
    useCallback((onChange: () => void) => adapter.subscribe(() => onChange()), [adapter]),
    () => adapter.getState(),
  );

  // The sleep timer pauses whatever is active when it fires.
  useEffect(() => {
    setSleepTargetResolver(() => adapterSleepTarget(adapters[activeRef.current]));
  }, [adapters]);

  const select = useCallback(
    async (source: SourceId, item?: PlaylistItem) => {
      if (source !== activeRef.current) adapters[activeRef.current].pause();
      activeRef.current = source;
      setActiveSource(source);
      setLoadError(null);
      if (!item) return;
      try {
        await adapters[source].load(item);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'This could not be loaded.');
      }
    },
    [adapters],
  );

  const current = () => adapters[activeRef.current];

  return {
    activeSource,
    state,
    loadError,
    select,
    play: useCallback(() => adapters[activeRef.current].play(), [adapters]),
    pause: useCallback(() => adapters[activeRef.current].pause(), [adapters]),
    toggle: useCallback(async () => {
      const active = adapters[activeRef.current];
      if (active.getState().isPlaying) active.pause();
      else await active.play();
    }, [adapters]),
    seek: (seconds) => current().seek(seconds),
    setVolume: (volume) => current().setVolume(volume),
    next: () => current().next(),
    previous: () => current().previous(),
    setSleepTimer: sleep.set,
    sleepMinutes: sleep.minutes,
    sleepRemainingMs: sleep.remainingMs,
  };
}
