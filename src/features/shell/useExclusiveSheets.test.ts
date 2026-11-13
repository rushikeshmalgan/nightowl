import { act, renderHook } from '@testing-library/react';
import { useExclusiveSheets } from './useExclusiveSheets';
import { useUi } from './ui';

beforeEach(() => {
  act(() => useUi.getState().reset());
});

const open = () => {
  const s = useUi.getState();
  return [s.tuningOpen, s.libraryOpen, s.audioOpen];
};

describe('useExclusiveSheets', () => {
  it('on a phone, opening one sheet closes the others', () => {
    renderHook(() => useExclusiveSheets(true));
    act(() => useUi.getState().set('tuningOpen', true));
    act(() => useUi.getState().set('libraryOpen', true));
    expect(open()).toEqual([false, true, false]);
    act(() => useUi.getState().set('audioOpen', true));
    expect(open()).toEqual([false, false, true]);
  });

  it('on a wide screen, side panels can stay open together', () => {
    renderHook(() => useExclusiveSheets(false));
    act(() => useUi.getState().set('tuningOpen', true));
    act(() => useUi.getState().set('libraryOpen', true));
    expect(open()).toEqual([true, true, false]);
  });

  it('collapses panels that were open together when the window narrows', () => {
    const { rerender } = renderHook(({ narrow }) => useExclusiveSheets(narrow), { initialProps: { narrow: false } });
    act(() => useUi.getState().set('tuningOpen', true));
    act(() => useUi.getState().set('libraryOpen', true));
    rerender({ narrow: true });
    expect(open().filter(Boolean)).toHaveLength(1);
  });

  it('leaves a single open sheet alone', () => {
    renderHook(() => useExclusiveSheets(true));
    act(() => useUi.getState().set('audioOpen', true));
    expect(open()).toEqual([false, false, true]);
  });
});
