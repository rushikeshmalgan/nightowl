import { useCallback, useEffect, useState } from 'react';
import { db } from '../../shared/db';
import { importFileToLibrary } from './importPipeline';
import {
  clearAll as clearLibrary,
  deleteDocument,
  getUsage,
  listDocuments,
  openDocument,
  seedIfEmpty,
} from './library';
import type { Usage } from './library';
import { LIMIT_BYTES } from './lru';
import type { DocMeta, DocRecord } from '../../shared/types';

export type ImportOutcome = { ok: true; doc: DocMeta } | { ok: false; error: string };

export interface LocalCache {
  /** False until the first load from IndexedDB has finished. */
  ready: boolean;
  documents: DocMeta[];
  usage: Usage;
  overLimit: boolean;
  /** Validates the file, then stores it. */
  importFile(file: File): Promise<ImportOutcome>;
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
    async (file: File): Promise<ImportOutcome> => {
      const result = await importFileToLibrary(db, file);
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
