import { Pause, Play } from 'lucide-react';
import type { SleepControls, SleepMinutes } from '../hooks/useSleepTimer';
import type { AudioEngineState } from '../lib/audio/engine';
import { AUDIO_TRACKS } from '../lib/audio/tracks';
import type { TrackId } from '../lib/audio/tracks';
import { LedPulse } from './LedPulse';
import { Scrubber } from './Scrubber';
import { Waveform } from './Waveform';

export interface AudioPanelProps {
  state: AudioEngineState;
  analyser: AnalyserNode | null;
  /** Current loudness, 0 to 1. */
  level: number;
  sleep: SleepControls;
  onToggle(): void;
  onTrack(id: TrackId): void;
  onVolume(volume: number): void;
}

const SLEEP_CHOICES: Array<{ minutes: SleepMinutes; label: string }> = [
  { minutes: 0, label: 'Off' },
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '60m' },
];

const SOURCE_LABEL = { stream: 'Streaming', synth: 'Synthesized' } as const;

/** `29:05` from milliseconds. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Controls for the built-in ambient sound. */
export function AudioPanel({ state, analyser, level, sleep, onToggle, onTrack, onVolume }: AudioPanelProps) {
  return (
    <section
      aria-label="Ambient sound"
      className="absolute bottom-0 left-12 top-8 flex w-72 flex-col gap-4 overflow-y-auto border-r border-line bg-surface p-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted">Night noise</h2>
        <span className="flex items-center gap-2 font-mono text-[10px] text-muted">
          {state.source ? <span>{SOURCE_LABEL[state.source]}</span> : null}
          <LedPulse level={level} source={state.source} />
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={state.playing ? 'Pause' : 'Play'}
          onClick={onToggle}
          className="motion-color flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line text-ink outline-none hover:bg-active focus-visible:ring-1 focus-visible:ring-accent"
        >
          {state.playing ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
        </button>
        <div className="min-w-0 flex-1">
          <Waveform analyser={analyser} active={state.playing} />
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-1">
        {AUDIO_TRACKS.map((track) => (
          <button
            key={track.id}
            type="button"
            aria-pressed={state.trackId === track.id}
            onClick={() => onTrack(track.id)}
            className={`motion-color rounded border border-line px-1 py-1.5 text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              state.trackId === track.id ? 'bg-active text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {track.name}
          </button>
        ))}
      </div>

      <Scrubber
        label="Volume"
        value={Math.round(state.volume * 100)}
        min={0}
        max={100}
        step={1}
        format={(v) => `${v}%`}
        onChange={(v) => onVolume(v / 100)}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted">Sleep timer</span>
          {sleep.remainingMs !== null ? (
            <span className="font-mono tabular-nums text-ink">{formatCountdown(sleep.remainingMs)}</span>
          ) : null}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {SLEEP_CHOICES.map((choice) => (
            <button
              key={choice.minutes}
              type="button"
              aria-pressed={sleep.minutes === choice.minutes}
              onClick={() => sleep.set(choice.minutes)}
              className={`motion-color rounded border border-line px-1 py-1.5 font-mono text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                sleep.minutes === choice.minutes ? 'bg-active text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
