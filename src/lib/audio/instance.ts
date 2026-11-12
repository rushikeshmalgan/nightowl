import { setSleepTargetResolver } from '../sleepTimer';
import { AudioEngine, engineSleepTarget } from './engine';

let engine: AudioEngine | null = null;

/** The app's one ambient audio engine, created on first use. */
export function getAudioEngine(): AudioEngine {
  if (!engine) {
    const cdnBase = import.meta.env.VITE_AUDIO_CDN_BASE?.trim();
    engine = new AudioEngine({ cdnBase: cdnBase || undefined });
    // Until a music source takes over, the sleep timer acts on this engine.
    const created = engine;
    setSleepTargetResolver(() => engineSleepTarget(created));
  }
  return engine;
}
