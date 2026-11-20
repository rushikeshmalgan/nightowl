import { REFLOW_READ_ERROR } from '../reader/reflowMessages';
import * as extract from './reflowExtract';
import { clearReflowCache, loadReflowText, peekReflowText } from './reflowCache';
import type { ReflowDoc } from './reflowText';

vi.mock('./reflowExtract', () => ({ extractReflow: vi.fn() }));
const extractReflow = vi.mocked(extract.extractReflow);

const data = new ArrayBuffer(8);
const textDoc: ReflowDoc = { pages: [{ page: 1, paragraphs: ['Hello.'] }], hasText: true };
const otherDoc: ReflowDoc = { pages: [{ page: 1, paragraphs: ['Different.'] }], hasText: true };
const scanned: ReflowDoc = { pages: [{ page: 1, paragraphs: [] }], hasText: false };

/** One recorded extraction: its progress callback, its signal, and a way to finish it. */
interface Run {
  onPage: (done: number, total: number) => void;
  signal: AbortSignal | undefined;
  resolve: (doc: ReflowDoc) => void;
  reject: (error: Error) => void;
}
let runs: Run[];

beforeEach(() => {
  vi.clearAllMocks();
  clearReflowCache();
  runs = [];
  extractReflow.mockImplementation(
    (_data, onPage, signal) =>
      new Promise<ReflowDoc>((resolve, reject) => {
        runs.push({ onPage, signal, resolve, reject });
      }),
  );
});

describe('loadReflowText', () => {
  it('runs one extraction for two simultaneous callers and gives both the same result', async () => {
    const first = loadReflowText('doc-1', data);
    const second = loadReflowText('doc-1', data);
    expect(extractReflow).toHaveBeenCalledTimes(1);
    runs[0].resolve(textDoc);
    const expected = { status: 'ready', doc: textDoc };
    await expect(first).resolves.toEqual(expected);
    await expect(second).resolves.toEqual(expected);
  });

  it('reports each page to every caller, and tells a late caller where it has got to', async () => {
    const early = vi.fn();
    const late = vi.fn();
    const first = loadReflowText('doc-1', data, early);
    runs[0].onPage(3, 10);
    const second = loadReflowText('doc-1', data, late);
    expect(late).toHaveBeenCalledWith(3, 10);
    runs[0].onPage(4, 10);
    expect(early.mock.calls).toEqual([[3, 10], [4, 10]]);
    expect(late.mock.calls).toEqual([[3, 10], [4, 10]]);
    runs[0].resolve(textDoc);
    await Promise.all([first, second]);
  });

  it('answers from the cache once an extraction has finished, without extracting or reporting progress', async () => {
    const first = loadReflowText('doc-1', data);
    runs[0].resolve(textDoc);
    await first;
    const onProgress = vi.fn();
    await expect(loadReflowText('doc-1', data, onProgress)).resolves.toEqual({ status: 'ready', doc: textDoc });
    expect(extractReflow).toHaveBeenCalledTimes(1);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('says a PDF with no text is empty, and remembers it', async () => {
    const result = loadReflowText('doc-1', data);
    runs[0].resolve(scanned);
    await expect(result).resolves.toEqual({ status: 'empty' });
    expect(peekReflowText('doc-1')).toEqual({ status: 'empty' });
  });

  it('turns a failed extraction into an error state instead of rejecting, and remembers it', async () => {
    const result = loadReflowText('doc-1', data);
    runs[0].reject(new Error('bad'));
    await expect(result).resolves.toEqual({ status: 'error', message: REFLOW_READ_ERROR });
    expect(peekReflowText('doc-1')).toEqual({ status: 'error', message: REFLOW_READ_ERROR });
    await loadReflowText('doc-1', data);
    expect(extractReflow).toHaveBeenCalledTimes(1);
  });

  it('keeps extracting while one of two callers is still interested', async () => {
    const quit = new AbortController();
    const stays = loadReflowText('doc-1', data);
    const leaves = loadReflowText('doc-1', data, undefined, quit.signal);
    quit.abort();
    await expect(leaves).resolves.toEqual({ status: 'idle' });
    expect(runs[0].signal?.aborted).toBe(false);
    runs[0].resolve(textDoc);
    await expect(stays).resolves.toEqual({ status: 'ready', doc: textDoc });
    expect(peekReflowText('doc-1')).toEqual({ status: 'ready', doc: textDoc });
  });

  it('stops the extraction when every caller has aborted, and caches nothing', async () => {
    const a = new AbortController();
    const b = new AbortController();
    const one = loadReflowText('doc-1', data, undefined, a.signal);
    const two = loadReflowText('doc-1', data, undefined, b.signal);
    a.abort();
    b.abort();
    expect(runs[0].signal?.aborted).toBe(true);
    await expect(one).resolves.toEqual({ status: 'idle' });
    await expect(two).resolves.toEqual({ status: 'idle' });
    runs[0].reject(new DOMException('cancelled', 'AbortError'));
    await Promise.resolve();
    expect(peekReflowText('doc-1')).toBeNull();
  });

  it('does not start an extraction for a caller that has already aborted', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(loadReflowText('doc-1', data, undefined, aborted.signal)).resolves.toEqual({ status: 'idle' });
    expect(extractReflow).not.toHaveBeenCalled();
  });

  it('is not confused by a cancelled extraction that finishes after a new one has started', async () => {
    const first = new AbortController();
    const cancelled = loadReflowText('doc-1', data, undefined, first.signal);
    first.abort();
    await cancelled;
    const fresh = loadReflowText('doc-1', data);
    expect(extractReflow).toHaveBeenCalledTimes(2);
    runs[0].resolve(otherDoc); // the cancelled run limps to the end
    await Promise.resolve();
    expect(peekReflowText('doc-1')).toBeNull();
    runs[1].resolve(textDoc);
    await expect(fresh).resolves.toEqual({ status: 'ready', doc: textDoc });
    expect(peekReflowText('doc-1')).toEqual({ status: 'ready', doc: textDoc });
  });

  it('keeps documents apart', async () => {
    const one = loadReflowText('doc-1', data);
    const two = loadReflowText('doc-2', data);
    expect(extractReflow).toHaveBeenCalledTimes(2);
    runs[1].resolve(otherDoc);
    runs[0].resolve(textDoc);
    await expect(one).resolves.toEqual({ status: 'ready', doc: textDoc });
    await expect(two).resolves.toEqual({ status: 'ready', doc: otherDoc });
  });
});

describe('peekReflowText', () => {
  it('is null until an extraction has finished, and again after the cache is cleared', async () => {
    expect(peekReflowText('doc-1')).toBeNull();
    const result = loadReflowText('doc-1', data);
    expect(peekReflowText('doc-1')).toBeNull();
    runs[0].resolve(textDoc);
    await result;
    expect(peekReflowText('doc-1')).toEqual({ status: 'ready', doc: textDoc });
    clearReflowCache();
    expect(peekReflowText('doc-1')).toBeNull();
  });
});
