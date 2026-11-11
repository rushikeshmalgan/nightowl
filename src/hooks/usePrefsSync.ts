import { useEffect, useState } from 'react';
import { getPref, setPref } from '../lib/prefs';
import { KELVIN_MAX, KELVIN_MIN } from '../lib/warmth';
import { DEFAULT_SETTINGS, useUi } from '../store/ui';
import type { UiSettings } from '../store/ui';

const THEMES = ['night', 'sepia', 'oled', 'crimson'];

const inRange = (min: number, max: number) => (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** The settings that survive a reload, each with a check for the saved value. */
const PERSISTED: { [K in keyof UiSettings]?: (value: unknown) => boolean } = {
  theme: (value) => typeof value === 'string' && THEMES.includes(value),
  warmthK: inRange(KELVIN_MIN, KELVIN_MAX),
  brightness: inRange(30, 120),
  contrast: inRange(70, 150),
  fontSize: inRange(12, 32),
  lineHeight: inRange(1.2, 2.5),
};

const KEYS = Object.keys(PERSISTED) as Array<keyof UiSettings>;

/**
 * Loads saved reading settings into the UI store, then writes later changes
 * back. Returns true once the saved values have been applied.
 */
export function usePrefsSync(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    void (async () => {
      const saved = await Promise.all(KEYS.map((key) => getPref<unknown>(key, DEFAULT_SETTINGS[key])));
      if (cancelled) return;

      const { set } = useUi.getState();
      KEYS.forEach((key, index) => {
        const value = saved[index];
        if (PERSISTED[key]?.(value) && value !== useUi.getState()[key]) {
          set(key, value as never);
        }
      });

      // Subscribe only after hydration so loading does not echo back as writes.
      unsubscribe = useUi.subscribe((state, previous) => {
        for (const key of KEYS) {
          if (state[key] !== previous[key]) void setPref(key, state[key]);
        }
      });
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return hydrated;
}
