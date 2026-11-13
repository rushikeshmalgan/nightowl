import { X } from 'lucide-react';
import { useRef } from 'react';

/** How far down a swipe must travel to dismiss a sheet. */
export const SWIPE_CLOSE_PX = 60;

/**
 * The top of a bottom sheet on a phone: a grab bar to swipe down, and a close
 * button for anyone who does not swipe. Hidden from `sm` (640px) up, where
 * panels are side drawers.
 */
export function SheetHandle({ onClose }: { onClose(): void }) {
  const startY = useRef<number | null>(null);

  return (
    <div data-testid="sheet-header" className="flex shrink-0 items-center border-b border-line sm:hidden">
      <div
        data-testid="sheet-handle"
        className="flex h-11 flex-1 cursor-grab items-center justify-center"
        // The grab bar alone opts out of scrolling, so the sheet's content still scrolls.
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          startY.current = event.clientY;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={(event) => {
          const start = startY.current;
          startY.current = null;
          if (start !== null && event.clientY - start >= SWIPE_CLOSE_PX) onClose();
        }}
        onPointerCancel={() => {
          startY.current = null;
        }}
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-line" />
      </div>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="motion-color flex h-11 w-11 shrink-0 items-center justify-center text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
