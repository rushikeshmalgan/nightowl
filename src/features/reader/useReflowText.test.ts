import { act, renderHook, waitFor } from '@testing-library/react';
import * as extract from '../pdf/reflowExtract';
import type { ReflowDoc } from '../pdf/reflowText';
import { clearReflowCache, REFLOW_READ_ERROR, useReflowText } from './useReflowText';

vi.mock('../pdf/reflowExtract', () => ({ extractReflow: vi.fn() }));
const extractReflow = vi.mocked(extract.extractReflow);

const data = new ArrayBuffer(8);
const textDoc: ReflowDoc = { pages: [{ page: 1, paragraphs: ['Hello.'] }], hasText: true };
const scanned: ReflowDoc = { pages: [{ page: 1, paragraphs: [] }], hasText: false };

beforeEach(() => {
  vi.clearAllMocks();
  clearReflowCache();
});

describe('useReflowText', () => {
  it('does nothing until Reflow is asked for', () => {
    const { result } = renderHook(() => useReflowText('doc-1', data, false));
    expect(result.current).toEqual({ status: 'idle' });
    expect(extractReflow).not.toHaveBeenCalled();
  });

  it('reports page progress, then the text', async () => {
    let report: (done: number, total: number) => void = () => {};
    let finish: (doc: ReflowDoc) => void = () => {};
    extractReflow.mockImplementation((_data, onPage) => {
      report = onPage;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { result } = renderHook(() => useReflowText('doc-1', data, true));
    expect(result.current).toEqual({ status: 'loading', done: 0, total: 0 });
    act(() => report(3, 10));
    expect(result.current).toEqual({ status: 'loading', done: 3, total: 10 });
    await act(async () => finish(textDoc));
    expect(result.current).toEqual({ status: 'ready', doc: textDoc });
  });

  it('extracts a document once and reuses the result', async () => {
    extractReflow.mockResolvedValue(textDoc);
    const first = renderHook(() => useReflowText('doc-1', data, true));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    const second = renderHook(() => useReflowText('doc-1', data, true));
    expect(second.result.current).toEqual({ status: 'ready', doc: textDoc });
    expect(extractReflow).toHaveBeenCalledTimes(1);
  });

  it('says a scanned PDF has no text', async () => {
    extractReflow.mockResolvedValue(scanned);
    const { result } = renderHook(() => useReflowText('doc-1', data, true));
    await waitFor(() => expect(result.current).toEqual({ status: 'empty' }));
  });

  it('explains a failure instead of throwing', async () => {
    extractReflow.mockRejectedValue(new Error('bad'));
    const { result } = renderHook(() => useReflowText('doc-1', data, true));
    await waitFor(() => expect(result.current).toEqual({ status: 'error', message: REFLOW_READ_ERROR }));
  });

  it('cancels the extraction when another document opens', async () => {
    const signals: AbortSignal[] = [];
    extractReflow.mockImplementation((_data, _onPage, signal) => {
      if (signal) signals.push(signal);
      return new Promise(() => {});
    });
    const { rerender } = renderHook(({ id }) => useReflowText(id, data, true), { initialProps: { id: 'doc-1' } });
    rerender({ id: 'doc-2' });
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });
});
