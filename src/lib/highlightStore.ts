import type { HighlightRecord } from '../types';
import type { NocturneDB } from './db';

export async function addHighlight(
  db: NocturneDB,
  highlight: { docId: string; start: number; end: number; note: string },
): Promise<HighlightRecord> {
  if (highlight.end <= highlight.start) throw new Error('Nothing is selected.');
  const record: HighlightRecord = { id: crypto.randomUUID(), createdAt: Date.now(), ...highlight };
  await db.highlights.add(record);
  return record;
}

/** A document's highlights in reading order. */
export async function listHighlights(db: NocturneDB, docId: string): Promise<HighlightRecord[]> {
  const rows = await db.highlights.where('docId').equals(docId).toArray();
  return rows.sort((a, b) => a.start - b.start);
}

export async function updateHighlightNote(db: NocturneDB, id: string, note: string): Promise<void> {
  await db.highlights.update(id, { note });
}

export async function deleteHighlight(db: NocturneDB, id: string): Promise<void> {
  await db.highlights.delete(id);
}
