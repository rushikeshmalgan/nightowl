import type { LanguageTag, TrackRecord } from '../types';
import type { NightOwlDB } from './db';
import { isAudioFile } from './fileTypes';
import { parseStreamUrl } from './music/parseUrl';

export const AUDIO_TYPE_ERROR = 'Only .mp3 and .aac files can be added.';
export const STREAM_URL_ERROR = 'Stream URLs must start with https://';

type Meta = { title?: string; artist?: string; language?: LanguageTag; duration?: number };

/** Saves an uploaded audio file so it plays offline. */
export async function addUploadedTrack(db: NightOwlDB, file: File, meta: Meta = {}): Promise<TrackRecord> {
  if (!isAudioFile(file.name)) throw new Error(AUDIO_TYPE_ERROR);
  if (file.size === 0) throw new Error('File is empty.');
  const record: TrackRecord = {
    id: crypto.randomUUID(),
    title: meta.title?.trim() || file.name.replace(/\.[^.]+$/, ''),
    artist: meta.artist?.trim() ?? '',
    language: meta.language ?? null,
    duration: meta.duration ?? 0,
    blob: file,
    addedAt: Date.now(),
  };
  await db.tracks.add(record);
  return record;
}

/** Saves a link to an internet radio stream or hosted audio file. */
export async function addStreamTrack(
  db: NightOwlDB,
  url: string,
  meta: { title: string; artist?: string; language?: LanguageTag },
): Promise<TrackRecord> {
  const checked = parseStreamUrl(url);
  if (!checked) throw new Error(STREAM_URL_ERROR);
  const record: TrackRecord = {
    id: crypto.randomUUID(),
    title: meta.title.trim() || new URL(checked).hostname,
    artist: meta.artist?.trim() ?? '',
    language: meta.language ?? null,
    duration: 0,
    url: checked,
    addedAt: Date.now(),
  };
  await db.tracks.add(record);
  return record;
}

/** Uploaded and stream tracks, newest first. */
export async function listTracks(db: NightOwlDB): Promise<TrackRecord[]> {
  return db.tracks.orderBy('addedAt').reverse().toArray();
}

export async function deleteTrack(db: NightOwlDB, id: string): Promise<void> {
  await db.tracks.delete(id);
}
