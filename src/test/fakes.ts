/**
 * In-memory stand-ins for the storage modules, for jsdom tests of components
 * that sit above them. jsdom's Blob and fake-indexeddb do not mix, so tests
 * of the real modules run in the node environment instead.
 *
 * Usage in a test file:
 *   vi.mock('./lib/library', async () => (await import('./test/fakes')).fakeLibraryModule);
 */
import { SEED_DOCS } from '../data/seeds';
import { detectDocType } from '../lib/fileTypes';
import type { BookmarkRecord, DocMeta, DocRecord, ProgressRecord } from '../types';

const texts = new WeakMap<Blob, string>();
let clock = 1000;

export const state = {
  docs: [] as DocRecord[],
  bookmarks: [] as BookmarkRecord[],
  progress: new Map<string, ProgressRecord>(),
  prefs: new Map<string, unknown>(),
};

export function makeTextDoc(name: string, text: string): DocRecord {
  const blob = new Blob([text], { type: 'text/plain' });
  texts.set(blob, text);
  clock += 1;
  return { id: `doc-${clock}`, name, type: 'text', size: text.length, blob, addedAt: clock, lastOpenedAt: clock };
}

/** Resets to a fresh library holding the two seed documents. */
export function resetFakes(): void {
  clock = 1000;
  state.docs = SEED_DOCS.map((seed) => makeTextDoc(seed.name, seed.text));
  // First seed is the most recently opened, as in the real seeding.
  state.docs.forEach((doc, index) => {
    doc.lastOpenedAt = 500 - index;
  });
  state.bookmarks = [];
  state.progress.clear();
  state.prefs.clear();
}

function toMeta(record: DocRecord): DocMeta {
  const { blob: _blob, ...meta } = record;
  return meta;
}

function readWithFileReader(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

export const fakeDbModule = { db: {} };

export const fakeLibraryModule = {
  seedIfEmpty: async () => {},
  listDocuments: async () => [...state.docs].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).map(toMeta),
  openDocument: async (_db: unknown, id: string) => {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc) return null;
    clock += 1;
    doc.lastOpenedAt = clock;
    return { ...doc };
  },
  importDocument: async (_db: unknown, file: File) => {
    const type = detectDocType(file.name);
    if (!type) return { ok: false, error: 'Unsupported file type. Use .pdf, .psd, .txt, .md, .json or .csv.' };
    if (file.size === 0) return { ok: false, error: 'File is empty.' };
    clock += 1;
    const record: DocRecord = {
      id: `doc-${clock}`,
      name: file.name,
      type,
      size: file.size,
      blob: file,
      addedAt: clock,
      lastOpenedAt: clock,
    };
    state.docs.push(record);
    return { ok: true, doc: toMeta(record), overLimit: false };
  },
  deleteDocument: async (_db: unknown, id: string) => {
    state.docs = state.docs.filter((d) => d.id !== id);
    state.bookmarks = state.bookmarks.filter((b) => b.docId !== id);
    state.progress.delete(id);
  },
  clearAll: async () => {
    state.docs = [];
    state.bookmarks = [];
    state.progress.clear();
  },
  getUsage: async () => ({
    documentBytes: state.docs.reduce((sum, d) => sum + d.size, 0),
    trackBytes: 0,
    usedBytes: null,
    quotaBytes: null,
  }),
  requestPersistence: async () => false,
};

export const fakeProgressModule = {
  saveProgress: async (_db: unknown, record: ProgressRecord) => {
    state.progress.set(record.docId, record);
  },
  getProgress: async (_db: unknown, docId: string) => state.progress.get(docId) ?? null,
  addBookmark: async (_db: unknown, bookmark: { docId: string; page: number; label: string }) => {
    clock += 1;
    const record: BookmarkRecord = { id: `bm-${clock}`, createdAt: clock, ...bookmark };
    state.bookmarks.push(record);
    return record;
  },
  listBookmarks: async (_db: unknown, docId?: string) =>
    state.bookmarks.filter((b) => !docId || b.docId === docId).sort((a, b) => b.createdAt - a.createdAt),
  deleteBookmark: async (_db: unknown, id: string) => {
    state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
  },
};

export const fakePrefsModule = {
  getPref: async (key: string, fallback: unknown) => (state.prefs.has(key) ? state.prefs.get(key) : fallback),
  setPref: async (key: string, value: unknown) => {
    state.prefs.set(key, value);
  },
};

export const fakeTextModule = {
  readText: async (blob: Blob) => texts.get(blob) ?? readWithFileReader(blob),
};
