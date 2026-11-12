import type { UiState } from '../store/ui';
import type { ThemeId } from '../types';
import { AUDIO_TRACKS } from './audio/tracks';
import type { TrackId } from './audio/tracks';

export type CommandGroup = 'Document' | 'View' | 'Audio' | 'Music' | 'Storage';

export interface CommandDeps {
  ui: Pick<UiState, 'set' | 'toggle' | 'reset'>;
  tts: { supported: boolean; toggle(): void };
  /** Documents in the library; each becomes an "Open ..." command. */
  documents?: Array<{ id: string; name: string }>;
  openDocument?(id: string): void;
  /** Starts the confirmed "delete everything" flow. */
  requestClear?(): void;
  /** The built-in ambient sound. */
  audio?: { toggle(): void; setTrack(id: TrackId): void };
  sleep?: { set(minutes: 0 | 15 | 30 | 60): void };
  /** The music dock. */
  music?: { select(source: 'noise' | 'spotify' | 'youtube' | 'tracks'): void; toggle(): void };
}

const THEME_COMMANDS: Array<{ id: ThemeId; label: string }> = [
  { id: 'night', label: 'Night' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'oled', label: 'OLED' },
  { id: 'crimson', label: 'Crimson' },
];

/** The static command list for the palette. Later features append their own. */
export function buildCommands({ ui, tts, documents = [], openDocument, requestClear, audio, sleep, music }: CommandDeps): Command[] {
  const commands: Command[] = [
    ...(openDocument
      ? documents.map<Command>((doc) => ({
          id: `open-${doc.id}`,
          title: `Open ${doc.name}`,
          group: 'Document',
          run: () => openDocument(doc.id),
        }))
      : []),
    { id: 'library', title: 'Open library', group: 'Document', keywords: ['files', 'documents'], run: () => ui.set('libraryOpen', true) },
    ...THEME_COMMANDS.map<Command>((theme) => ({
      id: `theme-${theme.id}`,
      title: `Theme: ${theme.label}`,
      group: 'View',
      keywords: ['colour', 'color', 'palette'],
      run: () => ui.set('theme', theme.id),
    })),
    { id: 'bionic', title: 'Toggle bionic reading', group: 'View', hotkey: 'mod+b', run: () => ui.toggle('bionic') },
    { id: 'ruler', title: 'Toggle focus ruler', group: 'View', hotkey: 'f', run: () => ui.toggle('focusRuler') },
    { id: 'autoscroll', title: 'Toggle auto-scroll', group: 'View', run: () => ui.toggle('autoScroll') },
    { id: 'night-pages', title: 'Toggle night pages', group: 'View', keywords: ['pdf', 'invert', 'dark'], run: () => ui.toggle('nightPages') },
    { id: 'dyslexic', title: 'Toggle dyslexia-friendly font', group: 'View', run: () => ui.toggle('dyslexic') },
    { id: 'tuning', title: 'Open tuning panel', group: 'View', hotkey: '\\', keywords: ['settings', 'warmth', 'brightness'], run: () => ui.set('tuningOpen', true) },
    { id: 'reset', title: 'Reset reading settings', group: 'View', run: () => ui.reset() },
  ];
  if (tts.supported) {
    commands.push({ id: 'tts', title: 'Read aloud', group: 'Audio', hotkey: 's', keywords: ['speech', 'voice', 'narrate'], run: () => tts.toggle() });
  }
  if (audio) {
    commands.push(
      { id: 'audio-toggle', title: 'Play or pause ambient sound', group: 'Audio', hotkey: 'a', keywords: ['noise', 'music'], run: () => audio.toggle() },
      { id: 'audio-panel', title: 'Open ambient sound panel', group: 'Audio', run: () => ui.set('audioOpen', true) },
      ...AUDIO_TRACKS.map<Command>((track) => ({
        id: `audio-${track.id}`,
        title: `Ambient sound: ${track.name}`,
        group: 'Audio',
        run: () => audio.setTrack(track.id),
      })),
    );
  }
  if (sleep) {
    commands.push(
      ...([15, 30, 60] as const).map<Command>((minutes) => ({
        id: `sleep-${minutes}`,
        title: `Sleep timer: ${minutes} minutes`,
        group: 'Audio',
        run: () => sleep.set(minutes),
      })),
      { id: 'sleep-off', title: 'Sleep timer: off', group: 'Audio', run: () => sleep.set(0) },
    );
  }
  if (music) {
    commands.push(
      { id: 'music-toggle', title: 'Play or pause music', group: 'Music', hotkey: 'mod+m', run: () => music.toggle() },
      ...([
        ['noise', 'Night Noise'],
        ['spotify', 'Spotify'],
        ['youtube', 'YouTube'],
        ['tracks', 'My Tracks'],
      ] as const).map<Command>(([id, label]) => ({ id: `music-${id}`, title: `Switch to ${label}`, group: 'Music', run: () => music.select(id) })),
    );
  }
  if (requestClear) {
    commands.push({ id: 'clear', title: 'Clear cache', group: 'Storage', keywords: ['delete', 'library', 'storage', 'remove'], run: () => requestClear() });
  }
  return commands;
}

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  hotkey?: string;
  keywords?: string[];
  run(): void;
}

/**
 * Commands that depend on what the reader typed: a whole number within the
 * open document becomes "Go to page N".
 */
export function pageCommands(query: string, numPages: number | null, goTo: (page: number) => void): Command[] {
  if (numPages === null || !/^\d+$/.test(query)) return [];
  const page = Number(query);
  if (page < 1 || page > numPages) return [];
  return [{ id: `page-${page}`, title: `Go to page ${page}`, group: 'Document', run: () => goTo(page) }];
}

/** Turns `mod+k` into a label such as `Ctrl K` for display next to a command. */
export function formatHotkey(hotkey: string, isMac = false): string {
  return hotkey
    .split('+')
    .map((part) => {
      if (part === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (part.startsWith('Arrow')) return { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[part] ?? part;
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(' ');
}
