import { act, renderHook } from '@testing-library/react';
import { useTts } from './useTts';

class FakeUtterance {
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

type Globals = { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown };

describe('useTts', () => {
  const globals = window as unknown as Globals;

  afterEach(() => {
    delete globals.speechSynthesis;
    delete globals.SpeechSynthesisUtterance;
    vi.restoreAllMocks();
  });

  it('reports unsupported and stays quiet when the browser has no speech synthesis', () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    const { result } = renderHook(() => useTts('hello', 1));
    expect(result.current.supported).toBe(false);
    expect(() => act(() => result.current.toggle())).not.toThrow();
    expect(result.current.speaking).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('speaks the text at the given rate, then cancels on the second toggle', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    globals.speechSynthesis = { speak, cancel };
    globals.SpeechSynthesisUtterance = FakeUtterance;

    const { result } = renderHook(() => useTts('read me', 1.25));
    expect(result.current.supported).toBe(true);

    act(() => result.current.toggle());
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.text).toBe('read me');
    expect(utterance.rate).toBe(1.25);
    expect(result.current.speaking).toBe(true);

    act(() => result.current.toggle());
    expect(cancel).toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
  });

  it('resets when the utterance ends', () => {
    const speak = vi.fn();
    globals.speechSynthesis = { speak, cancel: vi.fn() };
    globals.SpeechSynthesisUtterance = FakeUtterance;

    const { result } = renderHook(() => useTts('read me', 1));
    act(() => result.current.toggle());
    const utterance = speak.mock.calls[0][0] as FakeUtterance;
    act(() => utterance.onend?.());
    expect(result.current.speaking).toBe(false);
  });

  it('does not speak empty text', () => {
    const speak = vi.fn();
    globals.speechSynthesis = { speak, cancel: vi.fn() };
    globals.SpeechSynthesisUtterance = FakeUtterance;

    const { result } = renderHook(() => useTts('', 1));
    act(() => result.current.toggle());
    expect(speak).not.toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
  });

  it('cancels speech on unmount', () => {
    const cancel = vi.fn();
    globals.speechSynthesis = { speak: vi.fn(), cancel };
    globals.SpeechSynthesisUtterance = FakeUtterance;

    const { result, unmount } = renderHook(() => useTts('read me', 1));
    act(() => result.current.toggle());
    cancel.mockClear();
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
