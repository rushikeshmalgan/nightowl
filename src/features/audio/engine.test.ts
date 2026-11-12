import { asContext, FakeAudioContext } from '../../test/fakeAudio';
import { AUDIO_BLOCKED_ERROR, AUDIO_UNSUPPORTED_ERROR, AudioEngine, engineSleepTarget } from './engine';

interface FakeAudio extends EventTarget {
  src: string;
  loop: boolean;
  crossOrigin: string | null;
  preload: string;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
}

function makeAudio(url: string): FakeAudio {
  const el = new EventTarget() as FakeAudio;
  el.src = url;
  el.loop = false;
  el.crossOrigin = null;
  el.preload = '';
  el.play = vi.fn(async () => {});
  el.pause = vi.fn();
  el.load = vi.fn();
  el.removeAttribute = vi.fn();
  return el;
}

function setup(opts: { cdnBase?: string } = {}) {
  const ctx = new FakeAudioContext();
  const audios: FakeAudio[] = [];
  const engine = new AudioEngine({
    ...opts,
    createContext: () => asContext(ctx),
    createAudio: (url) => {
      const el = makeAudio(url);
      audios.push(el);
      return el as unknown as HTMLAudioElement;
    },
  });
  return { ctx, audios, engine };
}

/** Starts playback and resolves the pending stream load with the given event. */
async function playWithStream(engine: AudioEngine, audios: FakeAudio[], event: 'canplay' | 'error') {
  const playing = engine.play();
  await vi.waitFor(() => expect(audios.length).toBeGreaterThan(0));
  audios[audios.length - 1].dispatchEvent(new Event(event));
  await playing;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('AudioEngine', () => {
  it('starts idle on the lo-fi track at half volume', () => {
    const { engine } = setup();
    expect(engine.getState()).toEqual({ playing: false, trackId: 'lofi', volume: 0.5, source: null, error: null });
    expect(engine.getAnalyser()).toBeNull();
  });

  it('plays the synth when no audio CDN is configured', async () => {
    const { engine, ctx, audios } = setup();
    await engine.play();
    expect(engine.getState()).toMatchObject({ playing: true, source: 'synth', error: null });
    expect(ctx.started('oscillator').length).toBeGreaterThanOrEqual(2);
    expect(audios).toHaveLength(0);
    expect(engine.getAnalyser()).not.toBeNull();
  });

  it('routes sound through the master gain at the current volume', async () => {
    const { engine, ctx } = setup();
    await engine.play();
    expect(ctx.of('gain')[0].gain.value).toBe(0.5);
    expect(ctx.of('analyser')).toHaveLength(1);
  });

  it('streams the track when the CDN file loads', async () => {
    const { engine, ctx, audios } = setup({ cdnBase: 'https://cdn.example/audio' });
    await playWithStream(engine, audios, 'canplay');
    expect(engine.getState()).toMatchObject({ playing: true, source: 'stream' });
    expect(audios[0].src).toBe('https://cdn.example/audio/lofi.mp3');
    expect(audios[0].loop).toBe(true);
    expect(audios[0].crossOrigin).toBe('anonymous');
    expect(audios[0].play).toHaveBeenCalled();
    expect(ctx.of('mediaElementSource')).toHaveLength(1);
    expect(ctx.started('oscillator')).toHaveLength(0);
  });

  it('tolerates a trailing slash on the CDN base', async () => {
    const { engine, audios } = setup({ cdnBase: 'https://cdn.example/audio/' });
    await playWithStream(engine, audios, 'canplay');
    expect(audios[0].src).toBe('https://cdn.example/audio/lofi.mp3');
  });

  it('falls back to the synth when the stream errors', async () => {
    const { engine, ctx, audios } = setup({ cdnBase: 'https://cdn.example/audio' });
    await playWithStream(engine, audios, 'error');
    expect(engine.getState()).toMatchObject({ playing: true, source: 'synth', error: null });
    expect(ctx.started('oscillator').length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to the synth when the stream does not load within 5 seconds', async () => {
    vi.useFakeTimers();
    const { engine } = setup({ cdnBase: 'https://cdn.example/audio' });
    const playing = engine.play();
    await vi.advanceTimersByTimeAsync(5000);
    await playing;
    expect(engine.getState()).toMatchObject({ playing: true, source: 'synth' });
  });

  it('falls back to the synth when the browser refuses to start the stream', async () => {
    const { engine, audios } = setup({ cdnBase: 'https://cdn.example/audio' });
    const playing = engine.play();
    await vi.waitFor(() => expect(audios.length).toBe(1));
    audios[0].play.mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    audios[0].dispatchEvent(new Event('canplay'));
    await playing;
    expect(engine.getState()).toMatchObject({ playing: true, source: 'synth' });
  });

  it('clamps the volume to 0..1 and applies it', async () => {
    const { engine, ctx } = setup();
    await engine.play();
    engine.setVolume(2);
    expect(engine.getState().volume).toBe(1);
    expect(ctx.of('gain')[0].gain.value).toBe(1);
    engine.setVolume(-3);
    expect(engine.getState().volume).toBe(0);
    engine.setVolume(Number.NaN);
    expect(engine.getState().volume).toBe(0);
  });

  it('remembers a volume set before the first play', async () => {
    const { engine, ctx } = setup();
    engine.setVolume(0.2);
    await engine.play();
    expect(ctx.of('gain')[0].gain.value).toBe(0.2);
  });

  it('pauses: stops the synth and reports not playing', async () => {
    const { engine, ctx } = setup();
    await engine.play();
    const oscillators = ctx.started('oscillator');
    engine.pause();
    expect(engine.getState()).toMatchObject({ playing: false, source: null });
    for (const osc of oscillators) expect(osc.stop).toHaveBeenCalled();
  });

  it('pauses a stream', async () => {
    const { engine, audios } = setup({ cdnBase: 'https://cdn.example/audio' });
    await playWithStream(engine, audios, 'canplay');
    engine.pause();
    expect(audios[0].pause).toHaveBeenCalled();
    expect(engine.getState().playing).toBe(false);
  });

  it('switches track while playing and replaces the old sound', async () => {
    const { engine, ctx } = setup();
    await engine.play();
    const first = ctx.started('oscillator');
    await engine.setTrack('pink');
    expect(engine.getState()).toMatchObject({ playing: true, trackId: 'pink' });
    for (const osc of first) expect(osc.stop).toHaveBeenCalled();
    expect(ctx.started('bufferSource').length).toBeGreaterThanOrEqual(1);
  });

  it('only notes the track when changed while paused', async () => {
    const { engine, ctx } = setup();
    await engine.setTrack('rain');
    expect(engine.getState()).toMatchObject({ playing: false, trackId: 'rain' });
    expect(ctx.nodes.filter((n) => n.kind === 'oscillator' || n.kind === 'bufferSource')).toHaveLength(0);
  });

  it('reports blocked audio instead of pretending to play when resume is refused', async () => {
    const { engine, ctx } = setup();
    ctx.state = 'suspended';
    ctx.resumeRejects = true;
    await engine.play();
    expect(engine.getState()).toMatchObject({ playing: false, source: null, error: AUDIO_BLOCKED_ERROR });
    expect(AUDIO_BLOCKED_ERROR).toBe('Audio is blocked until you click or press a key.');
    expect(ctx.started('oscillator')).toHaveLength(0);
  });

  it('reports blocked audio when the context stays suspended', async () => {
    const { engine, ctx } = setup();
    ctx.state = 'suspended';
    ctx.resumeStaysSuspended = true;
    await engine.play();
    expect(engine.getState()).toMatchObject({ playing: false, error: AUDIO_BLOCKED_ERROR });
  });

  it('clears the blocked message once the context can resume', async () => {
    const { engine, ctx } = setup();
    ctx.state = 'suspended';
    ctx.resumeRejects = true;
    await engine.play();
    ctx.resumeRejects = false;
    await engine.resumeIfSuspended();
    expect(ctx.state).toBe('running');
    expect(engine.getState().error).toBeNull();
  });

  it('says so when the browser has no Web Audio', async () => {
    const engine = new AudioEngine();
    await engine.play();
    expect(engine.getState()).toMatchObject({ playing: false, error: AUDIO_UNSUPPORTED_ERROR });
    expect(AUDIO_UNSUPPORTED_ERROR).toBe('Audio is not supported in this browser.');
  });

  it('notifies subscribers of state changes until they unsubscribe', async () => {
    const { engine } = setup();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);
    await engine.play();
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ playing: true }));
    const calls = listener.mock.calls.length;
    unsubscribe();
    engine.pause();
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it('discards a stream that finishes loading after playback was paused', async () => {
    const { engine, audios } = setup({ cdnBase: 'https://cdn.example/audio' });
    const playing = engine.play();
    await vi.waitFor(() => expect(audios.length).toBe(1));
    engine.pause();
    audios[0].dispatchEvent(new Event('canplay'));
    await playing;
    expect(engine.getState()).toMatchObject({ playing: false, source: null });
    expect(audios[0].play).not.toHaveBeenCalled();
  });

  it('routes an attached media element through the master gain, once', () => {
    const { engine, ctx } = setup();
    const el = makeAudio('blob:track') as unknown as HTMLMediaElement;
    engine.attachElement(el);
    engine.attachElement(el);
    const sources = ctx.of('mediaElementSource');
    expect(sources).toHaveLength(1);
    expect(sources[0].connect).toHaveBeenCalledWith(ctx.of('gain')[0]);
    engine.detachElement(el);
    expect(sources[0].disconnect).toHaveBeenCalled();
  });

  it('closes the context on dispose', async () => {
    const { engine, ctx } = setup();
    await engine.play();
    engine.dispose();
    expect(ctx.close).toHaveBeenCalled();
    expect(engine.getState().playing).toBe(false);
  });
});

describe('engineSleepTarget', () => {
  it('lets the sleep timer fade and pause the engine', async () => {
    const { engine } = setup();
    await engine.play();
    const target = engineSleepTarget(engine);
    expect(target.canSetVolume).toBe(true);
    expect(target.getVolume()).toBe(0.5);
    target.setVolume(0.1);
    expect(engine.getState().volume).toBe(0.1);
    target.pause();
    expect(engine.getState().playing).toBe(false);
  });
});
