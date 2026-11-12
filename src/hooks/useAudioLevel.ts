import { useEffect, useState } from 'react';
import { rmsLevel } from '../lib/audio/levels';

const UPDATE_MS = 80;

/** The current loudness (0 to 1) read from the analyser, while `active`. */
export function useAudioLevel(analyser: AnalyserNode | null, active: boolean): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!analyser || !active || typeof requestAnimationFrame !== 'function') {
      setLevel(0);
      return;
    }
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let last = 0;
    const read = (now: number) => {
      if (now - last >= UPDATE_MS) {
        last = now;
        analyser.getByteTimeDomainData(samples);
        setLevel(rmsLevel(samples));
      }
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, [analyser, active]);

  return level;
}
