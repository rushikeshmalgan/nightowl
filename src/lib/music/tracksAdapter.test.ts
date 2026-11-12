import type { AudioEngine } from '../audio/engine';
import type { TrackRecord } from '../../types';
import { createTracksAdapter } from './tracksAdapter';

interface FakeElement extends EventTarget {
  src: string;
  crossOrigin: string | null;
  volume: number;
  currentTime: number;
  duration: number;
  paused: boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
}

function makeElement(): FakeElement {
  const el = new EventTarget() as FakeElement;
  Object.assign(el, {
    src: '',
    crossOrigin: null,
    volume: 1,
    currentTime: 0,
    duration: 180,
    paused: true,
    play: vi.fn(async () => {
      el.paused = false;
      el.dispatchEvent(new Event('play'));
    }),
    pause: vi.fn(() => {
      el.paused = true;
      el.dispatchEvent(new Event('pause'));
    }),
    removeAttribute: vi.fn(),
    load: vi.fn(),
  });
  return el;
}

const blobTrack: TrackRecord = { id: 't1', title: 'Night Drive', artist: 'Me', language: 'EN', duration: 180, blob: new Blob(['x']), addedAt: 2 };
const streamTrack: TrackRecord = { id: 't2', title: 'Radio', artist: '', language: null, duration: 0, url: 'https://radio.example/live', addedAt: 1 };

function setup(tracks: TrackRecord[] = [blobTrack, streamTrack]) {
  const elements: FakeElement[] = [];
  const engine = {
    attachElement: vi.fn(),
    detachElement: vi.fn(),
    setVolume: vi.fn(),
    getState: () => ({ volume: 0.5 }),
  } as unknown as AudioEngine & { attachElement: ReturnType<typeof vi.fn>; setVolume: ReturnType<typeof vi.fn> };
  const createObjectUrl = vi.fn(() => 'blob:local/1');
  const revokeObjectUrl = vi.fn();
  const adapter = createTracksAdapter(engine, {
    createAudio: () => {
      const el = makeElement();
      elements.push(el);
      return el as unknown as HTMLAudioElement;
    },
    createObjectUrl,
    revokeObjectUrl,
    getTracks: async () => tracks,
  });
  return { adapter, engine, elements, createObjectUrl, revokeObjectUrl };
}

const itemFor = (track: TrackRecord) => ({ id: track.id, source: 'tracks' as const, ref: track.id, title: track.title, artist: track.artist, language: track.language });

describe('createTracksAdapter', () => {
  it('plays an uploaded file from an object URL through the engine', async () => {
    const { adapter, engine, elements, createObjectUrl } = setup();
    await adapter.load(itemFor(blobTrack));
    await adapter.play();
    expect(createObjectUrl).toHaveBeenCalledWith(blobTrack.blob);
    expect(elements[0].src).toBe('blob:local/1');
    expect(elements[0].crossOrigin).toBe('anonymous');
    expect(engine.attachElement).toHaveBeenCalledWith(elements[0]);
    expect(elements[0].play).toHaveBeenCalled();
    expect(adapter.getState()).toMatchObject({ title: 'Night Drive', artist: 'Me', isPlaying: true, canSeek: true, canSkip: true });
  });

  it('plays a stream from its URL', async () => {
    const { adapter, elements, createObjectUrl } = setup();
    await adapter.load(itemFor(streamTrack));
    expect(elements[0].src).toBe('https://radio.example/live');
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it('frees the object URL on dispose', async () => {
    const { adapter, revokeObjectUrl } = setup();
    await adapter.load(itemFor(blobTrack));
    adapter.dispose();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:local/1');
  });

  it('wraps from the last track to the first', async () => {
    const { adapter } = setup();
    await adapter.load(itemFor(streamTrack));
    adapter.next();
    await vi.waitFor(() => expect(adapter.getState().title).toBe('Night Drive'));
    adapter.previous();
    await vi.waitFor(() => expect(adapter.getState().title).toBe('Radio'));
  });

  it('reports a track that will not play', async () => {
    const { adapter, elements } = setup();
    await adapter.load(itemFor(streamTrack));
    elements[0].dispatchEvent(new Event('error'));
    await vi.waitFor(() => expect(elements.length).toBe(2));
    elements[1].dispatchEvent(new Event('error'));
    expect(adapter.getState().error).toBe('This track could not be played.');
  });

  it('retries a stream without CORS and then controls volume on the element', async () => {
    const { adapter, engine, elements } = setup();
    await adapter.load(itemFor(streamTrack));
    elements[0].dispatchEvent(new Event('error'));
    await vi.waitFor(() => expect(elements.length).toBe(2));
    expect(elements[1].crossOrigin).toBeNull();
    expect(engine.attachElement).toHaveBeenCalledTimes(1);
    adapter.setVolume(0.3);
    expect(elements[1].volume).toBe(0.3);
    expect(engine.setVolume).not.toHaveBeenCalled();
    expect(adapter.getState().error).toBeNull();
  });

  it('routes volume through the engine when attached', async () => {
    const { adapter, engine } = setup();
    await adapter.load(itemFor(blobTrack));
    adapter.setVolume(0.4);
    expect(engine.setVolume).toHaveBeenCalledWith(0.4);
    expect(adapter.getState().volume).toBe(0.4);
  });

  it('seeks and reports progress', async () => {
    const { adapter, elements } = setup();
    await adapter.load(itemFor(blobTrack));
    adapter.seek(42);
    expect(elements[0].currentTime).toBe(42);
    elements[0].currentTime = 50;
    elements[0].dispatchEvent(new Event('timeupdate'));
    expect(adapter.getState().position).toBe(50);
  });

  it('explains an empty library', async () => {
    const { adapter } = setup([]);
    await adapter.load({ id: 'none', source: 'tracks', ref: 'missing', title: '', artist: '', language: null });
    expect(adapter.getState().error).toBe('Add a track to My Tracks first.');
  });
});
