import { assemblePage, buildReflow } from './reflowText';
import type { PdfTextItem } from './reflowText';

/** A text item on baseline `y` (PDF coordinates: y grows upward). */
function item(str: string, x: number, y: number, extra: Partial<PdfTextItem> = {}): PdfTextItem {
  return { str, x, y, width: str.length * 5, height: 10, hasEOL: false, ...extra };
}

/** One line per string, 14pt apart, starting at y=700. */
function lines(texts: string[], startY = 700, step = 14, height = 10): PdfTextItem[] {
  return texts.map((text, index) => item(text, 72, startY - index * step, { height, hasEOL: true, width: text.length * 5 }));
}

describe('assemblePage', () => {
  it('joins pieces on one baseline, adding a space only across a visible gap', () => {
    const page = [item('Hel', 72, 700, { width: 15 }), item('lo', 87, 700, { width: 10 }), item('world', 102, 700, { width: 25, hasEOL: true })];
    expect(assemblePage(page)).toEqual(['Hello world']);
  });

  it('starts a new line when the baseline moves, even without an end-of-line mark', () => {
    const page = [item('First line', 72, 700), item('second line', 72, 686)];
    expect(assemblePage(page)).toEqual(['First line second line']);
  });

  it('ends a line at an empty end-of-line item, as pdf.js emits them', () => {
    const page = [item('One', 72, 700), item('', 97, 700, { width: 0, hasEOL: true }), item('two', 72, 686, { hasEOL: true })];
    expect(assemblePage(page)).toEqual(['One two']);
  });

  it('splits paragraphs at a gap clearly larger than the line spacing', () => {
    const page = [...lines(['A first paragraph', 'that wraps here.']), ...lines(['A second one.'], 700 - 14 - 32)];
    expect(assemblePage(page)).toEqual(['A first paragraph that wraps here.', 'A second one.']);
  });

  it('joins a word hyphenated across lines, but keeps a hyphen before a capital', () => {
    expect(assemblePage(lines(['Pattern recog-', 'nition is hard.']))).toEqual(['Pattern recognition is hard.']);
    expect(assemblePage(lines(['The Anglo-', 'Saxon era.']))).toEqual(['The Anglo-Saxon era.']);
  });

  it('keeps a heading in a bigger font apart from the body under it', () => {
    const page = [...lines(['Chapter One'], 700, 14, 18), ...lines(['It was late.', 'The lamp hummed.'], 682)];
    expect(assemblePage(page)).toEqual(['Chapter One', 'It was late. The lamp hummed.']);
  });

  it('collapses runs of whitespace and drops blank lines', () => {
    const page = [item('  spaced    out  ', 72, 700, { hasEOL: true }), item('   ', 72, 686, { hasEOL: true })];
    expect(assemblePage(page)).toEqual(['spaced out']);
  });
});

describe('buildReflow', () => {
  const page = (n: number, body: string[]) => [...lines(['Annual Report 2026'], 760), ...lines(body, 700), ...lines([`Page ${n} of 3`], 60)];

  it('numbers pages and drops a header and page numbers repeated on most pages', () => {
    const doc = buildReflow([page(1, ['Revenue grew.']), page(2, ['Costs fell.']), page(3, ['Outlook is calm.'])]);
    expect(doc.pages).toEqual([
      { page: 1, paragraphs: ['Revenue grew.'] },
      { page: 2, paragraphs: ['Costs fell.'] },
      { page: 3, paragraphs: ['Outlook is calm.'] },
    ]);
    expect(doc.hasText).toBe(true);
  });

  // Browsers (Chromium's print-to-PDF) draw the running header and footer AFTER the body; word processors draw them first.
  // Each page has its own sentence: lines that differ only by a digit would count as repeated, as a page number does.
  const BODIES = ['Revenue grew steadily.', 'Costs fell again.', 'Outlook is calm.', 'Margins held firm.'];
  const browserOrder = (n: number, body: string[]) => [...lines(body, 700), ...lines(['Annual Report 2026'], 760), ...lines([`Page ${n} of 4`], 40)];

  it('drops a running header and footer even when they are drawn after the body', () => {
    const doc = buildReflow([1, 2, 3, 4].map((n) => browserOrder(n, [BODIES[n - 1]])));
    expect(doc.pages.map((p) => p.paragraphs)).toEqual(BODIES.map((body) => [body]));
  });

  it('finds a header drawn in the middle of the stream by where it sits on the page', () => {
    const page = (n: number) => [...lines(['First body line.', 'Second body line.'], 700), ...lines(['Annual Report 2026'], 760), ...lines([`Body tail ${n}.`], 650)];
    const doc = buildReflow([1, 2, 3].map(page));
    for (const p of doc.pages) expect(p.paragraphs.join(' ')).not.toContain('Annual Report 2026');
  });

  it('drops a two-line header and a footer with its page number', () => {
    const page = (n: number) => [
      ...lines([BODIES[n - 1]], 700),
      ...lines(['Annual Report 2026'], 770),
      ...lines(['Confidential draft'], 758),
      ...lines(['Acme Corp'], 50),
      ...lines([`Page ${n} of 3`], 38),
    ];
    const doc = buildReflow([1, 2, 3].map(page));
    expect(doc.pages.map((p) => p.paragraphs)).toEqual(BODIES.slice(0, 3).map((body) => [body]));
  });

  it('keeps a line that repeats on every page but sits in the middle of the text', () => {
    const page = (n: number) => [...lines(['Body 1.', 'Body 2.', 'Body 3.', 'Body 4.', 'Continued', 'Body 6.', 'Body 7.', 'Body 8.', `Tail ${n}.`], 700, 20)];
    const doc = buildReflow([1, 2, 3].map(page));
    for (const p of doc.pages) expect(p.paragraphs.join(' ')).toContain('Continued');
  });

  it('drops a header repeated on both pages of a two-page document', () => {
    const page = (n: number) => [...lines([BODIES[n - 1]], 700), ...lines(['Annual Report 2026'], 760)];
    const doc = buildReflow([1, 2].map(page));
    expect(doc.pages.map((p) => p.paragraphs)).toEqual([[BODIES[0]], [BODIES[1]]]);
  });

  it('drops a bare page number even in a short document', () => {
    const doc = buildReflow([[...lines(['Only page text.']), ...lines(['7'], 60)]]);
    expect(doc.pages[0].paragraphs).toEqual(['Only page text.']);
  });

  it('keeps a first line that is not repeated', () => {
    const doc = buildReflow([lines(['Introduction', 'Body one.'], 700, 30), lines(['Methods', 'Body two.'], 700, 30), lines(['Results', 'Body three.'], 700, 30)]);
    expect(doc.pages.map((p) => p.paragraphs[0])).toEqual(['Introduction Body one.', 'Methods Body two.', 'Results Body three.']);
  });

  it('reports no text for an image-only (scanned) PDF, keeping the page count', () => {
    const doc = buildReflow([[], [], []]);
    expect(doc.hasText).toBe(false);
    expect(doc.pages).toHaveLength(3);
  });
});
