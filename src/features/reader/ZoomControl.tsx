import { Minus, Plus } from 'lucide-react';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../shell/ui';

const clamp = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

const step =
  'motion-color flex h-11 w-11 items-center justify-center text-ink outline-none hover:bg-active focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 sm:h-8 sm:w-8';

/**
 * A small pill floating over the reading area, so zoom never needs a settings
 * panel. Tap the percentage to go back to 100%. Buttons are 44px on a phone.
 */
export function ZoomControl({ zoom, onChange }: { zoom: number; onChange(zoom: number): void }) {
  return (
    <div
      role="group"
      aria-label="Zoom"
      className="absolute bottom-16 right-3 flex items-center overflow-hidden rounded-md border border-line bg-surface"
    >
      <button type="button" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => onChange(clamp(zoom - ZOOM_STEP))} className={step}>
        <Minus size={14} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={`Reset zoom, now ${zoom}%`}
        onClick={() => onChange(100)}
        className="motion-color h-11 min-w-12 border-x border-line px-2 font-mono text-[11px] tabular-nums text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent sm:h-8"
      >
        {zoom}%
      </button>
      <button type="button" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => onChange(clamp(zoom + ZOOM_STEP))} className={step}>
        <Plus size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
