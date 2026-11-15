import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../../shared/db';
import { getProgress, saveProgress } from './progress';
import type { ProgressRecord } from '../../shared/types';

const SAVE_DELAY_MS = 500;

export interface ReadingProgress {
  /** `undefined` while loading, `null` when nothing was saved. */
  initial: ProgressRecord | null | undefined;
  /** Records the position; writes are coalesced so scrolling stays cheap. */
  save(page: number, scrollTop: number): void;
  /** Records the PDF view mode, the reflow position or the page, keeping the rest of the record. */
  update(patch: PdfProgressPatch): void;
}

export type PdfProgressPatch = Partial<Pick<ProgressRecord, 'page' | 'pdfMode' | 'reflowScrollTop'>>;

/** Loads and saves where the reader is in a document. */
export function useReadingProgress(docId: string | null): ReadingProgress {
  // Tagged with its document, so a record is never shown for a different document than it belongs to.
  const [loaded, setLoaded] = useState<{ docId: string; record: ProgressRecord | null } | null>(null);
  const initial: ProgressRecord | null | undefined = docId ? (loaded?.docId === docId ? loaded.record : undefined) : null;
  const pending = useRef<ProgressRecord | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The latest known record, so a partial update never drops the rest of it. */
  const latest = useRef<ProgressRecord | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const record = pending.current;
      pending.current = null;
      void saveProgress(db, record);
    }
  }, []);

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    latest.current = null;
    void getProgress(db, docId).then((record) => {
      if (cancelled) return;
      latest.current = record;
      setLoaded({ docId, record });
    });
    return () => {
      cancelled = true;
      // Leaving the document: write whatever position is still waiting.
      flush();
    };
  }, [docId, flush]);

  const write = useCallback(
    (record: ProgressRecord) => {
      latest.current = record;
      pending.current = record;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  const save = useCallback(
    (page: number, scrollTop: number) => {
      if (!docId) return;
      write({ ...latest.current, docId, page, scrollTop });
    },
    [docId, write],
  );

  const update = useCallback(
    (patch: PdfProgressPatch) => {
      if (!docId) return;
      write({ page: 1, scrollTop: 0, ...latest.current, ...patch, docId });
    },
    [docId, write],
  );

  return { initial, save, update };
}
