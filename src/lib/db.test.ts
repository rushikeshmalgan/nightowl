// @vitest-environment node
import 'fake-indexeddb/auto';
import { createDb, db } from './db';
import { getPref, setPref } from './prefs';

describe('NightOwlDB', () => {
  it('has the seven tables', () => {
    const names = db.tables.map((table) => table.name).sort();
    expect(names).toEqual(['bookmarks', 'documents', 'highlights', 'prefs', 'progress', 'thumbnails', 'tracks']);
  });

  it('round-trips a document blob', async () => {
    const local = createDb('nightowl-test-blob');
    const blob = new Blob(['hello night'], { type: 'text/plain' });
    await local.documents.add({
      id: 'a',
      name: 'a.txt',
      type: 'text',
      size: blob.size,
      blob,
      addedAt: 1,
      lastOpenedAt: 1,
    });
    const stored = await local.documents.get('a');
    expect(stored?.blob.size).toBe(11);
    expect(await stored?.blob.text()).toBe('hello night');
    await local.delete();
  });

  it('keys thumbnails by document and page', async () => {
    const local = createDb('nightowl-test-thumbs');
    await local.thumbnails.put({ docId: 'a', page: 1, blob: new Blob(['x']) });
    await local.thumbnails.put({ docId: 'a', page: 2, blob: new Blob(['yy']) });
    await local.thumbnails.put({ docId: 'a', page: 1, blob: new Blob(['zzz']) });
    expect(await local.thumbnails.count()).toBe(2);
    expect((await local.thumbnails.get(['a', 1]))?.blob.size).toBe(3);
    await local.delete();
  });

  it('can list documents by lastOpenedAt', async () => {
    const local = createDb('nightowl-test-index');
    const base = { type: 'text' as const, size: 1, blob: new Blob(['x']), addedAt: 0 };
    await local.documents.bulkAdd([
      { ...base, id: 'old', name: 'old', lastOpenedAt: 10 },
      { ...base, id: 'new', name: 'new', lastOpenedAt: 30 },
      { ...base, id: 'mid', name: 'mid', lastOpenedAt: 20 },
    ]);
    const ordered = await local.documents.orderBy('lastOpenedAt').primaryKeys();
    expect(ordered).toEqual(['old', 'mid', 'new']);
    await local.delete();
  });
});

describe('prefs', () => {
  it('returns the fallback for a missing key', async () => {
    expect(await getPref('missing', 42)).toBe(42);
  });

  it('stores and reads back a value', async () => {
    await setPref('a', 1);
    expect(await getPref('a', 0)).toBe(1);
  });

  it('overwrites an existing value and keeps structured data', async () => {
    await setPref('list', [{ id: 'x' }]);
    await setPref('list', [{ id: 'x' }, { id: 'y' }]);
    expect(await getPref<Array<{ id: string }>>('list', [])).toEqual([{ id: 'x' }, { id: 'y' }]);
  });
});
