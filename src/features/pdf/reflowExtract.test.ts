import * as pdf from './pdf';
import { extractReflow } from './reflowExtract';
import type { PdfTextItem } from './reflowText';

vi.mock('./pdf', () => ({ openPdf: vi.fn() }));
const openPdf = vi.mocked(pdf.openPdf);

const line = (str: string): PdfTextItem => ({ str, x: 72, y: 700, width: str.length * 5, height: 10, hasEOL: true });

function handle(pages: PdfTextItem[][], failAt?: number) {
  return {
    numPages: pages.length,
    getPageSize: vi.fn(),
    renderPage: vi.fn(),
    renderTextLayer: vi.fn(),
    getPageText: vi.fn(async (n: number) => {
      if (n === failAt) throw new Error('broken page');
      return pages[n - 1];
    }),
    destroy: vi.fn(),
  };
}

const data = new ArrayBuffer(8);

beforeEach(() => vi.clearAllMocks());

describe('extractReflow', () => {
  it('reads every page, reports progress and assembles the text', async () => {
    const h = handle([[line('First page.')], [line('Second page.')]]);
    openPdf.mockResolvedValue(h);
    const progress: Array<[number, number]> = [];
    const doc = await extractReflow(data, (done, total) => progress.push([done, total]));
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(doc.pages.map((p) => p.paragraphs)).toEqual([['First page.'], ['Second page.']]);
    expect(h.destroy).toHaveBeenCalled();
  });

  it('stops reading pages once cancelled', async () => {
    const h = handle([[line('One.')], [line('Two.')], [line('Three.')]]);
    openPdf.mockResolvedValue(h);
    const controller = new AbortController();
    const run = extractReflow(data, (done) => {
      if (done === 1) controller.abort();
    }, controller.signal);
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.getPageText).toHaveBeenCalledTimes(1);
    expect(h.destroy).toHaveBeenCalled();
  });

  it('releases the document when a page fails', async () => {
    const h = handle([[line('One.')], [line('Two.')]], 2);
    openPdf.mockResolvedValue(h);
    await expect(extractReflow(data, () => {})).rejects.toThrow('broken page');
    expect(h.destroy).toHaveBeenCalled();
  });
});
