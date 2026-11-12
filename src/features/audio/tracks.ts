export type TrackId = 'lofi' | 'rain' | 'pink';

export interface AudioTrack {
  id: TrackId;
  name: string;
  /** File name under `VITE_AUDIO_CDN_BASE` when streamed audio is configured. */
  file: string;
}

/** The built-in ambient tracks. Each has a synthesized version that needs no network. */
export const AUDIO_TRACKS: AudioTrack[] = [
  { id: 'lofi', name: 'Lo-Fi', file: 'lofi.mp3' },
  { id: 'rain', name: 'Rain', file: 'rain.mp3' },
  { id: 'pink', name: 'Pink Noise', file: 'pink.mp3' },
];

export function isTrackId(value: unknown): value is TrackId {
  return AUDIO_TRACKS.some((track) => track.id === value);
}
