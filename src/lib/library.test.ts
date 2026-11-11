// @vitest-environment node
import 'fake-indexeddb/auto';
import { SEED_DOCS } from '../data/seeds';
import { createDb } from './db';
import type { NocturneDB } from './db';
import {
  clearAll,
  deleteDocument,
  getUsage,
  importDocument,
  listDocuments,
  openDocument,
  requestPersistence,
  seedIfEmpty,
} from './library';

let counter = 0;
let db: NocturneDB;

function file(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name);
}

/** Imports a file and pins its lastOpenedAt so eviction order is deterministic. */
async function seedDoc(name: string, bytes: number, lastOpenedAt: number): Promise<string> {
  const result = await importDocument(db, file(name, bytes), { limitBytes: Number.MAX_SAFE_INTEGER });
  if (!result.ok) throw new Error(result.error);
  await db.documents.update(result.doc.id, { lastOpenedAt });
  return result.doc.id;
}

beforeEach(() => {
  counter += 1;
  db = createDb(`library-test-${counter}`);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

describe('importDocument', () => {
  it('rejects unsupported file types', async () => {
    const result = await importDocument(db, file('x.docx', 10));
    expect(result).toEqual({ ok: false, error: 'Unsupported file type. Use .pdf, .psd, .txt, .md, .json or .csv.' });
    expect(await db.documents.count()).toBe(0);
  });

  it('rejects an empty file', async () => {
    const result = await importDocument(db, file('empty.txt', 0));
    expect(result).toEqual({ ok: false, error: 'File is empty.' });
    expect(await db.documents.count()).toBe(0);
  });

  it('stores a valid file and returns its metadata', async () => {
    const result = await importDocument(db, file('Notes.TXT', 120));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc).toMatchObject({ name: 'Notes.TXT', type: 'text', size: 120 });
    expect(result.doc).not.toHaveProperty('blob');
    expect(result.overLimit).toBe(false);
    const stored = await db.documents.get(result.doc.id);
    expect(stored?.blob.size).toBe(120);
  });

  it('stores the page-1 thumbnail when one is provided', async () => {
    const result = await importDocument(db, file('a.pdf', 50), { thumbnail: new Blob(['thumb']) });
    if (!result.ok) throw new Error(result.error);
    const thumb = await db.thumbnails.get([result.doc.id, 1]);
    expect(thumb?.blob.size).toBe(5);
  });

  it('evicts the least recently opened document when over the limit, never the new one', async () => {
    const oldest = await seedDoc('oldest.txt', 200, 10);
    const middle = await seedDoc('middle.txt', 200, 20);
    const newest = await seedDoc('newest.txt', 200, 30);
    const result = await importDocument(db, file('incoming.txt', 200), { limitBytes: 700 });
    if (!result.ok) throw new Error(result.error);
    const ids = (await db.documents.toCollection().primaryKeys()).sort();
    expect(ids).toEqual([middle, newest, result.doc.id].sort());
    expect(ids).not.toContain(oldest);
    expect(result.overLimit).toBe(false);
  });

  it('keeps a single oversized import and reports it as over the limit', async () => {
    const result = await importDocument(db, file('huge.psd', 600), { limitBytes: 500 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.overLimit).toBe(true);
    expect(await db.documents.count()).toBe(1);
  });

  it('evicts and retries once when storage is full', async () => {
    const oldest = await seedDoc('oldest.txt', 200, 10);
    const newer = await seedDoc('newer.txt', 200, 20);
    const add = vi.spyOn(db.documents, 'add');
    add.mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    const result = await importDocument(db, file('incoming.txt', 200));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = await db.documents.toCollection().primaryKeys();
    expect(ids).toContain(newer);
    expect(ids).toContain(result.doc.id);
    expect(ids).not.toContain(oldest);
  });

  it('gives a clear error when storage is still full after the retry', async () => {
    await seedDoc('a.txt', 200, 10);
    const add = vi.spyOn(db.documents, 'add');
    add.mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    const result = await importDocument(db, file('incoming.txt', 200));
    expect(result).toEqual({ ok: false, error: 'Storage is full. Clear some documents and try again.' });
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('rethrows errors that are not about storage', async () => {
    vi.spyOn(db.documents, 'add').mockRejectedValue(new Error('boom'));
    await expect(importDocument(db, file('a.txt', 10))).rejects.toThrow('boom');
  });
});

describe('listDocuments', () => {
  it('lists metadata, most recently opened first', async () => {
    await seedDoc('old.txt', 10, 10);
    await seedDoc('new.txt', 10, 30);
    await seedDoc('mid.txt', 10, 20);
    const docs = await listDocuments(db);
    expect(docs.map((doc) => doc.name)).toEqual(['new.txt', 'mid.txt', 'old.txt']);
    expect(docs[0]).not.toHaveProperty('blob');
  });
});

describe('openDocument', () => {
  it('returns null for a document that no longer exists', async () => {
    expect(await openDocument(db, 'missing')).toBeNull();
  });

  it('returns the record and bumps lastOpenedAt', async () => {
    const id = await seedDoc('a.txt', 10, 5);
    const before = Date.now();
    const doc = await openDocument(db, id);
    expect(doc?.blob.size).toBe(10);
    expect(doc?.lastOpenedAt).toBeGreaterThanOrEqual(before);
    expect((await db.documents.get(id))?.lastOpenedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('deleteDocument', () => {
  it('removes the document and everything attached to it', async () => {
    const id = await seedDoc('a.pdf', 10, 5);
    const other = await seedDoc('b.pdf', 10, 6);
    await db.thumbnails.put({ docId: id, page: 1, blob: new Blob(['t']) });
    await db.progress.put({ docId: id, page: 2, scrollTop: 100 });
    await db.bookmarks.put({ id: 'bm1', docId: id, page: 2, label: 'x', createdAt: 1 });
    await db.highlights.put({ id: 'h1', docId: id, start: 0, end: 4, note: '', createdAt: 1 });
    await db.bookmarks.put({ id: 'bm2', docId: other, page: 1, label: 'keep', createdAt: 1 });

    await deleteDocument(db, id);

    expect(await db.documents.get(id)).toBeUndefined();
    expect(await db.thumbnails.count()).toBe(0);
    expect(await db.progress.count()).toBe(0);
    expect(await db.highlights.count()).toBe(0);
    expect((await db.bookmarks.toArray()).map((b) => b.id)).toEqual(['bm2']);
    expect(await db.documents.get(other)).toBeDefined();
  });
});

describe('clearAll', () => {
  async function fill() {
    await seedDoc('a.txt', 10, 5);
    await db.tracks.put({ id: 't1', title: 'T', artist: '', language: null, duration: 0, blob: new Blob(['aa']), addedAt: 1 });
    await db.prefs.put({ key: 'theme', value: 'sepia' });
  }

  it('keeps tracks and prefs when tracks are excluded', async () => {
    await fill();
    await clearAll(db, { includeTracks: false });
    expect(await db.documents.count()).toBe(0);
    expect(await db.tracks.count()).toBe(1);
    expect(await db.prefs.count()).toBe(1);
  });

  it('removes tracks too when asked, but never prefs', async () => {
    await fill();
    await clearAll(db, { includeTracks: true });
    expect(await db.documents.count()).toBe(0);
    expect(await db.tracks.count()).toBe(0);
    expect((await db.prefs.get('theme'))?.value).toBe('sepia');
  });
});

describe('seedIfEmpty', () => {
  it('adds the seed documents once', async () => {
    await seedIfEmpty(db);
    await seedIfEmpty(db);
    const docs = await listDocuments(db);
    expect(docs.map((doc) => doc.name)).toEqual(SEED_DOCS.map((seed) => seed.name));
    expect(docs.every((doc) => doc.type === 'text')).toBe(true);
  });

  it('does not bring the seeds back after the user deletes them', async () => {
    await seedIfEmpty(db);
    await clearAll(db, { includeTracks: false });
    await seedIfEmpty(db);
    expect(await db.documents.count()).toBe(0);
  });

  it('does not seed a library that already has documents', async () => {
    await seedDoc('mine.txt', 10, 5);
    await seedIfEmpty(db);
    expect((await listDocuments(db)).map((doc) => doc.name)).toEqual(['mine.txt']);
  });
});

describe('getUsage', () => {
  it('sums document, thumbnail and track bytes and reports the browser estimate', async () => {
    const id = await seedDoc('a.pdf', 100, 5);
    await db.thumbnails.put({ docId: id, page: 1, blob: new Blob(['12345']) });
    await db.tracks.put({ id: 't1', title: 'T', artist: '', language: null, duration: 0, blob: new Blob(['1234567']), addedAt: 1 });
    await db.tracks.put({ id: 't2', title: 'Stream', artist: '', language: null, duration: 0, url: 'https://x/y', addedAt: 2 });
    const usage = await getUsage(db, async () => ({ usage: 4096, quota: 1_000_000 }));
    expect(usage).toEqual({ documentBytes: 105, trackBytes: 7, usedBytes: 4096, quotaBytes: 1_000_000 });
  });

  it('reports null figures when the browser cannot estimate storage', async () => {
    const usage = await getUsage(db);
    expect(usage.usedBytes).toBeNull();
    expect(usage.quotaBytes).toBeNull();
  });
});

describe('requestPersistence', () => {
  it('resolves false when the Storage API is unavailable', async () => {
    expect(await requestPersistence()).toBe(false);
  });
});
