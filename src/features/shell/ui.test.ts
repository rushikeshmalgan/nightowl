import { DEFAULT_SETTINGS, useUi } from './ui';

function settingsOf(state: ReturnType<typeof useUi.getState>) {
  const picked: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    picked[key] = (state as unknown as Record<string, unknown>)[key];
  }
  return picked;
}

describe('ui store', () => {
  beforeEach(() => {
    useUi.getState().reset();
  });

  it('starts with the spec defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      theme: 'night',
      warmthK: 5000,
      brightness: 90,
      contrast: 105,
      fontSize: 18,
      lineHeight: 1.8,
      scrollSpeed: 1,
      speechRate: 1,
      zoom: 100,
      bionic: false,
      focusRuler: false,
      dyslexic: false,
      nightPages: false,
      autoScroll: false,
    });
    expect(settingsOf(useUi.getState())).toEqual(DEFAULT_SETTINGS);
  });

  it('writes the theme to the document element', () => {
    useUi.getState().set('theme', 'sepia');
    expect(useUi.getState().theme).toBe('sepia');
    expect(document.documentElement.dataset.theme).toBe('sepia');
  });

  it('toggles boolean settings and panels', () => {
    useUi.getState().toggle('bionic');
    expect(useUi.getState().bionic).toBe(true);
    useUi.getState().toggle('bionic');
    expect(useUi.getState().bionic).toBe(false);
    useUi.getState().toggle('paletteOpen');
    expect(useUi.getState().paletteOpen).toBe(true);
  });

  it('reset restores the defaults and the theme attribute', () => {
    useUi.getState().set('theme', 'crimson');
    useUi.getState().set('warmthK', 2200);
    useUi.getState().toggle('tuningOpen');
    useUi.getState().reset();
    expect(settingsOf(useUi.getState())).toEqual(DEFAULT_SETTINGS);
    expect(useUi.getState().tuningOpen).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('night');
  });
});
