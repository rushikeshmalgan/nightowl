import type { ReactNode } from 'react';
import { NARROW_QUERY, useMediaQuery } from '../../shared/useMediaQuery';

export interface StatusLineProps {
  title: string;
  /** Short state words shown after the title, e.g. "Bionic", "Reading aloud". */
  flags?: string[];
  /** Right-aligned slots: page position, presence, bookmark button. */
  children?: ReactNode;
}

/** The slim line across the top: what is open and what is switched on. */
export function StatusLine({ title, flags = [], children }: StatusLineProps) {
  // A phone has room for the title or the flags, not both; the rail's pressed buttons already show the flags.
  const narrow = useMediaQuery(NARROW_QUERY);
  return (
    <div
      role="status"
      aria-label="Document status"
      className="absolute left-12 right-0 top-0 flex h-8 items-center gap-2 border-b border-line bg-canvas px-3 text-xs sm:gap-3"
    >
      <span data-testid="status-title" className="min-w-0 truncate text-ink">
        {title}
      </span>
      {narrow
        ? null
        : flags.map((flag) => (
            <span key={flag} className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-accent">
              {flag}
            </span>
          ))}
      <div className="ml-auto flex shrink-0 items-center gap-2 text-muted sm:gap-3">{children}</div>
    </div>
  );
}
