import type { DocType, PdfMode } from '../../shared/types';

/** Shown beside a disabled control while a PDF is in Pages: the controls work in Reflow. */
export const PDF_BIONIC_REASON = 'Bionic reading works in Reflow mode. Switch this PDF to Reflow to use it.';
export const PDF_DYSLEXIC_REASON = 'The dyslexia-friendly font works in Reflow mode. Switch this PDF to Reflow to use it.';
/** Shown instead when the PDF has no text to reflow (a scan), so there is nothing to switch to. */
export const PDF_NO_TEXT_BIONIC_REASON = 'Bionic reading needs text, and this PDF has none (it looks scanned).';
export const PDF_NO_TEXT_DYSLEXIC_REASON = 'The dyslexia-friendly font needs text, and this PDF has none (it looks scanned).';

export interface TextStylingBlocks {
  bionic: string | null;
  dyslexic: string | null;
}

/** How the open PDF is being shown, and whether it has text to reflow. */
export interface PdfViewState {
  mode: PdfMode;
  reflowAvailable: boolean;
}

/**
 * Which text-styling controls cannot act on the open document, with the reason.
 * A PDF page is a rendered canvas, so they are blocked in Pages and work in Reflow.
 * The reader's saved settings are never touched, so they apply again wherever they work.
 */
export function textStylingBlocks(doc: { type: DocType } | null, view?: PdfViewState | null): TextStylingBlocks {
  if (doc?.type !== 'pdf' || view?.mode === 'reflow') return { bionic: null, dyslexic: null };
  if (view && !view.reflowAvailable) return { bionic: PDF_NO_TEXT_BIONIC_REASON, dyslexic: PDF_NO_TEXT_DYSLEXIC_REASON };
  return { bionic: PDF_BIONIC_REASON, dyslexic: PDF_DYSLEXIC_REASON };
}
