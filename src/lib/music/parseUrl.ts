export type ParsedMusicUrl =
  | { source: 'youtube'; kind: 'playlist' | 'video'; id: string }
  | { source: 'spotify'; kind: 'playlist' | 'album' | 'track' | 'episode' | 'show' | 'artist'; id: string; uri: string };

const YOUTUBE_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com']);
const SPOTIFY_KINDS = new Set(['playlist', 'album', 'track', 'episode', 'show', 'artist']);
const ID = /^[A-Za-z0-9_-]+$/;

type SpotifyKind = Extract<ParsedMusicUrl, { source: 'spotify' }>['kind'];

function spotify(kind: string, id: string): ParsedMusicUrl | null {
  if (!SPOTIFY_KINDS.has(kind) || !ID.test(id)) return null;
  return { source: 'spotify', kind: kind as SpotifyKind, id, uri: `spotify:${kind}:${id}` };
}

/**
 * Recognises a pasted Spotify or YouTube link. Hosts are matched exactly, so
 * look-alike domains and non-https schemes are refused.
 */
export function parseMusicUrl(input: string): ParsedMusicUrl | null {
  const text = input.trim();
  if (text.startsWith('spotify:')) {
    const [, kind, id, ...rest] = text.split(':');
    return rest.length === 0 && kind && id ? spotify(kind, id) : null;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  if (url.hostname === 'youtu.be') {
    const id = url.pathname.slice(1);
    return ID.test(id) ? { source: 'youtube', kind: 'video', id } : null;
  }

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const list = url.searchParams.get('list');
    if (list && ID.test(list)) return { source: 'youtube', kind: 'playlist', id: list };
    const video = url.searchParams.get('v');
    if (url.pathname === '/watch' && video && ID.test(video)) return { source: 'youtube', kind: 'video', id: video };
    return null;
  }

  if (url.hostname === 'open.spotify.com') {
    // Paths look like /playlist/ID or /intl-hi/playlist/ID.
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0]?.startsWith('intl-')) parts.shift();
    return parts.length === 2 ? spotify(parts[0], parts[1]) : null;
  }

  return null;
}

/** A custom stream address. Only https, so it can play on an https page. */
export function parseStreamUrl(input: string): string | null {
  const text = input.trim();
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.hostname !== '' ? text : null;
  } catch {
    return null;
  }
}
