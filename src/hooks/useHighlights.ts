import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/db';
import { addHighlight, deleteHighlight, listHighlights, updateHighlightNote } from '../lib/highlightStore';
import type { TextRange } from '../lib/highlights';
import type { HighlightRecord } from '../types';

export interface Highlights {
  highlights: HighlightRecord[];
  add(range: TextRange): Promise<void>;
  setNote(id: string, note: string): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Highlights for the open document, in reading order. */
export function useHighlights(docId: string | null): Highlights {
  const [highlights, setHighlights] = useState<HighlightRecord[]>([]);

  useEffect(() => {
    if (!docId) {
      setHighlights([]);
      return;
    }
    let cancelled = false;
    void listHighlights(db, docId).then((rows) => {
      if (!cancelled) setHighlights(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const add = useCallback(
    async (range: TextRange) => {
      if (!docId) return;
      await addHighlight(db, { docId, start: range.start, end: range.end, note: '' });
      setHighlights(await listHighlights(db, docId));
    },
    [docId],
  );

  const setNote = useCallback(
    async (id: string, note: string) => {
      if (!docId) return;
      await updateHighlightNote(db, id, note);
      setHighlights(await listHighlights(db, docId));
    },
    [docId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!docId) return;
      await deleteHighlight(db, id);
      setHighlights(await listHighlights(db, docId));
    },
    [docId],
  );

  return { highlights, add, setNote, remove };
}
