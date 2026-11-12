import type { TrackId } from './tracks';

export interface SynthHandle {
  stop(): void;
}

/**
 * Fills a buffer with pink noise (equal energy per octave), using Paul
 * Kellet's filter over white noise. Pink noise sounds softer and deeper than
 * the white noise hiss it replaces.
 */
export function fillPinkNoise(out: Float32Array): void {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    out[i] = Math.max(-1, Math.min(1, pink));
  }
}

/** Collects every node a recipe creates so the whole graph can be torn down. */
class Graph {
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private stopped = false;

  constructor(readonly ctx: AudioContext) {}

  private track<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  gain(value: number): GainNode {
    const node = this.track(this.ctx.createGain());
    node.gain.value = value;
    return node;
  }

  filter(type: BiquadFilterType, frequency: number, q = 1): BiquadFilterNode {
    const node = this.track(this.ctx.createBiquadFilter());
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  }

  oscillator(type: OscillatorType, frequency: number, detune = 0): OscillatorNode {
    const node = this.track(this.ctx.createOscillator());
    node.type = type;
    node.frequency.value = frequency;
    node.detune.value = detune;
    this.sources.push(node);
    node.start();
    return node;
  }

  /** A looping noise source filled by `fill`. */
  noise(seconds: number, fill: (data: Float32Array) => void): AudioBufferSourceNode {
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    fill(buffer.getChannelData(0));
    const node = this.track(this.ctx.createBufferSource());
    node.buffer = buffer;
    node.loop = true;
    this.sources.push(node);
    node.start();
    return node;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    for (const node of this.nodes) node.disconnect();
  }
}

function fillWhiteNoise(data: Float32Array): void {
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

/** Mostly silence with the odd click, like dust on a record. */
function fillCrackle(data: Float32Array): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() < 0.0012 ? (Math.random() * 2 - 1) * 0.9 : 0;
  }
}

/** A slow, warm A-minor-seventh pad with a little vinyl crackle. */
function lofi(graph: Graph, destination: AudioNode): void {
  const out = graph.gain(0.9);
  out.connect(destination);

  const warmth = graph.filter('lowpass', 720, 0.7);
  warmth.connect(out);
  const chord = [110, 130.81, 164.81, 196];
  chord.forEach((frequency, index) => {
    const voice = graph.oscillator(index % 2 === 0 ? 'sine' : 'triangle', frequency, index % 2 === 0 ? -6 : 7);
    const level = graph.gain(0.11);
    voice.connect(level);
    level.connect(warmth);
  });

  // The filter breathes very slowly, which keeps the pad from sounding static.
  const sweep = graph.oscillator('sine', 0.07);
  const sweepDepth = graph.gain(180);
  sweep.connect(sweepDepth);
  sweepDepth.connect(warmth.frequency);

  const crackle = graph.noise(4, fillCrackle);
  const crackleTone = graph.filter('highpass', 1800, 0.5);
  const crackleLevel = graph.gain(0.05);
  crackle.connect(crackleTone);
  crackleTone.connect(crackleLevel);
  crackleLevel.connect(out);
}

/** Band-passed noise that swells and eases like steady rain, over a low rumble. */
function rain(graph: Graph, destination: AudioNode): void {
  const out = graph.gain(0.8);
  out.connect(destination);

  const drops = graph.noise(3, fillWhiteNoise);
  const dropTone = graph.filter('bandpass', 1400, 0.6);
  const dropLevel = graph.gain(0.32);
  drops.connect(dropTone);
  dropTone.connect(dropLevel);
  dropLevel.connect(out);

  const swell = graph.oscillator('sine', 0.13);
  const swellDepth = graph.gain(0.1);
  swell.connect(swellDepth);
  swellDepth.connect(dropLevel.gain);

  const rumble = graph.noise(4, fillPinkNoise);
  const rumbleTone = graph.filter('lowpass', 160, 0.7);
  const rumbleLevel = graph.gain(0.5);
  rumble.connect(rumbleTone);
  rumbleTone.connect(rumbleLevel);
  rumbleLevel.connect(out);
}

/** Plain pink noise. */
function pink(graph: Graph, destination: AudioNode): void {
  const out = graph.gain(0.7);
  out.connect(destination);
  graph.noise(4, fillPinkNoise).connect(out);
}

const RECIPES: Record<TrackId, (graph: Graph, destination: AudioNode) => void> = { lofi, rain, pink };

/** Starts the synthesized version of a track, playing into `destination`. */
export function createSynth(ctx: AudioContext, id: TrackId, destination: AudioNode): SynthHandle {
  const graph = new Graph(ctx);
  RECIPES[id](graph, destination);
  return { stop: () => graph.stop() };
}
