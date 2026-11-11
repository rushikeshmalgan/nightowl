export type CommandGroup = 'Document' | 'View' | 'Audio' | 'Music' | 'Storage';

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
