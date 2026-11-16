import type { ReactNode, WheelEvent } from 'react';

/** The reader's scroll element, text or PDF. Both are present only while a document is open. */
const READER_SCROLL = '[data-testid="reader-scroll"], [data-testid="pdf-scroll"]';

/**
 * True when some element between `target` and `boundary` can still scroll in
 * the wheel's direction, so the wheel should scroll that element rather than the reader.
 */
function canScrollWithin(target: Element | null, boundary: Element, deltaY: number): boolean {
  for (let el: Element | null = target; el && el !== boundary; el = el.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
    if (el.scrollHeight <= el.clientHeight) continue;
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
  }
  return false;
}

/**
 * The layer that holds every piece of interface chrome (rail, status line,
 * panels, dock). It fades to nothing when the reader is idle.
 *
 * The layer itself never takes pointer events, so the document underneath
 * stays scrollable and selectable; its direct children take them only while
 * the chrome is visible.
 *
 * The panels cover part of the reader, so a wheel over a panel that cannot
 * scroll (or over the status line and rail) scrolls the reader instead.
 */
export function Chrome({ idle, children }: { idle: boolean; children: ReactNode }) {
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (idle || event.deltaY === 0) return;
    const reader = document.querySelector<HTMLElement>(READER_SCROLL);
    if (!reader) return;
    const target = event.target instanceof Element ? event.target : null;
    if (canScrollWithin(target, event.currentTarget, event.deltaY)) return;
    // deltaMode: 0 = pixels, 1 = lines, 2 = pages.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? reader.clientHeight : 1;
    reader.scrollTop += event.deltaY * unit;
  };

  return (
    <div
      data-testid="chrome"
      data-idle={idle}
      aria-hidden={idle ? 'true' : undefined}
      onWheel={onWheel}
      className={`motion-fade fixed inset-0 z-40 ${idle ? '' : '[&>*]:pointer-events-auto'}`}
      style={{ opacity: idle ? 0 : 1, pointerEvents: 'none' }}
    >
      {children}
    </div>
  );
}
