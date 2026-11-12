import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import type { RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// The worker ships with the app, so PDFs open with no network.
GlobalWorkerOptions.workerSrc = workerUrl;

/** Character maps, standard fonts and image decoders, copied to /pdfjs at build time. */
const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

export interface PdfHandle {
  numPages: number;
  /** Page size in CSS pixels at the given scale. */
  getPageSize(n: number, scale: number): Promise<{ width: number; height: number }>;
  /** Draws the page at the device's pixel density. */
  renderPage(n: number, canvas: HTMLCanvasElement, scale: number): Promise<void>;
  /** Fills `container` with selectable, invisible text positioned over the page. */
  renderTextLayer(n: number, container: HTMLElement, scale: number): Promise<void>;
  destroy(): void;
}

function isCancelled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'RenderingCancelledException';
}

export async function openPdf(data: ArrayBuffer): Promise<PdfHandle> {
  // pdf.js hands the bytes to its worker, which detaches the buffer; pass a copy.
  const task = getDocument({
    data: new Uint8Array(data.slice(0)),
    cMapUrl: `${ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
    wasmUrl: `${ASSET_BASE}wasm/`,
  });
  const doc = await task.promise;
  const rendering = new WeakMap<HTMLCanvasElement, RenderTask>();

  return {
    numPages: doc.numPages,

    async getPageSize(n, scale) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      return { width: viewport.width, height: viewport.height };
    },

    async renderPage(n, canvas, scale) {
      // A canvas can only take one render at a time.
      rendering.get(canvas)?.cancel();
      const page = await doc.getPage(n);
      const density = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * density });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${viewport.width / density}px`;
      canvas.style.height = `${viewport.height / density}px`;
      const renderTask = page.render({ canvas, viewport });
      rendering.set(canvas, renderTask);
      try {
        await renderTask.promise;
      } catch (error) {
        if (!isCancelled(error)) throw error;
      } finally {
        if (rendering.get(canvas) === renderTask) rendering.delete(canvas);
      }
    },

    async renderTextLayer(n, container, scale) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      container.replaceChildren();
      container.style.setProperty('--total-scale-factor', String(scale));
      container.style.setProperty('--scale-factor', String(scale));
      const layer = new TextLayer({ textContentSource: page.streamTextContent(), container, viewport });
      await layer.render();
    },

    destroy() {
      void task.destroy();
    },
  };
}

/** A small PNG of the first page, for the library list. */
export async function renderFirstPageThumbnail(data: ArrayBuffer, maxWidth = 160): Promise<Blob> {
  const handle = await openPdf(data);
  try {
    const natural = await handle.getPageSize(1, 1);
    const scale = Math.min(1, maxWidth / natural.width);
    const canvas = document.createElement('canvas');
    // Thumbnails do not need the device's full density.
    const density = window.devicePixelRatio || 1;
    await handle.renderPage(1, canvas, scale / density);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the thumbnail.'))), 'image/png');
    });
  } finally {
    handle.destroy();
  }
}
