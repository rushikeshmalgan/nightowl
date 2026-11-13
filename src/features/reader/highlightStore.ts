import type { HighlightRecord } from '../../shared/types';
import type { NightOwlDB } from '../../shared/db';

export async function addHighlight(
  db: NightOwlDB,
  highlight: { docId: string; start: number; end: number; note: string },
): Promise<HighlightRecord> {
  if (highlight.end <= highlight.start) throw new Error('Nothing is selected.');
  const record: HighlightRecord = { id: crypto.randomUUID(), createdAt: Date.now(), ...highlight };
  await db.highlights.add(record);
  return record;
}

/** A document's highlights in reading order. */
export async function listHighlights(db: NightOwlDB, docId: string): Promise<HighlightRecord[]> {
  const rows = await db.highlights.where('docId').equals(docId).toArray();
  return rows.sort((a, b) => a.start - b.start);
}

export async function updateHighlightNote(db: NightOwlDB, id: string, note: string): Promise<void> {
  await db.highlights.update(id, { note });
}

export async function deleteHighlight(db: NightOwlDB, id: string): Promise<void> {
  await db.highlights.delete(id);
}
