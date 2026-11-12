import { act, renderHook, waitFor } from '@testing-library/react';
import * as importPipeline from '../lib/importPipeline';
import * as library from '../lib/library';
import type { DocMeta } from '../types';
import { useLocalCache } from './useLocalCache';

vi.mock('../lib/db', () => ({ db: {} }));
vi.mock('../lib/library');
vi.mock('../lib/importPipeline');

const lib = vi.mocked(library);
const pipeline = vi.mocked(importPipeline);
const meta = (id: string, size = 10): DocMeta => ({ id, name: `${id}.txt`, type: 'text', size, addedAt: 1, lastOpenedAt: 1 });
const usage = { documentBytes: 0, trackBytes: 0, usedBytes: null, quotaBytes: null };

beforeEach(() => {
  vi.resetAllMocks();
  lib.seedIfEmpty.mockResolvedValue();
  lib.listDocuments.mockResolvedValue([meta('seed')]);
  lib.getUsage.mockResolvedValue(usage);
});

describe('useLocalCache', () => {
  it('seeds the library and loads the document list on mount', async () => {
    const { result } = renderHook(() => useLocalCache());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(lib.seedIfEmpty).toHaveBeenCalledTimes(1);
    expect(result.current.documents.map((d) => d.id)).toEqual(['seed']);
  });

  it('refreshes the list after a successful import', async () => {
    const { result } = renderHook(() => useLocalCache());
    await waitFor(() => expect(result.current.ready).toBe(true));

    pipeline.importFileToLibrary.mockResolvedValue({ ok: true, doc: meta('new'), overLimit: false });
    lib.listDocuments.mockResolvedValue([meta('new'), meta('seed')]);
    let outcome: Awaited<ReturnType<typeof result.current.importFile>> | undefined;
    await act(async () => {
      outcome = await result.current.importFile(new File(['x'], 'new.txt'));
    });

    expect(outcome).toEqual({ ok: true, doc: meta('new') });
    expect(result.current.documents.map((d) => d.id)).toEqual(['new', 'seed']);
    expect(result.current.overLimit).toBe(false);
  });

  it('returns the error and adds nothing when an import fails', async () => {
    const { result } = renderHook(() => useLocalCache());
    await waitFor(() => expect(result.current.ready).toBe(true));

    pipeline.importFileToLibrary.mockResolvedValue({ ok: false, error: 'File is empty.' });
    let outcome: Awaited<ReturnType<typeof result.current.importFile>> | undefined;
    await act(async () => {
      outcome = await result.current.importFile(new File([], 'empty.txt'));
    });

    expect(outcome).toEqual({ ok: false, error: 'File is empty.' });
    expect(result.current.documents.map((d) => d.id)).toEqual(['seed']);
  });

  it('reports over-limit when the library says so, and clears it once documents are removed', async () => {
    const { result } = renderHook(() => useLocalCache());
    await waitFor(() => expect(result.current.ready).toBe(true));

    pipeline.importFileToLibrary.mockResolvedValue({ ok: true, doc: meta('huge'), overLimit: true });
    lib.listDocuments.mockResolvedValue([meta('huge')]);
    await act(async () => {
      await result.current.importFile(new File(['x'], 'huge.psd'));
    });
    expect(result.current.overLimit).toBe(true);

    lib.deleteDocument.mockResolvedValue();
    lib.listDocuments.mockResolvedValue([]);
    await act(async () => {
      await result.current.remove('huge');
    });
    expect(lib.deleteDocument).toHaveBeenCalledWith(expect.anything(), 'huge');
    expect(result.current.overLimit).toBe(false);
    expect(result.current.documents).toEqual([]);
  });

  it('opens a document through the library and passes null through', async () => {
    const { result } = renderHook(() => useLocalCache());
    await waitFor(() => expect(result.current.ready).toBe(true));

    lib.openDocument.mockResolvedValue(null);
    let opened: unknown = 'unset';
    await act(async () => {
      opened = await result.current.open('gone');
    });
    expect(opened).toBeNull();
    expect(lib.openDocument).toHaveBeenCalledWith(expect.anything(), 'gone');
  });

  it('clears the library, optionally with tracks', async () => {
    const { result } = renderHook(() => useLocalCache());
    await waitFor(() => expect(result.current.ready).toBe(true));

    lib.clearAll.mockResolvedValue();
    lib.listDocuments.mockResolvedValue([]);
    await act(async () => {
      await result.current.clearAll(true);
    });
    expect(lib.clearAll).toHaveBeenCalledWith(expect.anything(), { includeTracks: true });
    expect(result.current.documents).toEqual([]);
  });
});
