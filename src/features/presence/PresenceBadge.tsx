import { NARROW_QUERY, useMediaQuery } from '../../shared/useMediaQuery';
import type { Presence } from './usePresence';

/** The live reader count in the status line, or "Local mode" without a connection. On a phone, only the count. */
export function PresenceBadge({ status, total, byRoom }: Presence) {
  const narrow = useMediaQuery(NARROW_QUERY);
  let text: string;
  if (status === 'online' && total !== null && byRoom) {
    const count = `${total.toLocaleString('en-US')} online`;
    text = narrow ? count : `${count} · PDF ${byRoom.pdf} · PSD ${byRoom.psd} · Text ${byRoom.text}`;
  } else if (status === 'connecting') {
    text = 'Connecting…';
  } else {
    text = 'Local mode';
  }
  return (
    <span data-testid="presence" data-status={status} className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-muted">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status === 'online' ? 'bg-emerald-400' : 'bg-muted'}`} />
      {text}
    </span>
  );
}
