// @vitest-environment node
import 'fake-indexeddb/auto';
import { createDb } from '../../shared/db';
import type { NightOwlDB } from '../../shared/db';
import { addBookmark, deleteBookmark, getProgress, listBookmarks, saveProgress } from './progress';

let counter = 0;
let db: NightOwlDB;

beforeEach(() => {
  counter += 1;
  db = createDb(`progress-test-${counter}`);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

describe('reading progress', () => {
  it('is null for a document that was never opened', async () => {
    expect(await getProgress(db, 'unknown')).toBeNull();
  });

  it('keeps one row per document with the latest position', async () => {
    await saveProgress(db, { docId: 'a', page: 2, scrollTop: 400 });
    await saveProgress(db, { docId: 'a', page: 5, scrollTop: 1900 });
    expect(await db.progress.count()).toBe(1);
    expect(await getProgress(db, 'a')).toEqual({ docId: 'a', page: 5, scrollTop: 1900 });
  });

  it('keeps documents separate', async () => {
    await saveProgress(db, { docId: 'a', page: 2, scrollTop: 400 });
    await saveProgress(db, { docId: 'b', page: 9, scrollTop: 10 });
    expect((await getProgress(db, 'a'))?.page).toBe(2);
    expect((await getProgress(db, 'b'))?.page).toBe(9);
  });
});

describe('bookmarks', () => {
  it('creates a bookmark with an id and a timestamp', async () => {
    const before = Date.now();
    const bookmark = await addBookmark(db, { docId: 'a', page: 3, label: 'Chapter 2' });
    expect(bookmark.id).toEqual(expect.any(String));
    expect(bookmark.id.length).toBeGreaterThan(0);
    expect(bookmark.createdAt).toBeGreaterThanOrEqual(before);
    expect(bookmark).toMatchObject({ docId: 'a', page: 3, label: 'Chapter 2' });
    expect(await db.bookmarks.get(bookmark.id)).toEqual(bookmark);
  });

  it('lists one document’s bookmarks, newest first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1000);
    const first = await addBookmark(db, { docId: 'a', page: 1, label: 'first' });
    vi.setSystemTime(2000);
    await addBookmark(db, { docId: 'b', page: 7, label: 'other doc' });
    vi.setSystemTime(3000);
    const latest = await addBookmark(db, { docId: 'a', page: 4, label: 'latest' });

    const forA = await listBookmarks(db, 'a');
    expect(forA.map((b) => b.id)).toEqual([latest.id, first.id]);
  });

  it('lists every bookmark when no document is given', async () => {
    await addBookmark(db, { docId: 'a', page: 1, label: 'x' });
    await addBookmark(db, { docId: 'b', page: 2, label: 'y' });
    expect(await listBookmarks(db)).toHaveLength(2);
  });

  it('deletes a bookmark', async () => {
    const bookmark = await addBookmark(db, { docId: 'a', page: 1, label: 'x' });
    await deleteBookmark(db, bookmark.id);
    expect(await listBookmarks(db, 'a')).toEqual([]);
  });
});
