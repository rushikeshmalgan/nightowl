import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { AudioEngineState } from '../lib/audio/engine';
import { getAudioEngine } from '../lib/audio/instance';
import { isTrackId } from '../lib/audio/tracks';
import type { TrackId } from '../lib/audio/tracks';
import { getPref, setPref } from '../lib/prefs';

export interface AudioControls {
  /** True once the saved track and volume have been applied. */
  ready: boolean;
  state: AudioEngineState;
  /** Available after the first play; drives the waveform and LED. */
  analyser: AnalyserNode | null;
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<void>;
  setTrack(id: TrackId): Promise<void>;
  setVolume(volume: number): void;
}

/** The ambient sound engine as React state, with the track and volume remembered. */
export function useAudioEngine(): AudioControls {
  const engine = getAudioEngine();
  const [ready, setReady] = useState(false);

  const state = useSyncExternalStore(
    useCallback((onChange: () => void) => engine.subscribe(() => onChange()), [engine]),
    () => engine.getState(),
  );

  // Restore what the reader last chose.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [track, volume] = await Promise.all([
        getPref<unknown>('audioTrack', null),
        getPref<unknown>('audioVolume', null),
      ]);
      if (cancelled) return;
      if (isTrackId(track)) await engine.setTrack(track);
      if (typeof volume === 'number' && volume >= 0 && volume <= 1) engine.setVolume(volume);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [engine]);

  // Browsers keep audio suspended until the reader interacts with the page.
  useEffect(() => {
    const unlock = () => void engine.resumeIfSuspended();
    const onVisible = () => {
      if (document.visibilityState === 'visible') unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [engine]);

  const play = useCallback(() => engine.play(), [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);
  const toggle = useCallback(async () => {
    if (engine.getState().playing) engine.pause();
    else await engine.play();
  }, [engine]);
  const setTrack = useCallback(
    async (id: TrackId) => {
      await engine.setTrack(id);
      void setPref('audioTrack', id);
    },
    [engine],
  );
  const setVolume = useCallback(
    (volume: number) => {
      engine.setVolume(volume);
      void setPref('audioVolume', engine.getState().volume);
    },
    [engine],
  );

  return { ready, state, analyser: engine.getAnalyser(), play, pause, toggle, setTrack, setVolume };
}
