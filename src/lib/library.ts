import { SEED_DOCS } from '../data/seeds';
import type { DocMeta, DocRecord } from '../types';
import type { NightOwlDB } from './db';
import { detectDocType } from './fileTypes';
import { LIMIT_BYTES, planEviction } from './lru';

export type ImportResult = { ok: true; doc: DocMeta; overLimit: boolean } | { ok: false; error: string };

export interface Usage {
  /** Stored documents plus their thumbnails. */
  documentBytes: number;
  /** Uploaded music files. Stream-only tracks take no space. */
  trackBytes: number;
  /** The browser's own figure for everything this site stores, if it offers one. */
  usedBytes: number | null;
  quotaBytes: number | null;
}

export const UNSUPPORTED_TYPE_ERROR = 'Unsupported file type. Use .pdf, .psd, .txt, .md, .json or .csv.';
export const EMPTY_FILE_ERROR = 'File is empty.';
export const STORAGE_FULL_ERROR = 'Storage is full. Clear some documents and try again.';

const SEEDED_PREF = 'seeded';

function toMeta(record: DocRecord): DocMeta {
  const { blob: _blob, ...meta } = record;
  return meta;
}

function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const named = error as { name?: string; inner?: { name?: string } };
  return named.name === 'QuotaExceededError' || named.inner?.name === 'QuotaExceededError';
}

async function sizesOf(db: NightOwlDB): Promise<Array<{ id: string; size: number; lastOpenedAt: number }>> {
  const docs: Array<{ id: string; size: number; lastOpenedAt: number }> = [];
  await db.documents.each((doc) => {
    docs.push({ id: doc.id, size: doc.size, lastOpenedAt: doc.lastOpenedAt });
  });
  return docs;
}

/**
 * Adds a file to the library. Afterwards, least-recently-opened documents are
 * evicted until the library fits the limit; the new document is never evicted.
 * If the browser reports its storage is full, room is made once and the write
 * retried once.
 */
export async function importDocument(
  db: NightOwlDB,
  file: File,
  opts: { thumbnail?: Blob; limitBytes?: number } = {},
): Promise<ImportResult> {
  const type = detectDocType(file.name);
  if (!type) return { ok: false, error: UNSUPPORTED_TYPE_ERROR };
  if (file.size === 0) return { ok: false, error: EMPTY_FILE_ERROR };

  const limitBytes = opts.limitBytes ?? LIMIT_BYTES;
  const now = Date.now();
  const record: DocRecord = {
    id: crypto.randomUUID(),
    name: file.name,
    type,
    size: file.size,
    blob: file,
    addedAt: now,
    lastOpenedAt: now,
  };

  try {
    await db.documents.add(record);
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    // Free at least as much room as the incoming file needs, then try once more.
    const existing = await sizesOf(db);
    const existingTotal = existing.reduce((sum, doc) => sum + doc.size, 0);
    const incoming = { id: record.id, size: record.size, lastOpenedAt: record.lastOpenedAt };
    const plan = planEviction([...existing, incoming], record.id, Math.min(limitBytes, existingTotal));
    for (const id of plan.evictIds) await deleteDocument(db, id);
    try {
      await db.documents.add(record);
    } catch (retryError) {
      if (!isQuotaError(retryError)) throw retryError;
      return { ok: false, error: STORAGE_FULL_ERROR };
    }
  }

  if (opts.thumbnail) {
    await db.thumbnails.put({ docId: record.id, page: 1, blob: opts.thumbnail });
  }

  const plan = planEviction(await sizesOf(db), record.id, limitBytes);
  for (const id of plan.evictIds) await deleteDocument(db, id);

  return { ok: true, doc: toMeta(record), overLimit: plan.overLimit };
}

/** Every document's metadata, most recently opened first. */
export async function listDocuments(db: NightOwlDB): Promise<DocMeta[]> {
  const records = await db.documents.orderBy('lastOpenedAt').reverse().toArray();
  return records.map(toMeta);
}

/** Loads a document and marks it as just opened. Null if it has been removed. */
export async function openDocument(db: NightOwlDB, id: string): Promise<DocRecord | null> {
  const record = await db.documents.get(id);
  if (!record) return null;
  const lastOpenedAt = Date.now();
  await db.documents.update(id, { lastOpenedAt });
  return { ...record, lastOpenedAt };
}

export async function deleteDocument(db: NightOwlDB, id: string): Promise<void> {
  await db.transaction('rw', [db.documents, db.thumbnails, db.progress, db.bookmarks, db.highlights], async () => {
    await db.documents.delete(id);
    await db.thumbnails.where('docId').equals(id).delete();
    await db.progress.delete(id);
    await db.bookmarks.where('docId').equals(id).delete();
    await db.highlights.where('docId').equals(id).delete();
  });
}

/** Empties the library. Preferences always survive; tracks only go when asked. */
export async function clearAll(db: NightOwlDB, opts: { includeTracks: boolean }): Promise<void> {
  await Promise.all([
    db.documents.clear(),
    db.thumbnails.clear(),
    db.progress.clear(),
    db.bookmarks.clear(),
    db.highlights.clear(),
  ]);
  if (opts.includeTracks) await db.tracks.clear();
}

type Estimate = () => Promise<{ usage?: number; quota?: number }>;

function browserEstimate(): Estimate | null {
  if (typeof navigator === 'undefined') return null;
  const storage = navigator.storage as StorageManager | undefined;
  if (!storage || typeof storage.estimate !== 'function') return null;
  return () => storage.estimate();
}

export async function getUsage(db: NightOwlDB, estimate?: Estimate): Promise<Usage> {
  let documentBytes = 0;
  let trackBytes = 0;
  await db.documents.each((doc) => {
    documentBytes += doc.size;
  });
  await db.thumbnails.each((thumb) => {
    documentBytes += thumb.blob.size;
  });
  await db.tracks.each((track) => {
    trackBytes += track.blob?.size ?? 0;
  });

  const ask = estimate ?? browserEstimate();
  let usedBytes: number | null = null;
  let quotaBytes: number | null = null;
  if (ask) {
    try {
      const result = await ask();
      usedBytes = result.usage ?? null;
      quotaBytes = result.quota ?? null;
    } catch {
      // The estimate is informational; leave both figures unknown.
    }
  }
  return { documentBytes, trackBytes, usedBytes, quotaBytes };
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const storage = navigator.storage as StorageManager | undefined;
  if (!storage || typeof storage.persist !== 'function') return false;
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

/**
 * Adds the sample documents the first time the app runs. A saved flag stops
 * them coming back after the user deletes them.
 */
export async function seedIfEmpty(db: NightOwlDB): Promise<void> {
  // One transaction for check-and-insert: a second caller (React StrictMode's
  // double effect, or another tab) waits and then sees the flag.
  await db.transaction('rw', [db.documents, db.prefs], async () => {
    const flag = await db.prefs.get(SEEDED_PREF);
    if (flag?.value === true) return;

    if ((await db.documents.count()) === 0) {
      const now = Date.now();
      const records: DocRecord[] = SEED_DOCS.map((seed, index) => {
        const blob = new Blob([seed.text], { type: 'text/plain' });
        return {
          id: crypto.randomUUID(),
          name: seed.name,
          type: 'text',
          size: blob.size,
          blob,
          addedAt: now,
          // Keep the seeds in their listed order, first one most recent.
          lastOpenedAt: now - index,
        };
      });
      await db.documents.bulkAdd(records);
    }
    await db.prefs.put({ key: SEEDED_PREF, value: true });
  });
}
