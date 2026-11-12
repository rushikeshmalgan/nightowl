import { act, renderHook, waitFor } from '@testing-library/react';
import * as prefs from '../../shared/prefs';
import { useUi } from './ui';
import { usePrefsSync } from './usePrefsSync';

vi.mock('../../shared/prefs');

const lib = vi.mocked(prefs);

beforeEach(() => {
  vi.resetAllMocks();
  act(() => useUi.getState().reset());
  lib.setPref.mockResolvedValue();
});

describe('usePrefsSync', () => {
  it('hydrates the store from saved preferences', async () => {
    const saved: Record<string, unknown> = { theme: 'sepia', warmthK: 3000, fontSize: 22 };
    lib.getPref.mockImplementation(async (key: string, fallback: unknown) => (key in saved ? saved[key] : fallback) as never);

    renderHook(() => usePrefsSync());

    await waitFor(() => expect(useUi.getState().theme).toBe('sepia'));
    expect(useUi.getState().warmthK).toBe(3000);
    expect(useUi.getState().fontSize).toBe(22);
    expect(useUi.getState().brightness).toBe(90);
    expect(document.documentElement.dataset.theme).toBe('sepia');
  });

  it('writes a changed setting back', async () => {
    lib.getPref.mockImplementation(async (_key: string, fallback: unknown) => fallback as never);
    const { result } = renderHook(() => usePrefsSync());
    await waitFor(() => expect(result.current).toBe(true));

    act(() => useUi.getState().set('warmthK', 2600));

    expect(lib.setPref).toHaveBeenCalledWith('warmthK', 2600);
  });

  it('does not write settings that are not persisted', async () => {
    lib.getPref.mockImplementation(async (_key: string, fallback: unknown) => fallback as never);
    const { result } = renderHook(() => usePrefsSync());
    await waitFor(() => expect(result.current).toBe(true));

    act(() => useUi.getState().toggle('paletteOpen'));

    expect(lib.setPref).not.toHaveBeenCalled();
  });

  it('ignores a saved value of the wrong type', async () => {
    const saved: Record<string, unknown> = { theme: 'neon', warmthK: 'hot' };
    lib.getPref.mockImplementation(async (key: string, fallback: unknown) => (key in saved ? saved[key] : fallback) as never);
    const { result } = renderHook(() => usePrefsSync());
    await waitFor(() => expect(result.current).toBe(true));

    expect(useUi.getState().theme).toBe('night');
    expect(useUi.getState().warmthK).toBe(5000);
  });
});
