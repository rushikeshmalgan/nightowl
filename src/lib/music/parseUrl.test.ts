import { parseMusicUrl, parseStreamUrl } from './parseUrl';

describe('parseMusicUrl', () => {
  it.each([
    ['https://www.youtube.com/playlist?list=PL123', { source: 'youtube', kind: 'playlist', id: 'PL123' }],
    ['https://www.youtube.com/watch?v=abc', { source: 'youtube', kind: 'video', id: 'abc' }],
    ['https://www.youtube.com/watch?v=abc&list=PL9', { source: 'youtube', kind: 'playlist', id: 'PL9' }],
    ['https://youtu.be/abc', { source: 'youtube', kind: 'video', id: 'abc' }],
    ['https://m.youtube.com/watch?v=abc', { source: 'youtube', kind: 'video', id: 'abc' }],
    ['https://music.youtube.com/playlist?list=PL123', { source: 'youtube', kind: 'playlist', id: 'PL123' }],
    [
      'https://open.spotify.com/playlist/37i9?si=x',
      { source: 'spotify', kind: 'playlist', id: '37i9', uri: 'spotify:playlist:37i9' },
    ],
    [
      'https://open.spotify.com/intl-hi/playlist/37i9',
      { source: 'spotify', kind: 'playlist', id: '37i9', uri: 'spotify:playlist:37i9' },
    ],
    ['https://open.spotify.com/album/abc', { source: 'spotify', kind: 'album', id: 'abc', uri: 'spotify:album:abc' }],
    ['spotify:playlist:37i9', { source: 'spotify', kind: 'playlist', id: '37i9', uri: 'spotify:playlist:37i9' }],
    ['  https://youtu.be/abc  ', { source: 'youtube', kind: 'video', id: 'abc' }],
  ])('accepts %s', (input, expected) => {
    expect(parseMusicUrl(input)).toEqual(expected);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'https://youtube.com.evil.com/watch?v=abc',
    'https://evilyoutube.com/watch?v=abc',
    'https://open.spotify.com.evil.com/playlist/37i9',
    'http://www.youtube.com/watch?v=abc',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=<script>',
    'https://open.spotify.com/user/someone',
    'spotify:user:someone',
    '',
    'just some words',
  ])('rejects %s', (input) => {
    expect(parseMusicUrl(input)).toBeNull();
  });
});

describe('parseStreamUrl', () => {
  it('accepts https stream URLs', () => {
    expect(parseStreamUrl('https://x/stream')).toBe('https://x/stream');
    expect(parseStreamUrl(' https://radio.example/live.mp3 ')).toBe('https://radio.example/live.mp3');
  });

  it('rejects plain http, other schemes and junk', () => {
    expect(parseStreamUrl('http://x/a.mp3')).toBeNull();
    expect(parseStreamUrl('javascript:1')).toBeNull();
    expect(parseStreamUrl('data:audio/mp3;base64,AAAA')).toBeNull();
    expect(parseStreamUrl('not a url')).toBeNull();
    expect(parseStreamUrl('')).toBeNull();
  });
});
