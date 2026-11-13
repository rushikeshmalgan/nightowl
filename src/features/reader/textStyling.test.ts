import { PDF_BIONIC_REASON, PDF_DYSLEXIC_REASON, textStylingBlocks } from './textStyling';

describe('textStylingBlocks', () => {
  it('gives a reason for each control when a PDF is open', () => {
    expect(textStylingBlocks({ type: 'pdf' })).toEqual({
      bionic: 'Bionic reading is not available for PDF pages.',
      dyslexic: 'The dyslexia-friendly font is not available for PDF pages.',
    });
    expect(PDF_BIONIC_REASON).toBe('Bionic reading is not available for PDF pages.');
    expect(PDF_DYSLEXIC_REASON).toBe('The dyslexia-friendly font is not available for PDF pages.');
  });

  it('blocks nothing for a text document', () => {
    expect(textStylingBlocks({ type: 'text' })).toEqual({ bionic: null, dyslexic: null });
  });

  it('blocks nothing for a PSD or when nothing is open', () => {
    expect(textStylingBlocks({ type: 'psd' })).toEqual({ bionic: null, dyslexic: null });
    expect(textStylingBlocks(null)).toEqual({ bionic: null, dyslexic: null });
  });
});
