import * as scripts from './loadScript';
import { createSpotifyAdapter, SPOTIFY_LOAD_ERROR, spotifyWebUrl } from './spotify';
import type { SpotifyIFrameAPI } from './spotify';

vi.mock('./loadScript', () => ({ loadScript: vi.fn(async () => {}) }));

type Listener = (event: { data: Record<string, unknown> }) => void;

function fakeApi() {
  const controller = {
    listeners: new Map<string, Listener>(),
    addListener: vi.fn((name: string, fn: Listener) => controller.listeners.set(name, fn)),
    loadUri: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    destroy: vi.fn(),
    emit: (name: string, data: Record<string, unknown> = {}) => controller.listeners.get(name)?.({ data }),
  };
  const api = {
    createController: vi.fn((_el: HTMLElement, _opts: Record<string, unknown>, callback: (c: typeof controller) => void) =>
      callback(controller),
    ),
  };
  return { api: api as unknown as SpotifyIFrameAPI & typeof api, controller };
}

const preset = {
  id: 'x',
  source: 'spotify' as const,
  ref: 'spotify:playlist:37i9',
  title: 'Bollywood Acoustic',
  artist: 'Spotify',
  language: 'HI' as const,
  kind: 'playlist' as const,
};
const meta = vi.fn(async () => ({ title: 'Bollywood Acoustic (oEmbed)', thumbnailUrl: 'https://i.scdn.co/image/abc' }));

async function loaded() {
  const { api, controller } = fakeApi();
  const adapter = createSpotifyAdapter({ loadApi: async () => api, fetchMeta: meta });
  adapter.mount(document.createElement('div'));
  const loading = adapter.load(preset);
  await vi.waitFor(() => expect(api.createController).toHaveBeenCalled());
  controller.emit('ready');
  await loading;
  return { adapter, api, controller };
}

beforeEach(() => {
  meta.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSpotifyAdapter', () => {
  it('loads no script until something is loaded', () => {
    createSpotifyAdapter();
    expect(scripts.loadScript).not.toHaveBeenCalled();
  });

  it('creates the embed for the item URI at the compact height', async () => {
    const { api } = await loaded();
    expect(api.createController).toHaveBeenCalledWith(expect.any(HTMLElement), { uri: 'spotify:playlist:37i9', width: '100%', height: 152 }, expect.any(Function));
  });

  it('loads a later item into the same embed', async () => {
    const { adapter, api, controller } = await loaded();
    await adapter.load({ ...preset, ref: 'spotify:playlist:other' });
    expect(controller.loadUri).toHaveBeenCalledWith('spotify:playlist:other');
    expect(api.createController).toHaveBeenCalledTimes(1);
  });

  it('drives the embed', async () => {
    const { adapter, controller } = await loaded();
    await adapter.play();
    expect(controller.resume).toHaveBeenCalled();
    adapter.pause();
    expect(controller.pause).toHaveBeenCalled();
    adapter.seek(40);
    expect(controller.seek).toHaveBeenCalledWith(40);
  });

  it('turns playback updates into seconds', async () => {
    const { adapter, controller } = await loaded();
    controller.emit('playback_update', { position: 5000, duration: 30000, isPaused: false, isBuffering: false });
    expect(adapter.getState()).toMatchObject({ position: 5, duration: 30, isPlaying: true, loading: false });
    controller.emit('playback_update', { position: 6000, duration: 30000, isPaused: true, isBuffering: false });
    expect(adapter.getState().isPlaying).toBe(false);
  });

  it('cannot set the volume or skip', async () => {
    const { adapter } = await loaded();
    expect(adapter.getState()).toMatchObject({ canSetVolume: false, canSkip: false, canSeek: true });
    adapter.setVolume(0.2);
    expect(adapter.getState().volume).toBe(1);
  });

  it('takes the title and cover from oEmbed and the artist from the preset', async () => {
    const { adapter } = await loaded();
    await vi.waitFor(() => expect(adapter.getState().artUrl).toBe('https://i.scdn.co/image/abc'));
    expect(adapter.getState()).toMatchObject({ title: 'Bollywood Acoustic (oEmbed)', artist: 'Spotify', language: 'HI' });
    expect(meta).toHaveBeenCalledWith('https://open.spotify.com/playlist/37i9');
  });

  it('keeps the preset title when oEmbed fails', async () => {
    meta.mockRejectedValueOnce(new Error('offline'));
    const { adapter } = await loaded();
    await new Promise((r) => setTimeout(r, 0));
    expect(adapter.getState().title).toBe('Bollywood Acoustic');
  });

  it("says Spotify didn't load when the embed never gets ready", async () => {
    vi.useFakeTimers();
    const { api } = fakeApi();
    const adapter = createSpotifyAdapter({ loadApi: async () => api, fetchMeta: meta, readyTimeoutMs: 8000 });
    adapter.mount(document.createElement('div'));
    const loading = adapter.load(preset).catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await loading).toBe(SPOTIFY_LOAD_ERROR);
    expect(adapter.getState().error).toBe("Spotify didn't load.");
  });
});

describe('spotifyWebUrl', () => {
  it('turns a URI into an open.spotify.com link', () => {
    expect(spotifyWebUrl('spotify:playlist:37i9')).toBe('https://open.spotify.com/playlist/37i9');
  });
});
