import { ListMusic, Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useState } from 'react';
import type { MusicSource } from './useMusicSource';
import type { SleepMinutes } from '../audio/useSleepTimer';
import type { PlaylistItem, SourceId } from './adapter';
import { parseMusicUrl } from './parseUrl';
import type { Category } from './playlists';
import type { TrackRecord } from '../../shared/types';
import { formatCountdown } from '../audio/AudioPanel';
import { Scrubber } from '../../shared/Scrubber';
import { NARROW_QUERY, useMediaQuery } from '../../shared/useMediaQuery';
import { TrackUpload } from './TrackUpload';

export interface MusicDockProps {
  music: MusicSource;
  categories: Category[];
  tracks: TrackRecord[];
  customPlaylists: PlaylistItem[];
  online: boolean;
  onAddCustom(item: PlaylistItem): void;
  onTracksChanged(): void;
}

const SOURCES: Array<{ id: SourceId; label: string; online: boolean }> = [
  { id: 'noise', label: 'Night Noise', online: false },
  { id: 'spotify', label: 'Spotify', online: true },
  { id: 'youtube', label: 'YouTube', online: true },
  { id: 'tracks', label: 'My Tracks', online: false },
];

const BAD_LINK = 'That link is not a Spotify or YouTube link.';
const MY_TRACKS = 'my-tracks';

/** 44px touch targets on a phone, 32px from `sm` up. */
const button =
  'motion-color flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink outline-none hover:bg-active focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-30 sm:h-8 sm:w-8';

function mmss(seconds: number): string {
  return formatCountdown(seconds * 1000);
}

function SleepSelect({ music, className }: { music: MusicSource; className: string }) {
  return (
    <select
      aria-label="Sleep timer"
      value={music.sleepMinutes}
      onChange={(event) => music.setSleepTimer(Number(event.target.value) as SleepMinutes)}
      className={`rounded border border-line bg-canvas font-mono text-ink outline-none ${className}`}
    >
      <option value={0}>Sleep off</option>
      <option value={15}>15m</option>
      <option value={30}>30m</option>
      <option value={60}>60m</option>
    </select>
  );
}

/** Turns a recognised link into a playable item. */
function linkToItem(link: string): PlaylistItem | null {
  const parsed = parseMusicUrl(link);
  if (!parsed) return null;
  if (parsed.source === 'youtube') {
    return { id: `custom-youtube-${parsed.id}`, source: 'youtube', ref: parsed.id, title: 'YouTube link', artist: 'YouTube', language: null, kind: parsed.kind };
  }
  return { id: `custom-spotify-${parsed.id}`, source: 'spotify', ref: parsed.uri, title: 'Spotify link', artist: 'Spotify', language: null, kind: parsed.kind };
}

/** The music bar along the bottom of the reader, with a browse panel above it. */
export function MusicDock({ music, categories, tracks, customPlaylists, online, onAddCustom, onTracksChanged }: MusicDockProps) {
  const { state } = music;
  // A phone has 312px beside the rail: no cover, a flexible title, and the sleep timer moves into Browse.
  const narrow = useMediaQuery(NARROW_QUERY);
  const [browsing, setBrowsing] = useState(false);
  const [tab, setTab] = useState(categories[0]?.id ?? MY_TRACKS);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const choose = (item: PlaylistItem) => void music.select(item.source, item);
  const error = state.error ?? music.loadError;

  const itemButton = (item: PlaylistItem, disabled = false) => (
    <li key={item.id}>
      <button
        type="button"
        disabled={disabled}
        title={disabled ? 'Needs a connection' : undefined}
        onClick={() => choose(item)}
        className="motion-color flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40"
      >
        <span className="min-w-0 flex-1 truncate text-ink">{item.title}</span>
        <span className="shrink-0 truncate text-[10px]">{item.artist}</span>
        {item.language ? <span className="shrink-0 font-mono text-[10px] text-accent">{item.language}</span> : null}
      </button>
    </li>
  );

  const current = categories.find((category) => category.id === tab);

  return (
    <>
      {browsing ? (
        <section aria-label="Browse music" className="absolute bottom-14 right-0 w-80 max-w-[calc(100%-3rem)] border-l border-t border-line bg-surface">
          <div role="tablist" aria-label="Categories" className="flex flex-wrap gap-1 border-b border-line p-2">
            {[...categories.map((c) => ({ id: c.id, name: c.name })), { id: MY_TRACKS, name: 'My Tracks' }].map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={`motion-color rounded border border-line px-2 py-1 text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-accent ${tab === entry.id ? 'bg-active text-ink' : 'text-muted hover:text-ink'}`}
              >
                {entry.name}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="max-h-72 overflow-y-auto p-1">
            {tab === MY_TRACKS ? (
              <div className="flex flex-col gap-2 p-1">
                <ul>
                  {tracks.map((track) =>
                    itemButton({ id: `track-${track.id}`, source: 'tracks', ref: track.id, title: track.title, artist: track.artist || (track.url ? 'Stream' : 'Upload'), language: track.language }),
                  )}
                </ul>
                <TrackUpload onAdded={onTracksChanged} />
              </div>
            ) : (
              <>
                {current ? <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted">{current.tags.join(' · ')}</p> : null}
                <ul>{current?.items.map((item) => itemButton(item, !online && item.source !== 'noise'))}</ul>
                {customPlaylists.length > 0 ? (
                  <>
                    <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted">Your links</p>
                    <ul>{customPlaylists.map((item) => itemButton(item, !online))}</ul>
                  </>
                ) : null}
              </>
            )}
          </div>

          {narrow ? (
            <label className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-[11px] text-muted">
              Sleep timer
              <SleepSelect music={music} className="h-10 px-2 text-xs" />
            </label>
          ) : null}

          <form
            className="flex gap-1 border-t border-line p-2"
            onSubmit={(event) => {
              event.preventDefault();
              const item = linkToItem(link);
              if (!item) {
                setLinkError(BAD_LINK);
                return;
              }
              setLinkError(null);
              setLink('');
              onAddCustom(item);
              choose(item);
            }}
          >
            <input
              aria-label="Paste a Spotify or YouTube link"
              placeholder="Paste a Spotify or YouTube link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              className="min-w-0 flex-1 rounded border border-line bg-transparent px-2 py-1 text-[11px] text-ink outline-none placeholder:text-muted focus:border-accent"
            />
            <button type="submit" className="rounded border border-line px-2 text-[11px] text-muted hover:text-ink">
              Add link
            </button>
          </form>
          {linkError ? (
            <p role="alert" className="px-2 pb-2 text-[11px] text-red-400">
              {linkError}
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Music" className="absolute bottom-0 left-12 right-0 flex h-14 items-center gap-2 border-t border-line bg-canvas px-2 sm:gap-3 sm:px-3">
        {narrow ? null : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-surface">
            {state.artUrl ? <img src={state.artUrl} alt={`Cover of ${state.title}`} className="h-full w-full object-cover" /> : <Music2 size={14} strokeWidth={1.75} className="text-muted" />}
          </div>
        )}
        <div className={narrow ? 'flex min-w-0 flex-1 flex-col' : 'flex w-40 min-w-0 shrink-0 flex-col'}>
          <span className="truncate text-xs text-ink">{state.title || 'Nothing playing'}</span>
          <span className="flex items-center gap-1 truncate text-[10px] text-muted">
            <span className="truncate">{state.artist}</span>
            {state.language ? <span className="font-mono text-accent">{state.language}</span> : null}
          </span>
        </div>
        {narrow && music.sleepRemainingMs !== null ? (
          <span title="Sleep timer" className="shrink-0 font-mono text-[10px] tabular-nums text-muted">
            {formatCountdown(music.sleepRemainingMs)}
          </span>
        ) : null}

        <div className="flex shrink-0 items-center">
          <button type="button" aria-label="Previous" disabled={!state.canSkip} onClick={music.previous} className={button}>
            <SkipBack size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
            disabled={state.externalControls}
            title={state.externalControls ? "Use the Spotify player's own controls." : undefined}
            onClick={() => void music.toggle()}
            className={button}
          >
            {state.isPlaying ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
          </button>
          <button type="button" aria-label="Next" disabled={!state.canSkip} onClick={music.next} className={button}>
            <SkipForward size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="hidden min-w-0 flex-1 md:block">
          <Scrubber
            label="Position"
            value={Math.round(state.position)}
            min={0}
            max={Math.max(1, Math.round(state.duration))}
            step={1}
            format={(v) => (state.duration > 0 ? `${mmss(v)} / ${mmss(state.duration)}` : '--:--')}
            onChange={music.seek}
            disabled={!state.canSeek || state.duration <= 0}
          />
        </div>

        <div className="hidden w-28 shrink-0 lg:block">
          <Scrubber
            label="Music volume"
            value={Math.round(state.volume * 100)}
            min={0}
            max={100}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => music.setVolume(v / 100)}
            disabled={!state.canSetVolume}
            title={state.canSetVolume ? undefined : 'Spotify controls its own volume.'}
          />
        </div>

        {narrow ? null : (
          <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
            <span className="sr-only">Sleep timer</span>
            <SleepSelect music={music} className="px-1 py-1 text-[10px]" />
            {music.sleepRemainingMs !== null ? <span className="font-mono tabular-nums">{formatCountdown(music.sleepRemainingMs)}</span> : null}
          </label>
        )}

        <div role="group" aria-label="Source" className="hidden shrink-0 items-center gap-1 lg:flex">
          {SOURCES.map((source) => {
            const disabled = source.online && !online;
            return (
              <button
                key={source.id}
                type="button"
                aria-pressed={music.activeSource === source.id}
                disabled={disabled}
                title={disabled ? 'Needs a connection' : undefined}
                onClick={() => void music.select(source.id)}
                className={`motion-color rounded border border-line px-2 py-1 text-[10px] outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40 ${
                  music.activeSource === source.id ? 'bg-active text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {source.label}
              </button>
            );
          })}
        </div>

        <button type="button" aria-label="Browse music" aria-pressed={browsing} onClick={() => setBrowsing((open) => !open)} className={button}>
          <ListMusic size={16} strokeWidth={1.75} />
        </button>

        {error ? (
          <p role="alert" className="max-w-48 shrink truncate text-[10px] text-red-400" title={error}>
            {error}
          </p>
        ) : null}
      </section>
    </>
  );
}
