import type { UiState } from '../store/ui';
import type { ThemeId } from '../types';

export type CommandGroup = 'Document' | 'View' | 'Audio' | 'Music' | 'Storage';

export interface CommandDeps {
  ui: Pick<UiState, 'set' | 'toggle' | 'reset'>;
  tts: { supported: boolean; toggle(): void };
}

const THEME_COMMANDS: Array<{ id: ThemeId; label: string }> = [
  { id: 'night', label: 'Night' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'oled', label: 'OLED' },
  { id: 'crimson', label: 'Crimson' },
];

/** The static command list for the palette. Later features append their own. */
export function buildCommands({ ui, tts }: CommandDeps): Command[] {
  const commands: Command[] = [
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
    { id: 'dyslexic', title: 'Toggle dyslexia-friendly font', group: 'View', run: () => ui.toggle('dyslexic') },
    { id: 'tuning', title: 'Open tuning panel', group: 'View', hotkey: '\\', keywords: ['settings', 'warmth', 'brightness'], run: () => ui.set('tuningOpen', true) },
    { id: 'reset', title: 'Reset reading settings', group: 'View', run: () => ui.reset() },
  ];
  if (tts.supported) {
    commands.push({ id: 'tts', title: 'Read aloud', group: 'Audio', hotkey: 's', keywords: ['speech', 'voice', 'narrate'], run: () => tts.toggle() });
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
