import type { TrackRecord } from '../../types';
import type { AudioEngine } from '../audio/engine';
import { db } from '../db';
import { listTracks } from '../tracks';
import { createPlaybackStore, EMPTY_PLAYBACK } from './adapter';
import type { MusicAdapter } from './adapter';

export const TRACK_PLAY_ERROR = 'This track could not be played.';
export const NO_TRACKS_ERROR = 'Add a track to My Tracks first.';

interface Deps {
  createAudio?: () => HTMLAudioElement;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
  getTracks?: () => Promise<TrackRecord[]>;
}

/**
 * Plays the reader's own music: uploaded files (offline) and https streams.
 * Audio goes through the engine for volume and the analyser. A stream whose
 * host does not allow CORS is retried as a plain element; it plays, but the
 * analyser cannot see it and volume is set on the element instead.
 */
export function createTracksAdapter(engine: AudioEngine, deps: Deps = {}): MusicAdapter {
  const createAudio = deps.createAudio ?? (() => new Audio());
  const createObjectUrl = deps.createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectUrl = deps.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));
  const getTracks = deps.getTracks ?? (() => listTracks(db));

  const store = createPlaybackStore({ ...EMPTY_PLAYBACK, canSeek: true, canSetVolume: true, canSkip: true, volume: engine.getState().volume });
  let queue: TrackRecord[] = [];
  let index = 0;
  let element: HTMLAudioElement | null = null;
  let attached = false;
  let objectUrl: string | null = null;

  const release = () => {
    if (element) {
      element.pause();
      if (attached) engine.detachElement(element);
    }
    if (objectUrl) revokeObjectUrl(objectUrl);
    element = null;
    objectUrl = null;
    attached = false;
  };

  const start = (track: TrackRecord, withCors: boolean, autoplay: boolean) => {
    release();
    const el = createAudio();
    element = el;
    if (withCors) el.crossOrigin = 'anonymous';
    if (track.blob) {
      objectUrl = createObjectUrl(track.blob);
      el.src = objectUrl;
    } else {
      el.src = track.url ?? '';
    }

    el.addEventListener('play', () => store.set({ isPlaying: true, error: null }));
    el.addEventListener('pause', () => store.set({ isPlaying: false }));
    el.addEventListener('timeupdate', () => store.set({ position: el.currentTime, duration: Number.isFinite(el.duration) ? el.duration : 0 }));
    el.addEventListener('ended', () => advance(1));
    el.addEventListener('error', () => {
      if (el !== element) return;
      // The first failure may be a host refusing CORS; try once without it.
      if (withCors && !track.blob) start(track, false, true);
      else store.set({ error: TRACK_PLAY_ERROR, isPlaying: false });
    });

    if (withCors) {
      engine.attachElement(el);
      attached = true;
    } else {
      el.volume = store.get().volume;
    }
    store.set({
      title: track.title,
      artist: track.artist,
      language: track.language,
      duration: track.duration,
      position: 0,
      error: null,
    });
    if (autoplay) void el.play().catch(() => store.set({ error: TRACK_PLAY_ERROR, isPlaying: false }));
  };

  const advance = (step: number) => {
    if (queue.length === 0) return;
    const wasPlaying = store.get().isPlaying;
    index = (index + step + queue.length) % queue.length;
    start(queue[index], true, wasPlaying || step !== 0);
  };

  return {
    id: 'tracks',
    async load(item) {
      queue = await getTracks();
      if (queue.length === 0) {
        store.set({ error: NO_TRACKS_ERROR, title: '', artist: '' });
        return;
      }
      index = Math.max(0, queue.findIndex((track) => track.id === item.ref));
      start(queue[index], true, false);
    },
    async play() {
      if (!element && queue.length > 0) start(queue[index], true, false);
      await element?.play().catch(() => store.set({ error: TRACK_PLAY_ERROR }));
    },
    pause() {
      element?.pause();
    },
    seek(seconds) {
      if (element) element.currentTime = seconds;
      store.set({ position: seconds });
    },
    setVolume(volume) {
      const clamped = Math.min(1, Math.max(0, volume));
      if (attached) engine.setVolume(clamped);
      else if (element) element.volume = clamped;
      store.set({ volume: clamped });
    },
    next: () => advance(1),
    previous: () => advance(-1),
    getState: () => store.get(),
    subscribe: (listener) => store.subscribe(listener),
    dispose: release,
  };
}
