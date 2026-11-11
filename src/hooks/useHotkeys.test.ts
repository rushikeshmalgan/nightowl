import { renderHook } from '@testing-library/react';
import { matchHotkey, useHotkeys } from './useHotkeys';

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

describe('matchHotkey', () => {
  it('treats mod as Ctrl or Meta', () => {
    expect(matchHotkey(key({ key: 'k', ctrlKey: true }), 'mod+k')).toBe(true);
    expect(matchHotkey(key({ key: 'k', metaKey: true }), 'mod+k')).toBe(true);
  });

  it('rejects the bare key for a mod combo', () => {
    expect(matchHotkey(key({ key: 'k' }), 'mod+k')).toBe(false);
  });

  it('rejects a modified key for a bare-key combo', () => {
    expect(matchHotkey(key({ key: 'f', ctrlKey: true }), 'f')).toBe(false);
    expect(matchHotkey(key({ key: 'f', metaKey: true }), 'f')).toBe(false);
    expect(matchHotkey(key({ key: 'f', altKey: true }), 'f')).toBe(false);
  });

  it('matches bare keys case-insensitively, including named keys', () => {
    expect(matchHotkey(key({ key: 'F' }), 'f')).toBe(true);
    expect(matchHotkey(key({ key: 'ArrowLeft' }), 'ArrowLeft')).toBe(true);
    expect(matchHotkey(key({ key: '\\' }), '\\')).toBe(true);
  });
});

describe('useHotkeys', () => {
  it('runs the handler and prevents the default for an owned combo', () => {
    const bionic = vi.fn();
    renderHook(() => useHotkeys({ 'mod+b': bionic }));
    const event = key({ key: 'b', ctrlKey: true });
    document.body.dispatchEvent(event);
    expect(bionic).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves unmapped keys alone', () => {
    const bionic = vi.fn();
    renderHook(() => useHotkeys({ 'mod+b': bionic }));
    const event = key({ key: 'f', ctrlKey: true });
    document.body.dispatchEvent(event);
    expect(bionic).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ['input', () => document.createElement('input')],
    ['textarea', () => document.createElement('textarea')],
    [
      'contenteditable',
      () => {
        const el = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        return el;
      },
    ],
  ])('does nothing while typing in a %s', (_name, make) => {
    const ruler = vi.fn();
    const palette = vi.fn();
    renderHook(() => useHotkeys({ f: ruler, 'mod+k': palette }));
    const field = make();
    document.body.appendChild(field);
    const plain = key({ key: 'f' });
    const combo = key({ key: 'k', ctrlKey: true });
    field.dispatchEvent(plain);
    field.dispatchEvent(combo);
    expect(ruler).not.toHaveBeenCalled();
    expect(palette).not.toHaveBeenCalled();
    expect(plain.defaultPrevented).toBe(false);
    expect(combo.defaultPrevented).toBe(false);
    field.remove();
  });

  it('uses the latest handlers without re-subscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useHotkeys({ f: fn }), { initialProps: { fn: first } });
    rerender({ fn: second });
    document.body.dispatchEvent(key({ key: 'f' }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops listening after unmount', () => {
    const ruler = vi.fn();
    const { unmount } = renderHook(() => useHotkeys({ f: ruler }));
    unmount();
    document.body.dispatchEvent(key({ key: 'f' }));
    expect(ruler).not.toHaveBeenCalled();
  });
});
