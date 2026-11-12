import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref, RefObject } from 'react';
import { openPdf } from '../lib/pdf';
import type { PdfHandle } from '../lib/pdf';
import { describePdfError, pageAtOffset, pageOffsets, visiblePages } from '../lib/pdfUtil';

/** Vertical space between pages, in CSS pixels. */
export const PDF_PAGE_GAP = 16;
/** Space above the first page: the 32px status line plus breathing room. */
const PAD_TOP = 56;
/** 100% zoom shows a US Letter page about 800px wide. */
const BASE_SCALE = 1.3;
const PROGRESS_INTERVAL_MS = 500;

export interface PdfProgress {
  page: number;
  numPages: number;
  scrollTop: number;
}

export interface PdfViewerHandle {
  goToPage(page: number): void;
}

export interface PdfViewerProps {
  data: ArrayBuffer;
  initialPage: number;
  initialScrollTop: number;
  /** Percent; 100 is the default size. */
  zoom: number;
  nightPages: boolean;
  onProgress(progress: PdfProgress): void;
  onError(message: string): void;
  /** Lets the parent drive the scroll container (auto-scroll). */
  scrollRef?: RefObject<HTMLDivElement | null>;
  ref?: Ref<PdfViewerHandle>;
}

interface PageSize {
  width: number;
  height: number;
}

/** A continuous-scroll PDF view that draws only the pages near the viewport. */
export function PdfViewer({ data, initialPage, initialScrollTop, zoom, nightPages, onProgress, onError, scrollRef, ref }: PdfViewerProps) {
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [layout, setLayout] = useState<{ scale: number; sizes: PageSize[] } | null>(null);

  const ownScroller = useRef<HTMLDivElement | null>(null);
  const canvasEls = useRef(new Map<number, HTMLCanvasElement>());
  const textEls = useRef(new Map<number, HTMLDivElement>());
  const renderedAt = useRef(new Map<number, number>());
  const restored = useRef(false);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latest = useRef({ onProgress, onError, initialPage, initialScrollTop });
  latest.current = { onProgress, onError, initialPage, initialScrollTop };

  const scale = (zoom / 100) * BASE_SCALE;

  const setScroller = useCallback(
    (el: HTMLDivElement | null) => {
      ownScroller.current = el;
      if (scrollRef) scrollRef.current = el;
    },
    [scrollRef],
  );

  // Open the document.
  useEffect(() => {
    let cancelled = false;
    let opened: PdfHandle | null = null;
    restored.current = false;
    setHandle(null);
    setLayout(null);
    openPdf(data).then(
      (next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        opened = next;
        setHandle(next);
      },
      (error: unknown) => {
        if (!cancelled) latest.current.onError(describePdfError(error));
      },
    );
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [data]);

  // Measure every page at the current zoom.
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    const numbers = Array.from({ length: handle.numPages }, (_, index) => index + 1);
    Promise.all(numbers.map((n) => handle.getPageSize(n, scale))).then(
      (sizes) => {
        if (cancelled) return;
        renderedAt.current.clear();
        setLayout({ scale, sizes });
      },
      (error: unknown) => {
        if (!cancelled) latest.current.onError(describePdfError(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [handle, scale]);

  /** Draws the pages near the viewport and frees the ones far from it. */
  const renderVisible = useCallback(() => {
    const scroller = ownScroller.current;
    if (!scroller || !handle || !layout) return;
    const stacked = layout.sizes.map((size) => size.height + PDF_PAGE_GAP);
    const viewport = scroller.clientHeight;
    const top = scroller.scrollTop - PAD_TOP;
    const wanted = visiblePages(top, viewport, stacked, viewport);
    const keep = new Set(visiblePages(top, viewport, stacked, viewport * 3));

    for (const n of wanted) {
      if (renderedAt.current.get(n) === layout.scale) continue;
      const canvas = canvasEls.current.get(n);
      const text = textEls.current.get(n);
      if (!canvas || !text) continue;
      renderedAt.current.set(n, layout.scale);
      handle
        .renderPage(n, canvas, layout.scale)
        .then(() => handle.renderTextLayer(n, text, layout.scale))
        .catch(() => {
          // Let the page be tried again the next time it scrolls into view.
          renderedAt.current.delete(n);
        });
    }

    for (const n of [...renderedAt.current.keys()]) {
      if (keep.has(n)) continue;
      const canvas = canvasEls.current.get(n);
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      textEls.current.get(n)?.replaceChildren();
      renderedAt.current.delete(n);
    }
  }, [handle, layout]);

  const currentProgress = useCallback((): PdfProgress | null => {
    const scroller = ownScroller.current;
    if (!scroller || !layout) return null;
    const stacked = layout.sizes.map((size) => size.height + PDF_PAGE_GAP);
    return {
      page: pageAtOffset(Math.max(0, scroller.scrollTop), stacked),
      numPages: layout.sizes.length,
      scrollTop: scroller.scrollTop,
    };
  }, [layout]);

  // Once the pages are laid out: return to the saved place, then draw.
  useEffect(() => {
    const scroller = ownScroller.current;
    if (!scroller || !layout) return;
    if (!restored.current) {
      restored.current = true;
      const { initialScrollTop: savedTop, initialPage: savedPage } = latest.current;
      const offsets = pageOffsets(layout.sizes.map((size) => size.height + PDF_PAGE_GAP));
      if (savedTop > 0) scroller.scrollTop = savedTop;
      else if (savedPage > 1) scroller.scrollTop = offsets[Math.min(savedPage, offsets.length) - 1] ?? 0;
      const progress = currentProgress();
      if (progress) latest.current.onProgress(progress);
    }
    renderVisible();
  }, [layout, renderVisible, currentProgress]);

  useEffect(
    () => () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      goToPage(page: number) {
        const scroller = ownScroller.current;
        if (!scroller || !layout || layout.sizes.length === 0) return;
        const offsets = pageOffsets(layout.sizes.map((size) => size.height + PDF_PAGE_GAP));
        const index = Math.min(Math.max(1, Math.floor(page)), offsets.length) - 1;
        scroller.scrollTop = offsets[index];
      },
    }),
    [layout],
  );

  const onScroll = () => {
    renderVisible();
    if (progressTimer.current) return;
    progressTimer.current = setTimeout(() => {
      progressTimer.current = null;
      const progress = currentProgress();
      if (progress) latest.current.onProgress(progress);
    }, PROGRESS_INTERVAL_MS);
  };

  return (
    <div
      ref={setScroller}
      data-testid="pdf-scroll"
      data-night-pages={nightPages}
      className="h-full overflow-auto pl-12"
      onScroll={onScroll}
    >
      <div
        className="flex min-w-max flex-col items-center px-6"
        style={{ paddingTop: PAD_TOP, paddingBottom: 96, gap: PDF_PAGE_GAP }}
        aria-busy={!layout}
      >
        {!layout ? <p className="text-sm text-muted">Opening PDF…</p> : null}
        {layout?.sizes.map((size, index) => {
          const n = index + 1;
          return (
            <div
              key={n}
              data-testid="pdf-page"
              data-page={n}
              aria-label={`Page ${n}`}
              className="pdf-page relative shrink-0 bg-white"
              style={{ width: `${size.width}px`, height: `${size.height}px` }}
            >
              <canvas
                ref={(canvas) => {
                  if (canvas) canvasEls.current.set(n, canvas);
                  else canvasEls.current.delete(n);
                }}
                className="block"
              />
              <div
                ref={(text) => {
                  if (text) textEls.current.set(n, text);
                  else textEls.current.delete(n);
                }}
                className="textLayer"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
