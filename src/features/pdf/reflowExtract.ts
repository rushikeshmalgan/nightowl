import { openPdf } from './pdf';
import { buildReflow } from './reflowText';
import type { PdfTextItem, ReflowDoc } from './reflowText';

/**
 * Reads every page's text out of a PDF and assembles it for Reflow mode.
 * Calls `onPage(done, total)` after each page and stops at the next page once
 * `signal` aborts. It opens its own copy of the document, so the page view is
 * never blocked or disturbed.
 */
export async function extractReflow(data: ArrayBuffer, onPage: (done: number, total: number) => void, signal?: AbortSignal): Promise<ReflowDoc> {
  const handle = await openPdf(data);
  try {
    const pages: PdfTextItem[][] = [];
    for (let n = 1; n <= handle.numPages; n++) {
      if (signal?.aborted) throw new DOMException('Reflow was cancelled.', 'AbortError');
      pages.push(await handle.getPageText(n));
      onPage(n, handle.numPages);
    }
    return buildReflow(pages);
  } finally {
    handle.destroy();
  }
}
