import { useEffect, useRef, useState } from 'react';
import { NARROW_QUERY, useMediaQuery } from '../../shared/useMediaQuery';
import type { Presence } from './usePresence';

/**
 * How many people are reading right now, or "Local mode" without a connection.
 * When connected it is a button: tapping it lists how many are reading PDFs, PSDs and text
 * (a tooltip alone cannot be reached on touch). On a phone only the count is shown.
 */
export function PresenceBadge({ status, total, byRoom }: Presence) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const className = 'flex items-center gap-1.5 text-xs tabular-nums text-muted';
  const dot = <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status === 'online' ? 'bg-accent' : 'bg-muted'}`} />;

  if (status === 'online' && total !== null && byRoom) {
    const people = total.toLocaleString('en-US');
    const lines = [`${byRoom.pdf} reading PDFs`, `${byRoom.psd} reading PSDs`, `${byRoom.text} reading text`];
    return (
      <span ref={wrapper} className="relative flex">
        <button
          type="button"
          data-testid="presence"
          data-status={status}
          aria-expanded={open}
          aria-label={`${people} reading now`}
          title={lines.join(', ')}
          onClick={() => setOpen((value) => !value)}
          className={`motion-color h-6 rounded px-1 outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent ${className}`}
        >
          {dot}
          {narrow ? people : `${people} reading now`}
        </button>
        {open ? (
          <div
            role="group"
            aria-label="Readers by document type"
            className="absolute right-0 top-full z-50 mt-1 flex w-max flex-col gap-1 rounded border border-line bg-surface px-3 py-2 text-xs text-ink"
          >
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : null}
      </span>
    );
  }

  const text = status === 'connecting' ? 'Connecting…' : 'Local mode';
  const title = status === 'connecting' ? undefined : 'Your documents stay on this device. Live counts need a connection.';
  return (
    <span data-testid="presence" data-status={status} title={title} className={className}>
      {dot}
      {text}
    </span>
  );
}
