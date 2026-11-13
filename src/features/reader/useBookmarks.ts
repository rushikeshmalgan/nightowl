import { useCallback, useEffect, useState } from 'react';
import { db } from '../../shared/db';
import { addBookmark, deleteBookmark, listBookmarks } from './progress';
import type { BookmarkRecord } from '../../shared/types';

export interface Bookmarks {
  bookmarks: BookmarkRecord[];
  add(page: number, label: string): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Bookmarks for the open document. */
export function useBookmarks(docId: string | null): Bookmarks {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);

  useEffect(() => {
    if (!docId) {
      setBookmarks([]);
      return;
    }
    let cancelled = false;
    void listBookmarks(db, docId).then((rows) => {
      if (!cancelled) setBookmarks(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const add = useCallback(
    async (page: number, label: string) => {
      if (!docId) return;
      await addBookmark(db, { docId, page, label });
      setBookmarks(await listBookmarks(db, docId));
    },
    [docId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!docId) return;
      await deleteBookmark(db, id);
      setBookmarks(await listBookmarks(db, docId));
    },
    [docId],
  );

  return { bookmarks, add, remove };
}
