import { Command as Cmdk } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import { formatHotkey } from '../lib/commands';
import type { Command, CommandGroup } from '../lib/commands';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
  /** Extra commands derived from what the user has typed, e.g. "Go to page 12". */
  dynamic?: (query: string) => Command[];
}

const GROUP_ORDER: CommandGroup[] = ['Document', 'View', 'Audio', 'Music', 'Storage'];

export function CommandPalette({ open, onOpenChange, commands, dynamic }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const all = useMemo(
    () => (dynamic ? [...commands, ...dynamic(query.trim())] : commands),
    [commands, dynamic, query],
  );

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({ group, items: all.filter((command) => command.group === group) })).filter(
        (entry) => entry.items.length > 0,
      ),
    [all],
  );

  const select = (command: Command) => {
    onOpenChange(false);
    command.run();
  };

  return (
    <Cmdk.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-[70] bg-black/50"
      contentClassName="fixed left-1/2 top-[18%] z-[71] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-md border border-line bg-surface text-ink outline-none"
    >
      <Cmdk.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Type a command or a page number"
        className="w-full border-b border-line bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted"
      />
      <Cmdk.List className="max-h-[50vh] overflow-y-auto p-1">
        <Cmdk.Empty className="px-3 py-6 text-center text-xs text-muted">No matching command.</Cmdk.Empty>
        {grouped.map(({ group, items }) => (
          <Cmdk.Group
            key={group}
            heading={group}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
          >
            {items.map((command) => (
              <Cmdk.Item
                key={command.id}
                value={`${command.title} ${(command.keywords ?? []).join(' ')}`}
                onSelect={() => select(command)}
                className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-ink data-[selected=true]:bg-active"
              >
                <span>{command.title}</span>
                {command.hotkey ? (
                  <kbd className="font-mono text-[10px] text-muted">{formatHotkey(command.hotkey)}</kbd>
                ) : null}
              </Cmdk.Item>
            ))}
          </Cmdk.Group>
        ))}
      </Cmdk.List>
    </Cmdk.Dialog>
  );
}
