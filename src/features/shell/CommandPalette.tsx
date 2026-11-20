import { Command as Cmdk, defaultFilter } from 'cmdk';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatHotkey } from '../../app/commands';
import type { Command, CommandGroup } from '../../app/commands';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
  /** Extra commands derived from what the user has typed, e.g. "Go to page 12". */
  dynamic?: (query: string) => Command[];
  /** Told what is typed (and '' when the palette closes), so a search can run on it. */
  onQueryChange?: (query: string) => void;
  placeholder?: string;
}

const GROUP_ORDER: CommandGroup[] = ['Find', 'Document', 'View', 'Audio', 'Music', 'Storage'];

/** Marks the value of a row that is always shown; the filter below gives it a top score whatever is typed. */
const FIXED = '~fixed~';
const FIXED_SCORE = 2;
const fixedValue = (command: Command) => `${FIXED}${command.id}`;

/** cmdk's own matching for ordinary commands; rows marked `fixed` always stay, ahead of the rest, in the order given. */
const filter = (value: string, search: string, keywords?: string[]) =>
  value.startsWith(FIXED) ? FIXED_SCORE : defaultFilter(value, search, keywords);

export function CommandPalette({ open, onOpenChange, commands, dynamic, onQueryChange, placeholder = 'Type a command or a page number' }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const reportQuery = useRef(onQueryChange);
  reportQuery.current = onQueryChange;

  useEffect(() => {
    if (open) return;
    setQuery('');
    reportQuery.current?.('');
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
      filter={filter}
      overlayClassName="fixed inset-0 z-[70] bg-black/50"
      contentClassName="fixed left-1/2 top-[18%] z-[71] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-md border border-line bg-surface text-ink outline-none"
    >
      <Cmdk.Input
        value={query}
        onValueChange={(value) => {
          setQuery(value);
          onQueryChange?.(value);
        }}
        placeholder={placeholder}
        className="w-full border-b border-line bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted"
      />
      <Cmdk.List className="max-h-[50vh] overflow-y-auto p-1">
        <Cmdk.Empty className="px-3 py-6 text-center text-xs text-muted">No matching command.</Cmdk.Empty>
        {grouped.map(({ group, items }) => (
          <Cmdk.Group
            key={group}
            heading={group}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
          >
            {items.map((command) => (
              <Cmdk.Item
                key={command.id}
                value={command.fixed ? fixedValue(command) : `${command.title} ${(command.keywords ?? []).join(' ')}`}
                disabled={command.disabled}
                onSelect={() => select(command)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 text-sm text-ink data-[disabled=true]:cursor-default data-[disabled=true]:text-muted data-[selected=true]:bg-active"
              >
                <span className="min-w-0">{command.title}</span>
                {command.hint ? (
                  <span className="shrink-0 text-xs text-muted">{command.hint}</span>
                ) : command.hotkey ? (
                  <kbd className="font-mono text-xs text-muted">{formatHotkey(command.hotkey)}</kbd>
                ) : null}
              </Cmdk.Item>
            ))}
          </Cmdk.Group>
        ))}
      </Cmdk.List>
    </Cmdk.Dialog>
  );
}
