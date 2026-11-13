import { fetchSpotifyMeta } from './spotifyOembed';

const respond = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response);

describe('fetchSpotifyMeta', () => {
  it('asks the oEmbed endpoint with the encoded URL', async () => {
    const fetchFn = respond({ title: 'Peaceful Piano', thumbnail_url: 'https://i.scdn.co/image/x' });
    const meta = await fetchSpotifyMeta('https://open.spotify.com/playlist/37i9?si=a b', fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(
      `https://open.spotify.com/oembed?url=${encodeURIComponent('https://open.spotify.com/playlist/37i9?si=a b')}`,
    );
    expect(meta).toEqual({ title: 'Peaceful Piano', thumbnailUrl: 'https://i.scdn.co/image/x' });
  });

  it('returns a null thumbnail when there is none', async () => {
    expect(await fetchSpotifyMeta('https://open.spotify.com/playlist/1', respond({ title: 'T' }))).toEqual({
      title: 'T',
      thumbnailUrl: null,
    });
  });

  it('fails on a bad response', async () => {
    await expect(fetchSpotifyMeta('https://open.spotify.com/playlist/1', respond({}, false))).rejects.toThrow();
  });
});
