import type { ReactNode } from 'react';

export interface StatusLineProps {
  title: string;
  /** Short state words shown after the title, e.g. "Bionic", "Reading aloud". */
  flags?: string[];
  /** Right-aligned slots: page position, presence, bookmark button. */
  children?: ReactNode;
}

/** The slim line across the top: what is open and what is switched on. */
export function StatusLine({ title, flags = [], children }: StatusLineProps) {
  return (
    <div
      role="status"
      aria-label="Document status"
      className="absolute left-12 right-0 top-0 flex h-8 items-center gap-3 border-b border-line bg-canvas px-3 text-xs"
    >
      <span data-testid="status-title" className="min-w-0 truncate text-ink">
        {title}
      </span>
      {flags.map((flag) => (
        <span key={flag} className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-accent">
          {flag}
        </span>
      ))}
      <div className="ml-auto flex shrink-0 items-center gap-3 text-muted">{children}</div>
    </div>
  );
}
