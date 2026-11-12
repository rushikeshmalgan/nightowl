// @vitest-environment node
import 'fake-indexeddb/auto';
import { createDb } from '../../shared/db';
import type { NightOwlDB } from '../../shared/db';
import { addHighlight, deleteHighlight, listHighlights, updateHighlightNote } from './highlightStore';

let counter = 0;
let db: NightOwlDB;

beforeEach(() => {
  counter += 1;
  db = createDb(`highlight-test-${counter}`);
});

afterEach(async () => {
  await db.delete();
});

describe('highlight store', () => {
  it('adds a highlight with an id and timestamp', async () => {
    const before = Date.now();
    const record = await addHighlight(db, { docId: 'a', start: 4, end: 9, note: '' });
    expect(record.id.length).toBeGreaterThan(0);
    expect(record.createdAt).toBeGreaterThanOrEqual(before);
    expect(await db.highlights.get(record.id)).toEqual(record);
  });

  it('lists one document’s highlights in reading order', async () => {
    await addHighlight(db, { docId: 'a', start: 50, end: 60, note: '' });
    await addHighlight(db, { docId: 'b', start: 1, end: 2, note: '' });
    await addHighlight(db, { docId: 'a', start: 5, end: 9, note: 'first' });
    const rows = await listHighlights(db, 'a');
    expect(rows.map((row) => row.start)).toEqual([5, 50]);
  });

  it('rejects an empty or inverted range', async () => {
    await expect(addHighlight(db, { docId: 'a', start: 5, end: 5, note: '' })).rejects.toThrow('Nothing is selected.');
    await expect(addHighlight(db, { docId: 'a', start: 9, end: 2, note: '' })).rejects.toThrow('Nothing is selected.');
    expect(await db.highlights.count()).toBe(0);
  });

  it('updates a note', async () => {
    const record = await addHighlight(db, { docId: 'a', start: 1, end: 4, note: '' });
    await updateHighlightNote(db, record.id, 'remember this');
    expect((await db.highlights.get(record.id))?.note).toBe('remember this');
  });

  it('deletes a highlight', async () => {
    const record = await addHighlight(db, { docId: 'a', start: 1, end: 4, note: '' });
    await deleteHighlight(db, record.id);
    expect(await listHighlights(db, 'a')).toEqual([]);
  });
});
