import type { ReactNode } from 'react';

/**
 * The layer that holds every piece of interface chrome (rail, status line,
 * panels, dock). It fades to nothing when the reader is idle.
 *
 * The layer itself never takes pointer events, so the document underneath
 * stays scrollable and selectable; its direct children take them only while
 * the chrome is visible.
 */
export function Chrome({ idle, children }: { idle: boolean; children: ReactNode }) {
  return (
    <div
      data-testid="chrome"
      data-idle={idle}
      aria-hidden={idle ? 'true' : undefined}
      className={`motion-fade fixed inset-0 z-40 ${idle ? '' : '[&>*]:pointer-events-auto'}`}
      style={{ opacity: idle ? 0 : 1, pointerEvents: 'none' }}
    >
      {children}
    </div>
  );
}
