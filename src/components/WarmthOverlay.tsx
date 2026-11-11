import { kelvinToOverlayOpacity, overlayColor } from '../lib/warmth';
import { useUi } from '../store/ui';

/** A full-screen multiply tint that removes blue light. Sits above everything. */
export function WarmthOverlay() {
  const warmthK = useUi((s) => s.warmthK);
  const theme = useUi((s) => s.theme);
  return (
    <div
      data-testid="warmth-overlay"
      aria-hidden="true"
      className="motion-fade fixed inset-0 z-[90]"
      style={{
        backgroundColor: overlayColor(theme),
        opacity: kelvinToOverlayOpacity(warmthK),
        mixBlendMode: 'multiply',
        pointerEvents: 'none',
      }}
    />
  );
}
