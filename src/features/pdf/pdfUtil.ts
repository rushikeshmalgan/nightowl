/** Layout and error helpers for the PDF viewer. Kept free of pdf.js imports so they test in plain Node. */

/** The top offset of each page when pages are stacked with the given heights. */
export function pageOffsets(pageHeights: number[]): number[] {
  const offsets: number[] = [];
  let top = 0;
  for (const height of pageHeights) {
    offsets.push(top);
    top += height;
  }
  return offsets;
}

/**
 * The 1-based numbers of the pages whose box intersects the viewport,
 * widened by `bufferPx` above and below so nearby pages render ahead of time.
 */
export function visiblePages(scrollTop: number, viewportHeight: number, pageHeights: number[], bufferPx: number): number[] {
  const viewTop = scrollTop - bufferPx;
  const viewBottom = scrollTop + viewportHeight + bufferPx;
  const pages: number[] = [];
  let top = 0;
  pageHeights.forEach((height, index) => {
    const bottom = top + height;
    if (top < viewBottom && bottom > viewTop) pages.push(index + 1);
    top = bottom;
  });
  return pages;
}

export interface PageLayout {
  /** The scale the sizes were measured at. */
  scale: number;
  sizes: Array<{ width: number; height: number }>;
}

/**
 * Shrinks a page layout so that, at 100% zoom, its widest page fits `room`
 * pixels; zoom then scales from that fitted size. `baseScale` is the scale of
 * 100% zoom. It never enlarges: when the pages already fit, or the room is
 * unknown, the same layout object comes back, so nothing has to redraw.
 */
export function fitToWidth(measured: PageLayout, room: number, baseScale: number): PageLayout {
  const widest = measured.sizes.reduce((max, size) => Math.max(max, size.width), 0);
  if (widest <= 0 || !Number.isFinite(room) || room <= 0) return measured;
  const widestAtFullZoom = (widest * baseScale) / measured.scale;
  const factor = Math.min(1, room / widestAtFullZoom);
  if (factor >= 1) return measured;
  return {
    scale: measured.scale * factor,
    sizes: measured.sizes.map((size) => ({ width: size.width * factor, height: size.height * factor })),
  };
}

/** The 1-based page that contains the given scroll offset. */
export function pageAtOffset(offset: number, pageHeights: number[]): number {
  let top = 0;
  for (let index = 0; index < pageHeights.length; index++) {
    top += pageHeights[index];
    if (offset < top) return index + 1;
  }
  return Math.max(1, pageHeights.length);
}

export const PDF_PASSWORD_ERROR = 'This PDF is password-protected and cannot be opened.';
export const PDF_INVALID_ERROR = 'This file is not a valid PDF.';
export const PDF_GENERIC_ERROR = 'This PDF could not be opened.';

/** Turns a pdf.js failure into a sentence a reader can act on. */
export function describePdfError(err: unknown): string {
  const name = typeof err === 'object' && err !== null ? (err as { name?: unknown }).name : undefined;
  if (name === 'PasswordException') return PDF_PASSWORD_ERROR;
  if (name === 'InvalidPDFException' || name === 'FormatError') return PDF_INVALID_ERROR;
  return PDF_GENERIC_ERROR;
}
