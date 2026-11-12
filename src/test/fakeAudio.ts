/** A recording stand-in for the Web Audio API, enough for the synth and engine tests. */

export interface FakeParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  setTargetAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
}

export interface FakeNode {
  kind: string;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  frequency: FakeParam;
  gain: FakeParam;
  Q: FakeParam;
  detune: FakeParam;
  type: string;
  buffer: unknown;
  loop: boolean;
  fftSize: number;
  getByteTimeDomainData: ReturnType<typeof vi.fn>;
  mediaElement?: unknown;
}

function param(value: number): FakeParam {
  const p: FakeParam = {
    value,
    setValueAtTime: vi.fn((v: number) => {
      p.value = v;
    }),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
  return p;
}

export class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  currentTime = 0;
  sampleRate = 8000;
  nodes: FakeNode[] = [];
  destination = this.node('destination');
  /** Set to make `resume()` reject, as a browser does without a user gesture. */
  resumeRejects = false;
  /** Set to make `resume()` resolve but leave the context suspended. */
  resumeStaysSuspended = false;

  resume = vi.fn(async () => {
    if (this.resumeRejects) throw new DOMException('not allowed', 'NotAllowedError');
    if (!this.resumeStaysSuspended) this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });

  private node(kind: string): FakeNode {
    const node: FakeNode = {
      kind,
      connect: vi.fn((target: unknown) => target),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: param(440),
      gain: param(1),
      Q: param(1),
      detune: param(0),
      type: '',
      buffer: null,
      loop: false,
      fftSize: 2048,
      getByteTimeDomainData: vi.fn(),
    };
    this.nodes?.push(node);
    return node;
  }

  createOscillator = () => this.node('oscillator');
  createBufferSource = () => this.node('bufferSource');
  createGain = () => this.node('gain');
  createBiquadFilter = () => this.node('filter');
  createAnalyser = () => this.node('analyser');
  createMediaElementSource = (element: unknown) => {
    const node = this.node('mediaElementSource');
    node.mediaElement = element;
    return node;
  };
  createBuffer = (_channels: number, length: number, sampleRate: number) => {
    const data = new Float32Array(length);
    return { length, sampleRate, getChannelData: () => data };
  };

  of(kind: string): FakeNode[] {
    return this.nodes.filter((node) => node.kind === kind);
  }

  started(kind: string): FakeNode[] {
    return this.of(kind).filter((node) => node.start.mock.calls.length > 0);
  }
}

/** Casts the fake to the real type at the call site. */
export function asContext(fake: FakeAudioContext): AudioContext {
  return fake as unknown as AudioContext;
}
