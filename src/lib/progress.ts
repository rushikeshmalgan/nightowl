import type { BookmarkRecord, ProgressRecord } from '../types';
import type { NocturneDB } from './db';

/** Remembers where the reader is in a document. One row per document. */
export async function saveProgress(db: NocturneDB, progress: ProgressRecord): Promise<void> {
  await db.progress.put(progress);
}

export async function getProgress(db: NocturneDB, docId: string): Promise<ProgressRecord | null> {
  return (await db.progress.get(docId)) ?? null;
}

export async function addBookmark(
  db: NocturneDB,
  bookmark: { docId: string; page: number; label: string },
): Promise<BookmarkRecord> {
  const record: BookmarkRecord = { id: crypto.randomUUID(), createdAt: Date.now(), ...bookmark };
  await db.bookmarks.add(record);
  return record;
}

/** Bookmarks for one document, or all of them, newest first. */
export async function listBookmarks(db: NocturneDB, docId?: string): Promise<BookmarkRecord[]> {
  const rows = docId ? await db.bookmarks.where('docId').equals(docId).toArray() : await db.bookmarks.toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteBookmark(db: NocturneDB, id: string): Promise<void> {
  await db.bookmarks.delete(id);
}
