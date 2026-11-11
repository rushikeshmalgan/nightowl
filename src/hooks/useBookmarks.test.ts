import { act, renderHook, waitFor } from '@testing-library/react';
import * as progressLib from '../lib/progress';
import type { BookmarkRecord } from '../types';
import { useBookmarks } from './useBookmarks';

vi.mock('../lib/db', () => ({ db: {} }));
vi.mock('../lib/progress');

const lib = vi.mocked(progressLib);
const bookmark = (id: string, page: number): BookmarkRecord => ({ id, docId: 'a', page, label: `Page ${page}`, createdAt: page });

beforeEach(() => {
  vi.resetAllMocks();
  lib.listBookmarks.mockResolvedValue([]);
});

describe('useBookmarks', () => {
  it('loads the bookmarks of the open document', async () => {
    lib.listBookmarks.mockResolvedValue([bookmark('x', 2)]);
    const { result } = renderHook(() => useBookmarks('a'));
    await waitFor(() => expect(result.current.bookmarks).toHaveLength(1));
    expect(lib.listBookmarks).toHaveBeenCalledWith(expect.anything(), 'a');
  });

  it('has no bookmarks without a document', () => {
    const { result } = renderHook(() => useBookmarks(null));
    expect(result.current.bookmarks).toEqual([]);
    expect(lib.listBookmarks).not.toHaveBeenCalled();
  });

  it('adds a bookmark and refreshes the list', async () => {
    const { result } = renderHook(() => useBookmarks('a'));
    await waitFor(() => expect(lib.listBookmarks).toHaveBeenCalled());
    lib.addBookmark.mockResolvedValue(bookmark('new', 5));
    lib.listBookmarks.mockResolvedValue([bookmark('new', 5)]);
    await act(async () => {
      await result.current.add(5, 'Page 5');
    });
    expect(lib.addBookmark).toHaveBeenCalledWith(expect.anything(), { docId: 'a', page: 5, label: 'Page 5' });
    expect(result.current.bookmarks.map((b) => b.id)).toEqual(['new']);
  });

  it('removes a bookmark and refreshes the list', async () => {
    lib.listBookmarks.mockResolvedValue([bookmark('x', 2)]);
    const { result } = renderHook(() => useBookmarks('a'));
    await waitFor(() => expect(result.current.bookmarks).toHaveLength(1));
    lib.deleteBookmark.mockResolvedValue();
    lib.listBookmarks.mockResolvedValue([]);
    await act(async () => {
      await result.current.remove('x');
    });
    expect(lib.deleteBookmark).toHaveBeenCalledWith(expect.anything(), 'x');
    expect(result.current.bookmarks).toEqual([]);
  });
});
