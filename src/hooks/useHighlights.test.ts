import { act, renderHook, waitFor } from '@testing-library/react';
import * as store from '../lib/highlightStore';
import type { HighlightRecord } from '../types';
import { useHighlights } from './useHighlights';

vi.mock('../lib/db', () => ({ db: {} }));
vi.mock('../lib/highlightStore');

const lib = vi.mocked(store);
const record = (id: string, start: number, end: number, note = ''): HighlightRecord => ({
  id,
  docId: 'a',
  start,
  end,
  note,
  createdAt: start,
});

beforeEach(() => {
  vi.resetAllMocks();
  lib.listHighlights.mockResolvedValue([]);
});

describe('useHighlights', () => {
  it('loads the highlights of the open document', async () => {
    lib.listHighlights.mockResolvedValue([record('x', 4, 9)]);
    const { result } = renderHook(() => useHighlights('a'));
    await waitFor(() => expect(result.current.highlights).toHaveLength(1));
    expect(lib.listHighlights).toHaveBeenCalledWith(expect.anything(), 'a');
  });

  it('has none without a document', () => {
    const { result } = renderHook(() => useHighlights(null));
    expect(result.current.highlights).toEqual([]);
    expect(lib.listHighlights).not.toHaveBeenCalled();
  });

  it('adds a highlight with an empty note and refreshes', async () => {
    const { result } = renderHook(() => useHighlights('a'));
    await waitFor(() => expect(lib.listHighlights).toHaveBeenCalled());
    lib.addHighlight.mockResolvedValue(record('new', 4, 9));
    lib.listHighlights.mockResolvedValue([record('new', 4, 9)]);
    await act(async () => {
      await result.current.add({ start: 4, end: 9 });
    });
    expect(lib.addHighlight).toHaveBeenCalledWith(expect.anything(), { docId: 'a', start: 4, end: 9, note: '' });
    expect(result.current.highlights.map((h) => h.id)).toEqual(['new']);
  });

  it('saves a note and refreshes', async () => {
    lib.listHighlights.mockResolvedValue([record('x', 4, 9)]);
    const { result } = renderHook(() => useHighlights('a'));
    await waitFor(() => expect(result.current.highlights).toHaveLength(1));
    lib.updateHighlightNote.mockResolvedValue();
    lib.listHighlights.mockResolvedValue([record('x', 4, 9, 'why this matters')]);
    await act(async () => {
      await result.current.setNote('x', 'why this matters');
    });
    expect(lib.updateHighlightNote).toHaveBeenCalledWith(expect.anything(), 'x', 'why this matters');
    expect(result.current.highlights[0].note).toBe('why this matters');
  });

  it('removes a highlight and refreshes', async () => {
    lib.listHighlights.mockResolvedValue([record('x', 4, 9)]);
    const { result } = renderHook(() => useHighlights('a'));
    await waitFor(() => expect(result.current.highlights).toHaveLength(1));
    lib.deleteHighlight.mockResolvedValue();
    lib.listHighlights.mockResolvedValue([]);
    await act(async () => {
      await result.current.remove('x');
    });
    expect(lib.deleteHighlight).toHaveBeenCalledWith(expect.anything(), 'x');
    expect(result.current.highlights).toEqual([]);
  });
});
