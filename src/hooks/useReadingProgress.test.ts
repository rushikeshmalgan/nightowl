import { act, renderHook, waitFor } from '@testing-library/react';
import * as progressLib from '../lib/progress';
import { useReadingProgress } from './useReadingProgress';

vi.mock('../lib/db', () => ({ db: {} }));
vi.mock('../lib/progress');

const lib = vi.mocked(progressLib);

beforeEach(() => {
  vi.resetAllMocks();
  lib.getProgress.mockResolvedValue(null);
  lib.saveProgress.mockResolvedValue();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useReadingProgress', () => {
  it('is undefined while loading, then the saved position', async () => {
    lib.getProgress.mockResolvedValue({ docId: 'a', page: 4, scrollTop: 1200 });
    const { result } = renderHook(() => useReadingProgress('a'));
    expect(result.current.initial).toBeUndefined();
    await waitFor(() => expect(result.current.initial).toEqual({ docId: 'a', page: 4, scrollTop: 1200 }));
  });

  it('is null when the document has no saved position', async () => {
    const { result } = renderHook(() => useReadingProgress('a'));
    await waitFor(() => expect(result.current.initial).toBeNull());
  });

  it('does nothing without a document', async () => {
    const { result } = renderHook(() => useReadingProgress(null));
    act(() => result.current.save(2, 100));
    expect(lib.getProgress).not.toHaveBeenCalled();
    expect(lib.saveProgress).not.toHaveBeenCalled();
    expect(result.current.initial).toBeNull();
  });

  it('coalesces rapid saves into one write with the latest position', async () => {
    const { result } = renderHook(() => useReadingProgress('a'));
    await waitFor(() => expect(result.current.initial).toBeNull());
    vi.useFakeTimers();
    act(() => {
      result.current.save(1, 100);
      result.current.save(2, 500);
      result.current.save(3, 900);
    });
    expect(lib.saveProgress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(lib.saveProgress).toHaveBeenCalledTimes(1);
    expect(lib.saveProgress).toHaveBeenCalledWith(expect.anything(), { docId: 'a', page: 3, scrollTop: 900 });
  });

  it('writes a pending position when the reader leaves', async () => {
    const { result, unmount } = renderHook(() => useReadingProgress('a'));
    await waitFor(() => expect(result.current.initial).toBeNull());
    act(() => result.current.save(2, 640));
    unmount();
    expect(lib.saveProgress).toHaveBeenCalledWith(expect.anything(), { docId: 'a', page: 2, scrollTop: 640 });
  });
});
