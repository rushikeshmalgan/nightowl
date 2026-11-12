/** Title and cover art for a Spotify link, from Spotify's public oEmbed endpoint (no key needed). */
export async function fetchSpotifyMeta(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ title: string; thumbnailUrl: string | null }> {
  const response = await fetchFn(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error(`Spotify oEmbed returned ${response.status}`);
  const body = (await response.json()) as { title?: string; thumbnail_url?: string };
  return { title: body.title ?? '', thumbnailUrl: body.thumbnail_url ?? null };
}
