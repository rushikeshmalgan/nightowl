import { Moon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatHotkey } from '../lib/commands';

export interface RailItem {
  id: string;
  label: string;
  icon: ReactNode;
  hotkey?: string;
  /** Set for toggles; drives `aria-pressed` and the active style. */
  pressed?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick(): void;
}

/** The 48px tool rail on the left edge. */
export function Rail({ items }: { items: RailItem[] }) {
  return (
    <nav
      aria-label="Tools"
      className="absolute bottom-0 left-0 top-0 flex w-12 flex-col items-center gap-1 border-r border-line bg-canvas py-2"
    >
      <div className="mb-2 flex h-8 w-8 items-center justify-center text-accent" aria-hidden="true">
        <Moon size={16} strokeWidth={1.75} />
      </div>
      {items.map((item) => {
        const hint = item.hotkey ? ` (${formatHotkey(item.hotkey)})` : '';
        const title = item.disabled && item.disabledReason ? item.disabledReason : `${item.label}${hint}`;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={item.pressed}
            disabled={item.disabled}
            title={title}
            onClick={item.onClick}
            className={`motion-color flex h-8 w-8 items-center justify-center rounded outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 ${
              item.pressed ? 'bg-active text-ink' : 'text-muted hover:bg-surface hover:text-ink'
            }`}
          >
            {item.icon}
          </button>
        );
      })}
    </nav>
  );
}
