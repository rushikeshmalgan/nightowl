import { NARROW_QUERY, useMediaQuery } from '../../shared/useMediaQuery';
import type { Presence } from './usePresence';

/** How many people are reading right now, or "Local mode" without a connection. The breakdown by document type is in the tooltip. */
export function PresenceBadge({ status, total, byRoom }: Presence) {
  const narrow = useMediaQuery(NARROW_QUERY);
  let text: string;
  let title: string | undefined;
  if (status === 'online' && total !== null && byRoom) {
    const people = total.toLocaleString('en-US');
    text = narrow ? people : `${people} reading now`;
    title = `${byRoom.pdf} reading PDFs, ${byRoom.psd} reading PSDs, ${byRoom.text} reading text`;
  } else if (status === 'connecting') {
    text = 'Connecting…';
  } else {
    text = 'Local mode';
    title = 'Your documents stay on this device. Live counts need a connection.';
  }
  return (
    <span
      data-testid="presence"
      data-status={status}
      title={title}
      className="flex items-center gap-1.5 text-xs tabular-nums text-muted"
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status === 'online' ? 'bg-accent' : 'bg-muted'}`} />
      {text}
    </span>
  );
}
