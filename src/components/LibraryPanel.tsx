import { BookOpen, Bookmark, FileText, Layers, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ACCEPT_ATTR } from '../lib/fileTypes';
import { formatBytes } from '../lib/format';
import type { Usage } from '../lib/library';
import type { BookmarkRecord, DocMeta, DocType } from '../types';
import { StoragePanel } from './StoragePanel';

export interface LibraryPanelProps {
  documents: DocMeta[];
  currentId: string | null;
  usage: Usage;
  overLimit: boolean;
  bookmarks: BookmarkRecord[];
  /** A one-line message such as an import error or a missing document. */
  notice: string | null;
  /** Open with the delete confirmation already showing (from the palette). */
  confirmClear?: boolean;
  onOpen(id: string): void;
  onRemove(id: string): void;
  onImport(files: File[]): void;
  onClearAll(): void;
  onJumpToBookmark(bookmark: BookmarkRecord): void;
  onRemoveBookmark(id: string): void;
}

const ICON = { size: 14, strokeWidth: 1.75 } as const;

function TypeIcon({ type }: { type: DocType }) {
  if (type === 'pdf') return <FileText {...ICON} />;
  if (type === 'psd') return <Layers {...ICON} />;
  return <BookOpen {...ICON} />;
}

/** The document list, bookmarks and storage figures. */
export function LibraryPanel({
  documents,
  currentId,
  usage,
  overLimit,
  bookmarks,
  notice,
  confirmClear = false,
  onOpen,
  onRemove,
  onImport,
  onClearAll,
  onJumpToBookmark,
  onRemoveBookmark,
}: LibraryPanelProps) {
  const [confirming, setConfirming] = useState(confirmClear);

  useEffect(() => {
    if (confirmClear) setConfirming(true);
  }, [confirmClear]);

  return (
    <section
      aria-label="Library"
      className="absolute bottom-0 left-12 top-8 flex w-72 flex-col border-r border-line bg-surface"
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted">Library</h2>
        <label className="motion-color flex cursor-pointer items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:text-ink focus-within:ring-1 focus-within:ring-accent">
          <Plus size={12} strokeWidth={1.75} />
          Add
          <input
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            aria-label="Add documents"
            className="sr-only"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) onImport(files);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {notice ? (
        <p role="alert" className="border-b border-line px-3 py-2 text-xs text-red-400">
          {notice}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {documents.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted">No documents yet. Add a file, or drop one anywhere on the page.</p>
        ) : (
          <ul className="p-1">
            {documents.map((doc) => {
              const current = doc.id === currentId;
              return (
                <li key={doc.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Open ${doc.name}`}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => onOpen(doc.id)}
                    className={`motion-color flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                      current ? 'bg-active text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <span className="shrink-0">
                      <TypeIcon type={doc.type} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{doc.name}</span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">{formatBytes(doc.size)}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${doc.name}`}
                    title="Remove from library"
                    onClick={() => onRemove(doc.id)}
                    className="motion-color flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted outline-none hover:text-red-400 focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    <X size={12} strokeWidth={1.75} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {bookmarks.length > 0 ? (
          <div className="border-t border-line p-1">
            <h3 className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted">Bookmarks</h3>
            <ul>
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Go to bookmark ${bookmark.label}, page ${bookmark.page}`}
                    onClick={() => onJumpToBookmark(bookmark)}
                    className="motion-color flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    <Bookmark size={12} strokeWidth={1.75} className="shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 truncate">{bookmark.label}</span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums">p. {bookmark.page}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove bookmark ${bookmark.label}`}
                    onClick={() => onRemoveBookmark(bookmark.id)}
                    className="motion-color flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted outline-none hover:text-red-400 focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    <X size={12} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <StoragePanel usage={usage} overLimit={overLimit} />

      <div className="border-t border-line px-3 py-3">
        {confirming ? (
          <div className="flex flex-col gap-2 text-xs">
            <p className="text-ink">
              Delete every document, bookmark, highlight and uploaded track? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onClearAll();
                }}
                className="motion-color flex-1 rounded border border-red-400/40 px-2 py-1.5 text-red-400 outline-none hover:bg-red-400/10 focus-visible:ring-1 focus-visible:ring-red-400"
              >
                Delete everything
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="motion-color flex-1 rounded border border-line px-2 py-1.5 text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="motion-color flex w-full items-center justify-center gap-2 rounded border border-line px-2 py-1.5 text-xs text-muted outline-none hover:text-red-400 focus-visible:ring-1 focus-visible:ring-accent"
          >
            <Trash2 size={12} strokeWidth={1.75} />
            Clear library
          </button>
        )}
      </div>
    </section>
  );
}
