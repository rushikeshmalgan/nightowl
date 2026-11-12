import { act, renderHook, waitFor } from '@testing-library/react';
import * as prefs from '../lib/prefs';
import { useMusicPrefs } from './useMusicPrefs';

vi.mock('../lib/prefs');

const lib = vi.mocked(prefs);
const store = new Map<string, unknown>();

beforeEach(() => {
  store.clear();
  lib.getPref.mockImplementation(async (key: string, fallback: unknown) => (store.has(key) ? store.get(key) : fallback) as never);
  lib.setPref.mockImplementation(async (key: string, value: unknown) => {
    store.set(key, value);
  });
});

const custom = { id: 'custom-youtube-abc', source: 'youtube' as const, ref: 'abc', title: 'My link', artist: 'YouTube', language: null, kind: 'video' as const };

describe('useMusicPrefs', () => {
  it('starts on night noise and the first category', async () => {
    const { result } = renderHook(() => useMusicPrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.source).toBe('noise');
    expect(result.current.category).toBe('english-focus');
    expect(result.current.customPlaylists).toEqual([]);
  });

  it('remembers a custom link across a fresh mount', async () => {
    const first = renderHook(() => useMusicPrefs());
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    act(() => first.result.current.addCustom(custom));
    expect(store.get('customPlaylists')).toEqual([custom]);
    first.unmount();

    const second = renderHook(() => useMusicPrefs());
    await waitFor(() => expect(second.result.current.customPlaylists).toEqual([custom]));
  });

  it('does not add the same link twice', async () => {
    const { result } = renderHook(() => useMusicPrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.addCustom(custom));
    act(() => result.current.addCustom(custom));
    expect(result.current.customPlaylists).toHaveLength(1);
  });

  it('remembers the source and category', async () => {
    const { result } = renderHook(() => useMusicPrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setSource('spotify'));
    act(() => result.current.setCategory('hindi-chill'));
    expect(store.get('musicSource')).toBe('spotify');
    expect(store.get('musicCategory')).toBe('hindi-chill');
  });

  it('ignores a saved source that does not exist', async () => {
    store.set('musicSource', 'cassette');
    const { result } = renderHook(() => useMusicPrefs());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.source).toBe('noise');
  });
});
