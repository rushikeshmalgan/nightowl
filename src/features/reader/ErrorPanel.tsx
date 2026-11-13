import { TriangleAlert } from 'lucide-react';

/** A plain, in-place explanation of why something could not be shown. */
export function ErrorPanel({ message, onClear }: { message: string; onClear?: () => void }) {
  return (
    <div className="mx-auto flex max-w-[60ch] flex-col items-start gap-3 rounded border border-line bg-surface p-4">
      <div role="alert" className="flex items-start gap-2 text-sm text-ink">
        <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
        <p>{message}</p>
      </div>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="motion-color rounded border border-line px-3 py-1.5 text-xs text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
        >
          Open the library
        </button>
      ) : null}
    </div>
  );
}
