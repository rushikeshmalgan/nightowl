import { act, renderHook } from '@testing-library/react';
import * as cache from '../pdf/reflowCache';
import type { ReflowState } from '../pdf/reflowCache';
import type { ReflowDoc } from '../pdf/reflowText';
import { DEBOUNCE_MS, useDocumentSearch } from './useDocumentSearch';

vi.mock('../pdf/reflowCache', () => ({ loadReflowText: vi.fn(), peekReflowText: vi.fn() }));
const loadReflowText = vi.mocked(cache.loadReflowText);
const peekReflowText = vi.mocked(cache.peekReflowText);

/** One recorded call to the shared extraction. */
interface Load {
  docId: string;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  resolve: (state: ReflowState) => void;
}
let loads: Load[];
let reads: number;

/** A stand-in for a stored file: counts how often its bytes are read. */
const file = (): Blob => ({ arrayBuffer: () => (reads += 1, Promise.resolve(new ArrayBuffer(4))) }) as unknown as Blob;

const pdfDoc = (id = 'pdf-1') => ({ id, type: 'pdf' as const, blob: file() });
const textDoc = (id = 'text-1') => ({ id, type: 'text' as const, blob: file() });
const psdDoc = () => ({ id: 'psd-1', type: 'psd' as const, blob: file() });

const reflowDoc: ReflowDoc = {
  hasText: true,
  pages: [
    { page: 1, paragraphs: ['A quiet night.'] },
    { page: 2, paragraphs: ['Night again.', 'night once more'] },
  ],
};
const ready: ReflowState = { status: 'ready', doc: reflowDoc };

type Args = Parameters<typeof useDocumentSearch>[0];
const base = (overrides: Partial<Args> = {}): Args => ({ doc: null, text: '', query: '', active: true, ...overrides });
const search = (initial: Args) => renderHook((props: Args) => useDocumentSearch(props), { initialProps: initial });
const flush = () => act(async () => {});
const pause = (ms = DEBOUNCE_MS) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  loads = [];
  reads = 0;
  peekReflowText.mockReturnValue(null);
  loadReflowText.mockImplementation(
    (docId, _data, onProgress, signal) =>
      new Promise<ReflowState>((resolve) => {
        loads.push({ docId, onProgress, signal, resolve });
      }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDocumentSearch: when it does nothing', () => {
  it('is idle while the palette is closed, with no document, or for a query under two characters, and reads nothing', async () => {
    const closed = search(base({ doc: pdfDoc(), query: 'night', active: false }));
    const none = search(base({ doc: null, query: 'night' }));
    const short = search(base({ doc: pdfDoc(), query: 'n' }));
    await pause();
    for (const { result } of [closed, none, short]) expect(result.current.status).toBe('idle');
    expect(reads).toBe(0);
    expect(loadReflowText).not.toHaveBeenCalled();
  });

  it('says a PSD cannot be searched', () => {
    const { result } = search(base({ doc: psdDoc(), query: 'night' }));
    expect(result.current.status).toBe('unsupported');
    expect(loadReflowText).not.toHaveBeenCalled();
  });

  it('stays idle for a text document until its text has loaded', async () => {
    const { result } = search(base({ doc: textDoc(), text: '', query: 'night' }));
    await pause();
    expect(result.current.status).toBe('idle');
  });
});

describe('useDocumentSearch: a text document', () => {
  it('searches its text after a pause, not before, and a newer query replaces the older', async () => {
    const text = 'The night was calm. The owl woke at night. Day came.';
    const { result, rerender } = search(base({ doc: textDoc(), text, query: 'night' }));
    expect(result.current.hits).toEqual([]);
    await pause(DEBOUNCE_MS - 1);
    expect(result.current.hits).toEqual([]);
    await pause(1);
    expect(result.current).toMatchObject({ status: 'ready', query: 'night', totalHits: 2, capped: false });
    expect(result.current.hits.map((h) => h.offset)).toEqual([text.indexOf('night'), text.lastIndexOf('night')]);
    expect(result.current.hits.map((h) => h.offset)).toEqual([4, 36]);
    expect(result.current.hits[0].page).toBeUndefined();

    rerender(base({ doc: textDoc(), text, query: 'owl' }));
    await pause();
    expect(result.current).toMatchObject({ status: 'ready', query: 'owl', totalHits: 1 });
    expect(loadReflowText).not.toHaveBeenCalled();
  });

  it('is ready with no hits when nothing matches', async () => {
    const { result } = search(base({ doc: textDoc(), text: 'The night was calm.', query: 'moon' }));
    await pause();
    expect(result.current).toMatchObject({ status: 'ready', query: 'moon', hits: [], totalHits: 0 });
  });

  it('drops its hits at once when the query gets shorter than two characters', async () => {
    const text = 'night night';
    const { result, rerender } = search(base({ doc: textDoc(), text, query: 'night' }));
    await pause();
    expect(result.current.hits).toHaveLength(2);
    rerender(base({ doc: textDoc(), text, query: 'n' }));
    expect(result.current.status).toBe('idle');
    expect(result.current.hits).toEqual([]);
  });

  it('lists 20 of a huge text quickly when the query is two characters', async () => {
    const text = 'lorem ipsum dolor sit amet '.repeat(80_000); // about 2 MB
    const { result } = search(base({ doc: textDoc(), text, query: 'or' }));
    const started = performance.now();
    await pause();
    expect(performance.now() - started).toBeLessThan(1000);
    expect(result.current.hits).toHaveLength(20);
    expect(result.current.capped).toBe(true);
  });

  it('keeps the same hits array between renders for the same query', async () => {
    const text = 'night night';
    const doc = textDoc();
    const { result, rerender } = search(base({ doc, text, query: 'night' }));
    await pause();
    const first = result.current.hits;
    rerender(base({ doc, text, query: 'night' }));
    expect(result.current.hits).toBe(first);
  });
});

describe('useDocumentSearch: a PDF', () => {
  it('reads the file and starts the extraction only when a valid query is typed, and reads the file once', async () => {
    const doc = pdfDoc();
    const { result, rerender } = search(base({ doc, query: '' }));
    await flush();
    expect(reads).toBe(0);
    expect(loadReflowText).not.toHaveBeenCalled();

    rerender(base({ doc, query: 'ni' }));
    await flush();
    rerender(base({ doc, query: 'nig' }));
    rerender(base({ doc, query: 'night' }));
    await flush();
    expect(reads).toBe(1);
    expect(loadReflowText).toHaveBeenCalledTimes(1);
    expect(loads[0].docId).toBe('pdf-1');
    expect(result.current.status).toBe('preparing');
  });

  it('shows page progress while preparing, then the hits with the page of each', async () => {
    const { result } = search(base({ doc: pdfDoc(), query: 'night' }));
    await flush();
    expect(result.current).toMatchObject({ status: 'preparing', done: 0, total: 0 });
    act(() => loads[0].onProgress?.(3, 12));
    expect(result.current).toMatchObject({ status: 'preparing', done: 3, total: 12 });

    await act(async () => loads[0].resolve(ready));
    await pause();
    expect(result.current).toMatchObject({ status: 'ready', query: 'night', totalHits: 3, capped: false });
    expect(result.current.hits.map((h) => [h.page, h.offset])).toEqual([
      [1, 8],
      [2, 0],
      [2, 14],
    ]);
  });

  it('uses a finished extraction at once, without reading the file again', async () => {
    peekReflowText.mockReturnValue(ready);
    const { result } = search(base({ doc: pdfDoc(), query: 'night' }));
    await pause();
    expect(result.current).toMatchObject({ status: 'ready', totalHits: 3 });
    expect(loadReflowText).not.toHaveBeenCalled();
    expect(reads).toBe(0);
  });

  it('says a scanned PDF has no text, and that a failed read failed', async () => {
    const scanned = search(base({ doc: pdfDoc('a'), query: 'night' }));
    const broken = search(base({ doc: pdfDoc('b'), query: 'night' }));
    await flush();
    await act(async () => {
      loads.find((l) => l.docId === 'a')?.resolve({ status: 'empty' });
      loads.find((l) => l.docId === 'b')?.resolve({ status: 'error', message: 'nope' });
    });
    expect(scanned.result.current.status).toBe('empty');
    expect(broken.result.current.status).toBe('error');
    expect(scanned.result.current.hits).toEqual([]);
  });

  it('gives up its interest in the extraction when the palette closes', async () => {
    const doc = pdfDoc();
    const { rerender } = search(base({ doc, query: 'night' }));
    await flush();
    expect(loads[0].signal?.aborted).toBe(false);
    rerender(base({ doc, query: 'night', active: false }));
    expect(loads[0].signal?.aborted).toBe(true);
  });

  it('drops the old document\'s hits at once when another document opens', async () => {
    const { result, rerender } = search(base({ doc: pdfDoc('pdf-1'), query: 'night' }));
    await flush();
    await act(async () => loads[0].resolve(ready));
    await pause();
    expect(result.current.hits.length).toBeGreaterThan(0);

    rerender(base({ doc: pdfDoc('pdf-2'), query: 'night' }));
    expect(result.current.hits).toEqual([]);
    expect(result.current.status).toBe('preparing');
    await flush();
    expect(loads).toHaveLength(2);
    expect(loads[1].docId).toBe('pdf-2');
  });

  it('never shows the old document\'s result for the new one, even if the old extraction finishes late', async () => {
    const { result, rerender } = search(base({ doc: pdfDoc('pdf-1'), query: 'night' }));
    await flush();
    rerender(base({ doc: pdfDoc('pdf-2'), query: 'night' })); // the first has not finished
    await flush();
    expect(loads[0].signal?.aborted).toBe(true);

    await act(async () => loads[1].resolve({ status: 'empty' })); // the new one has no text
    await act(async () => loads[0].resolve(ready)); // the old one limps in late
    await pause();
    expect(result.current.status).toBe('empty');
    expect(result.current.hits).toEqual([]);
  });

  it('keeps one extraction going while the query is edited, even down to a single character', async () => {
    const doc = pdfDoc();
    const { rerender } = search(base({ doc, query: 'ni' }));
    await flush();
    rerender(base({ doc, query: 'n' }));
    await flush();
    rerender(base({ doc, query: 'nig' }));
    await flush();
    expect(loadReflowText).toHaveBeenCalledTimes(1);
    expect(loads[0].signal?.aborted).toBe(false);
  });

  it('drops the hits when the document is closed', async () => {
    const doc = pdfDoc();
    const { result, rerender } = search(base({ doc, query: 'night' }));
    await flush();
    await act(async () => loads[0].resolve(ready));
    await pause();
    rerender(base({ doc: null, query: 'night' }));
    expect(result.current).toMatchObject({ status: 'idle', hits: [] });
  });
});
