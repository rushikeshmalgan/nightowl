import type { PlaylistItem } from './adapter';

export interface Category {
  id: string;
  name: string;
  tags: string[];
  items: PlaylistItem[];
}

/**
 * Preset playlists for the dock. Every Spotify id here was checked against
 * Spotify's oEmbed endpoint; `node scripts/verify-playlists.mjs` re-checks them.
 */
const spotify = (id: string, title: string, artist: string, language: PlaylistItem['language']): PlaylistItem => ({
  id: `spotify-${id}`,
  source: 'spotify',
  ref: `spotify:playlist:${id}`,
  title,
  artist,
  language,
  kind: 'playlist',
});

export const CATEGORIES: Category[] = [
  {
    id: 'english-focus',
    name: 'English Focus',
    tags: ['Lofi', 'Jazz', 'Ambient'],
    items: [
      spotify('37i9dQZF1DWWQRwui0ExPn', 'lofi beats', 'Spotify', 'EN'),
      spotify('37i9dQZF1DX0SM0LYsmbMT', 'Jazz Vibes', 'Spotify', 'EN'),
      spotify('37i9dQZF1DWZeKCadgRdKQ', 'Deep Focus', 'Spotify', 'EN'),
    ],
  },
  {
    id: 'hindi-chill',
    name: 'Hindi / Bollywood Chill',
    tags: ['Acoustic', 'Sufi', 'Night Vibes'],
    items: [
      spotify('37i9dQZF1DWSwxyU5zGZYe', 'Bollywood Acoustic', 'Spotify', 'HI'),
      spotify('37i9dQZF1DXdpQPPZq3F7n', 'Bollywood Mush', 'Spotify', 'HI'),
      spotify('37i9dQZF1DWYRTlrhMB12D', 'Old is Gold', 'Spotify', 'HI'),
    ],
  },
  {
    id: 'instrumental',
    name: 'Instrumental & Classical',
    tags: ['Piano', 'Classical', 'Ambient'],
    items: [
      spotify('37i9dQZF1DX4sWSpwq3LiO', 'Peaceful Piano', 'Spotify', 'INST'),
      spotify('37i9dQZF1DWWEJlAGA9gs0', 'Classical Essentials', 'Spotify', 'INST'),
      spotify('37i9dQZF1DX3Ogo9pFvBkY', 'Ambient Relaxation', 'Spotify', 'INST'),
    ],
  },
  {
    id: 'nature',
    name: 'Nature & White Noise',
    tags: ['Rain', 'Nature', 'Noise'],
    items: [
      { id: 'noise-rain', source: 'noise', ref: 'rain', title: 'Rain', artist: 'NightOwl', language: 'NATURE' },
      { id: 'noise-pink', source: 'noise', ref: 'pink', title: 'Pink Noise', artist: 'NightOwl', language: 'NATURE' },
      { id: 'noise-lofi', source: 'noise', ref: 'lofi', title: 'Lo-Fi', artist: 'NightOwl', language: 'NATURE' },
      spotify('37i9dQZF1DX8ymr6UES7vc', 'Rain Sounds', 'Spotify', 'NATURE'),
      spotify('37i9dQZF1DX4PP3DA4J0N8', 'Nature Sounds', 'Spotify', 'NATURE'),
    ],
  },
];
