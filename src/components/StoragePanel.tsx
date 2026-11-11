import { formatBytes } from '../lib/format';
import type { Usage } from '../lib/library';
import { LIMIT_BYTES } from '../lib/lru';

/** How much the library is using, against the 500 MB document limit. */
export function StoragePanel({ usage, overLimit }: { usage: Usage; overLimit: boolean }) {
  const percent = Math.min(100, (usage.documentBytes / LIMIT_BYTES) * 100);

  return (
    <section role="region" aria-label="Storage" className="flex flex-col gap-2 border-t border-line px-3 py-3 text-xs">
      <div className="flex items-baseline justify-between">
        <span className="text-muted">Documents</span>
        <span className="font-mono tabular-nums text-ink">
          {formatBytes(usage.documentBytes)} <span className="text-muted">/ {formatBytes(LIMIT_BYTES)}</span>
        </span>
      </div>
      <div className="h-px w-full bg-line" aria-hidden="true">
        <div className={`h-px ${overLimit ? 'bg-red-400' : 'bg-accent'}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-muted">Music</span>
        <span className="font-mono tabular-nums text-ink">{formatBytes(usage.trackBytes)}</span>
      </div>
      {usage.usedBytes !== null && usage.quotaBytes !== null ? (
        <div className="flex items-baseline justify-between">
          <span className="text-muted">Browser storage</span>
          <span className="font-mono tabular-nums text-muted">
            {formatBytes(usage.usedBytes)} of {formatBytes(usage.quotaBytes)}
          </span>
        </div>
      ) : null}
      {overLimit ? (
        <p role="status" className="text-red-400">
          Over the 500 MB limit. The newest document was kept; remove something to make room.
        </p>
      ) : null}
    </section>
  );
}
