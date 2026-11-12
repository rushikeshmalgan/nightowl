import type { SleepTarget } from '../sleepTimer';
import { loadStream } from './streamed';
import { createSynth } from './synth';
import type { SynthHandle } from './synth';
import { AUDIO_TRACKS } from './tracks';
import type { TrackId } from './tracks';

export interface AudioEngineState {
  playing: boolean;
  trackId: TrackId;
  /** 0 to 1. */
  volume: number;
  /** Where the sound is coming from while playing. */
  source: 'stream' | 'synth' | null;
  error: string | null;
}

export interface AudioEngineOptions {
  /** Base URL of hosted track files. Without it, tracks are synthesized. */
  cdnBase?: string;
  createContext?: () => AudioContext;
  createAudio?: (url: string) => HTMLAudioElement;
}

export const AUDIO_BLOCKED_ERROR = 'Audio is blocked until you click or press a key.';
export const AUDIO_UNSUPPORTED_ERROR = 'Audio is not supported in this browser.';

function defaultContext(): AudioContext {
  const scope = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) throw new Error('Web Audio is unavailable');
  return new Ctor();
}

/**
 * The ambient sound engine: one AudioContext feeding a master gain, then an
 * analyser, then the speakers. A track plays from a hosted file when one is
 * configured and loads, and from the built-in synth otherwise.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private synth: SynthHandle | null = null;
  private stream: { element: HTMLAudioElement; node: MediaElementAudioSourceNode } | null = null;
  private readonly attached = new Map<HTMLMediaElement, MediaElementAudioSourceNode>();
  private readonly listeners = new Set<(state: AudioEngineState) => void>();
  /** Bumped on every play or pause, so a slow stream load can tell it is stale. */
  private generation = 0;
  private state: AudioEngineState = { playing: false, trackId: 'lofi', volume: 0.5, source: null, error: null };

  constructor(private readonly opts: AudioEngineOptions = {}) {}

  getState(): AudioEngineState {
    return this.state;
  }

  subscribe(listener: (state: AudioEngineState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  async play(trackId?: TrackId): Promise<void> {
    if (trackId) this.update({ trackId });
    const ctx = this.ensureContext();
    if (!ctx) {
      this.update({ playing: false, source: null, error: AUDIO_UNSUPPORTED_ERROR });
      return;
    }
    if (!(await this.unlock(ctx))) {
      this.update({ playing: false, source: null, error: AUDIO_BLOCKED_ERROR });
      return;
    }

    const generation = ++this.generation;
    this.stopSources();
    const id = this.state.trackId;
    const master = this.master as GainNode;

    if (this.opts.cdnBase) {
      const started = await this.startStream(ctx, master, id, generation);
      if (generation !== this.generation) return;
      if (started) {
        this.update({ playing: true, source: 'stream', error: null });
        return;
      }
    }

    this.synth = createSynth(ctx, id, master);
    this.update({ playing: true, source: 'synth', error: null });
  }

  pause(): void {
    this.generation += 1;
    this.stopSources();
    this.update({ playing: false, source: null });
  }

  async setTrack(id: TrackId): Promise<void> {
    if (this.state.playing) await this.play(id);
    else this.update({ trackId: id });
  }

  setVolume(volume: number): void {
    const clamped = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
    if (this.master) this.master.gain.value = clamped;
    this.update({ volume: clamped });
  }

  /** Browsers start audio suspended until a user gesture; call this from one. */
  async resumeIfSuspended(): Promise<void> {
    if (!this.ctx) return;
    if ((await this.unlock(this.ctx)) && this.state.error === AUDIO_BLOCKED_ERROR) {
      this.update({ error: null });
    }
  }

  /** Routes another audio element (an uploaded track) through the same volume and analyser. */
  attachElement(element: HTMLMediaElement): void {
    if (this.attached.has(element)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const node = ctx.createMediaElementSource(element);
    node.connect(this.master);
    this.attached.set(element, node);
  }

  detachElement(element: HTMLMediaElement): void {
    this.attached.get(element)?.disconnect();
    this.attached.delete(element);
  }

  dispose(): void {
    this.pause();
    for (const node of this.attached.values()) node.disconnect();
    this.attached.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.analyser = null;
  }

  private update(patch: Partial<AudioEngineState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const ctx = (this.opts.createContext ?? defaultContext)();
      const master = ctx.createGain();
      master.gain.value = this.state.volume;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      master.connect(analyser);
      analyser.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.analyser = analyser;
      return ctx;
    } catch {
      return null;
    }
  }

  private async unlock(ctx: AudioContext): Promise<boolean> {
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === 'running';
  }

  /** True if the hosted file is now playing; false means use the synth. */
  private async startStream(ctx: AudioContext, master: GainNode, id: TrackId, generation: number): Promise<boolean> {
    const track = AUDIO_TRACKS.find((candidate) => candidate.id === id);
    if (!track || !this.opts.cdnBase) return false;
    const url = `${this.opts.cdnBase.replace(/\/+$/, '')}/${track.file}`;
    let element: HTMLAudioElement;
    try {
      element = await loadStream(url, { createAudio: this.opts.createAudio });
    } catch {
      return false;
    }
    if (generation !== this.generation) return false;
    const node = ctx.createMediaElementSource(element);
    node.connect(master);
    try {
      await element.play();
    } catch {
      node.disconnect();
      return false;
    }
    if (generation !== this.generation) {
      element.pause();
      node.disconnect();
      return false;
    }
    this.stream = { element, node };
    return true;
  }

  private stopSources(): void {
    this.synth?.stop();
    this.synth = null;
    if (this.stream) {
      this.stream.element.pause();
      this.stream.node.disconnect();
      this.stream = null;
    }
  }
}

/** Lets the sleep timer fade and pause the engine. */
export function engineSleepTarget(engine: AudioEngine): SleepTarget {
  return {
    canSetVolume: true,
    getVolume: () => engine.getState().volume,
    setVolume: (volume) => engine.setVolume(volume),
    pause: () => engine.pause(),
  };
}
