import { createSpotifyAdapter, spotifyEmbedUrl, spotifyWebUrl } from './spotify';

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

beforeEach(() => {
  meta.mockClear();
});

function mounted() {
  const host = document.createElement('div');
  const adapter = createSpotifyAdapter({ fetchMeta: meta });
  adapter.mount(host);
  return { adapter, host };
}

describe('createSpotifyAdapter', () => {
  it('adds no third-party script to the page', async () => {
    const before = document.scripts.length;
    const { adapter } = mounted();
    await adapter.load(preset);
    expect(document.scripts.length).toBe(before);
  });

  it("shows Spotify's own embed for the item at the compact height", async () => {
    const { adapter, host } = mounted();
    await adapter.load(preset);
    const frame = host.querySelector('iframe');
    expect(frame?.src).toBe('https://open.spotify.com/embed/playlist/37i9?theme=0');
    expect(frame?.height).toBe('152');
    expect(frame?.getAttribute('allow')).toContain('encrypted-media');
    expect(frame?.title).toBe('Spotify player: Bollywood Acoustic');
  });

  it('reuses the same embed for the next item', async () => {
    const { adapter, host } = mounted();
    await adapter.load(preset);
    await adapter.load({ ...preset, ref: 'spotify:album:abc', title: 'Album' });
    expect(host.querySelectorAll('iframe')).toHaveLength(1);
    expect(host.querySelector('iframe')?.src).toBe('https://open.spotify.com/embed/album/abc?theme=0');
  });

  it("leaves playback to Spotify's own controls", async () => {
    const { adapter } = mounted();
    await adapter.load(preset);
    expect(adapter.getState()).toMatchObject({ externalControls: true, canSeek: false, canSetVolume: false, canSkip: false });
    await adapter.play();
    adapter.pause();
    adapter.setVolume(0.2);
    expect(adapter.getState().volume).toBe(1);
  });

  it('takes the title and cover from oEmbed and the artist from the preset', async () => {
    const { adapter } = mounted();
    await adapter.load(preset);
    await vi.waitFor(() => expect(adapter.getState().artUrl).toBe('https://i.scdn.co/image/abc'));
    expect(adapter.getState()).toMatchObject({ title: 'Bollywood Acoustic (oEmbed)', artist: 'Spotify', language: 'HI' });
    expect(meta).toHaveBeenCalledWith('https://open.spotify.com/playlist/37i9');
  });

  it('keeps the preset title when oEmbed fails', async () => {
    meta.mockRejectedValueOnce(new Error('offline'));
    const { adapter } = mounted();
    await adapter.load(preset);
    await new Promise((r) => setTimeout(r, 0));
    expect(adapter.getState().title).toBe('Bollywood Acoustic');
  });

  it('refuses a ref that is not a Spotify URI', async () => {
    const { adapter, host } = mounted();
    await expect(adapter.load({ ...preset, ref: 'javascript:alert(1)' })).rejects.toThrow('That is not a Spotify link.');
    expect(host.querySelector('iframe')).toBeNull();
  });

  it('removes the embed on dispose', async () => {
    const { adapter, host } = mounted();
    await adapter.load(preset);
    adapter.dispose();
    expect(host.querySelector('iframe')).toBeNull();
  });
});

describe('Spotify URLs', () => {
  it('turns a URI into an open.spotify.com link', () => {
    expect(spotifyWebUrl('spotify:playlist:37i9')).toBe('https://open.spotify.com/playlist/37i9');
  });

  it('turns a URI into an embed URL, or null for anything else', () => {
    expect(spotifyEmbedUrl('spotify:track:xyz')).toBe('https://open.spotify.com/embed/track/xyz?theme=0');
    expect(spotifyEmbedUrl('spotify:playlist:../../x')).toBeNull();
    expect(spotifyEmbedUrl('https://evil.example')).toBeNull();
  });
});
