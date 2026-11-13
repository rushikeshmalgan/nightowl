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
}

/** Loads and saves where the reader is in a document. */
export function useReadingProgress(docId: string | null): ReadingProgress {
  const [initial, setInitial] = useState<ProgressRecord | null | undefined>(docId ? undefined : null);
  const pending = useRef<ProgressRecord | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!docId) {
      setInitial(null);
      return;
    }
    let cancelled = false;
    setInitial(undefined);
    void getProgress(db, docId).then((record) => {
      if (!cancelled) setInitial(record);
    });
    return () => {
      cancelled = true;
      // Leaving the document: write whatever position is still waiting.
      flush();
    };
  }, [docId, flush]);

  const save = useCallback(
    (page: number, scrollTop: number) => {
      if (!docId) return;
      pending.current = { docId, page, scrollTop };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [docId, flush],
  );

  return { initial, save };
}
