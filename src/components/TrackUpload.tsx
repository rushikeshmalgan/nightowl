import { Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/db';
import { AUDIO_ACCEPT_ATTR } from '../lib/fileTypes';
import { parseStreamUrl } from '../lib/music/parseUrl';
import { addStreamTrack, addUploadedTrack, STREAM_URL_ERROR } from '../lib/tracks';
import type { TrackRecord } from '../types';

/** Reads a file's length in seconds from the browser's own audio decoder. */
function audioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (seconds: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(seconds) ? Math.round(seconds) : 0);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

export interface TrackUploadProps {
  onAdded(track: TrackRecord): void;
  /** Swappable for tests, where jsdom cannot decode audio. */
  readDuration?: (file: File) => Promise<number>;
}

/** Adds music to My Tracks: uploaded files or https stream links. */
export function TrackUpload({ onAdded, readDuration = audioDuration }: TrackUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  const upload = async (files: File[]) => {
    setError(null);
    for (const file of files) {
      try {
        const duration = await readDuration(file);
        onAdded(await addUploadedTrack(db, file, { duration }));
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : 'This file could not be added.');
      }
    }
  };

  const addStream = async () => {
    setError(null);
    if (!parseStreamUrl(url)) {
      setError(STREAM_URL_ERROR);
      return;
    }
    try {
      onAdded(await addStreamTrack(db, url, { title: name }));
      setUrl('');
      setName('');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'This stream could not be added.');
    }
  };

  const field =
    'w-full rounded border border-line bg-transparent px-2 py-1 text-[11px] text-ink outline-none placeholder:text-muted focus:border-accent';

  return (
    <div className="flex flex-col gap-2">
      <label className="motion-color flex cursor-pointer items-center justify-center gap-2 rounded border border-line px-2 py-1.5 text-xs text-muted hover:text-ink focus-within:ring-1 focus-within:ring-accent">
        <Upload size={12} strokeWidth={1.75} />
        Upload .mp3 or .aac
        <input
          type="file"
          multiple
          accept={AUDIO_ACCEPT_ATTR}
          aria-label="Upload tracks"
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length > 0) void upload(files);
          }}
        />
      </label>

      <form
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          void addStream();
        }}
      >
        <input aria-label="Stream URL" placeholder="https://… stream link" value={url} onChange={(e) => setUrl(e.target.value)} className={field} />
        <div className="flex gap-1">
          <input aria-label="Stream name" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className={field} />
          <button
            type="submit"
            aria-label="Add stream"
            className="motion-color flex shrink-0 items-center justify-center rounded border border-line px-2 text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
          >
            <Plus size={12} strokeWidth={1.75} />
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="text-[11px] text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
