import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/db';
import {
  clearAll as clearLibrary,
  deleteDocument,
  getUsage,
  importDocument,
  listDocuments,
  openDocument,
  seedIfEmpty,
} from '../lib/library';
import type { Usage } from '../lib/library';
import { LIMIT_BYTES } from '../lib/lru';
import type { DocMeta, DocRecord } from '../types';

export type ImportOutcome = { ok: true; doc: DocMeta } | { ok: false; error: string };

export interface LocalCache {
  /** False until the first load from IndexedDB has finished. */
  ready: boolean;
  documents: DocMeta[];
  usage: Usage;
  overLimit: boolean;
  importFile(file: File, opts?: { thumbnail?: Blob }): Promise<ImportOutcome>;
  open(id: string): Promise<DocRecord | null>;
  remove(id: string): Promise<void>;
  clearAll(includeTracks: boolean): Promise<void>;
  refresh(): Promise<DocMeta[]>;
}

const EMPTY_USAGE: Usage = { documentBytes: 0, trackBytes: 0, usedBytes: null, quotaBytes: null };

function totalSize(documents: DocMeta[]): number {
  return documents.reduce((sum, doc) => sum + doc.size, 0);
}

/** The document library, backed by IndexedDB. */
export function useLocalCache(): LocalCache {
  const [ready, setReady] = useState(false);
  const [documents, setDocuments] = useState<DocMeta[]>([]);
  const [usage, setUsage] = useState<Usage>(EMPTY_USAGE);
  const [overLimit, setOverLimit] = useState(false);

  const refresh = useCallback(async (): Promise<DocMeta[]> => {
    const [list, figures] = await Promise.all([listDocuments(db), getUsage(db)]);
    setDocuments(list);
    setUsage(figures);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await seedIfEmpty(db);
      const list = await refresh();
      if (cancelled) return;
      setOverLimit(totalSize(list) > LIMIT_BYTES);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const importFile = useCallback(
    async (file: File, opts: { thumbnail?: Blob } = {}): Promise<ImportOutcome> => {
      const result = await importDocument(db, file, opts);
      if (!result.ok) return result;
      await refresh();
      setOverLimit(result.overLimit);
      return { ok: true, doc: result.doc };
    },
    [refresh],
  );

  const open = useCallback(
    async (id: string): Promise<DocRecord | null> => {
      const record = await openDocument(db, id);
      await refresh();
      return record;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteDocument(db, id);
      const list = await refresh();
      setOverLimit(totalSize(list) > LIMIT_BYTES);
    },
    [refresh],
  );

  const clearAll = useCallback(
    async (includeTracks: boolean): Promise<void> => {
      await clearLibrary(db, { includeTracks });
      await refresh();
      setOverLimit(false);
    },
    [refresh],
  );

  return { ready, documents, usage, overLimit, importFile, open, remove, clearAll, refresh };
}
