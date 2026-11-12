import { getAudioEngine } from '../audio/instance';
import type { MusicAdapter, SourceId } from './adapter';
import { createNoiseAdapter } from './sources/noise';
import { createSpotifyAdapter } from './sources/spotify';
import type { SpotifyAdapter } from './sources/spotify';
import { createTracksAdapter } from './sources/tracksAdapter';
import { createYouTubeAdapter } from './sources/youtube';
import type { YouTubeAdapter } from './sources/youtube';

export interface DefaultAdapters {
  adapters: Record<SourceId, MusicAdapter>;
  youtube: YouTubeAdapter;
  spotify: SpotifyAdapter;
}

/** The four music sources, sharing the one audio engine. No network is used until one is chosen. */
export function createDefaultAdapters(): DefaultAdapters {
  const engine = getAudioEngine();
  const youtube = createYouTubeAdapter();
  const spotify = createSpotifyAdapter();
  return {
    adapters: { noise: createNoiseAdapter(engine), spotify, youtube, tracks: createTracksAdapter(engine) },
    youtube,
    spotify,
  };
}
