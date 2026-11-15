import { PDF_BIONIC_REASON, PDF_DYSLEXIC_REASON, PDF_NO_TEXT_BIONIC_REASON, PDF_NO_TEXT_DYSLEXIC_REASON, textStylingBlocks } from './textStyling';

describe('textStylingBlocks', () => {
  it('points a PDF in Pages at Reflow, where the controls work', () => {
    const blocks = textStylingBlocks({ type: 'pdf' }, { mode: 'pages', reflowAvailable: true });
    expect(blocks).toEqual({ bionic: PDF_BIONIC_REASON, dyslexic: PDF_DYSLEXIC_REASON });
    expect(PDF_BIONIC_REASON).toBe('Bionic reading works in Reflow mode. Switch this PDF to Reflow to use it.');
    expect(PDF_DYSLEXIC_REASON).toBe('The dyslexia-friendly font works in Reflow mode. Switch this PDF to Reflow to use it.');
  });

  it('treats a PDF whose view is not known yet as being in Pages', () => {
    expect(textStylingBlocks({ type: 'pdf' }).bionic).toBe(PDF_BIONIC_REASON);
    expect(textStylingBlocks({ type: 'pdf' }, null).dyslexic).toBe(PDF_DYSLEXIC_REASON);
  });

  it('says so plainly when the PDF has no text to reflow, instead of pointing at Reflow', () => {
    const blocks = textStylingBlocks({ type: 'pdf' }, { mode: 'pages', reflowAvailable: false });
    expect(blocks).toEqual({ bionic: PDF_NO_TEXT_BIONIC_REASON, dyslexic: PDF_NO_TEXT_DYSLEXIC_REASON });
    expect(PDF_NO_TEXT_BIONIC_REASON).not.toContain('Switch');
  });

  it('blocks nothing for a PDF in Reflow', () => {
    expect(textStylingBlocks({ type: 'pdf' }, { mode: 'reflow', reflowAvailable: true })).toEqual({ bionic: null, dyslexic: null });
  });

  it('blocks nothing for a text document', () => {
    expect(textStylingBlocks({ type: 'text' })).toEqual({ bionic: null, dyslexic: null });
  });

  it('blocks nothing for a PSD or when nothing is open', () => {
    expect(textStylingBlocks({ type: 'psd' })).toEqual({ bionic: null, dyslexic: null });
    expect(textStylingBlocks(null)).toEqual({ bionic: null, dyslexic: null });
  });
});
