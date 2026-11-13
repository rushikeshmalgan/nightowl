import type { DocType } from '../../shared/types';

/** Shown beside a disabled control. Phase 5 (PDF reflow) is the place to reword these. */
export const PDF_BIONIC_REASON = 'Bionic reading is not available for PDF pages.';
export const PDF_DYSLEXIC_REASON = 'The dyslexia-friendly font is not available for PDF pages.';

export interface TextStylingBlocks {
  bionic: string | null;
  dyslexic: string | null;
}

/**
 * Which text-styling controls cannot act on the open document, with the reason.
 * A PDF page is a rendered canvas: there is no text to embolden or re-typeset.
 * The reader's saved settings are never touched, so they apply again on a text document.
 */
export function textStylingBlocks(doc: { type: DocType } | null): TextStylingBlocks {
  if (doc?.type === 'pdf') return { bionic: PDF_BIONIC_REASON, dyslexic: PDF_DYSLEXIC_REASON };
  return { bionic: null, dyslexic: null };
}
