import type { ThemeId } from '../../shared/types';

export const KELVIN_MIN = 2200;
export const KELVIN_MAX = 6500;
export const KELVIN_DEFAULT = 5000;

const MAX_OVERLAY_OPACITY = 0.35;

/** Maps a colour temperature to the opacity of the warm multiply overlay. */
export function kelvinToOverlayOpacity(k: number): number {
  const clamped = Math.min(KELVIN_MAX, Math.max(KELVIN_MIN, k));
  return ((KELVIN_MAX - clamped) / (KELVIN_MAX - KELVIN_MIN)) * MAX_OVERLAY_OPACITY;
}

export function overlayColor(theme: ThemeId): string {
  return theme === 'crimson' ? '#ff0000' : '#ff9300';
}
