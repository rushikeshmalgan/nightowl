const BAND_HEIGHT = 60;

/**
 * Dims everything except a 60px reading band centred on `y` (pixels from the
 * top of the reader viewport). Purely visual: it never intercepts the pointer.
 */
export function FocusRuler({ y }: { y: number }) {
  const bandTop = Math.max(0, y - BAND_HEIGHT / 2);
  return (
    <div data-testid="focus-ruler" className="absolute inset-0 z-30" style={{ pointerEvents: 'none' }}>
      <div
        data-testid="focus-ruler-above"
        className="absolute inset-x-0 top-0 bg-black/60"
        style={{ height: `${bandTop}px` }}
      />
      <div
        data-testid="focus-ruler-band"
        className="absolute inset-x-0 border-y border-accent/30"
        style={{ top: `${bandTop}px`, height: `${BAND_HEIGHT}px` }}
      />
      <div
        data-testid="focus-ruler-below"
        className="absolute inset-x-0 bottom-0 bg-black/60"
        style={{ top: `${bandTop + BAND_HEIGHT}px` }}
      />
    </div>
  );
}
