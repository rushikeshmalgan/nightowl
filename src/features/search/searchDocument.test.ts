import type { ReflowDoc } from '../pdf/reflowText';
import { pageText } from '../pdf/reflowText';
import { COUNT_CAP, MAX_HITS } from './findMatches';
import { pagesFromReflow, searchDocument } from './searchDocument';
import type { DocumentText } from './searchDocument';

const pages = (texts: string[]): DocumentText => ({ kind: 'pages', pages: texts.map((text, i) => ({ page: i + 1, text })) });

describe('searchDocument', () => {
  it('searches a text document and gives each hit a snippet and an offset', () => {
    const text = 'The owl woke at night.\n\nThe NIGHT was calm.';
    const result = searchDocument({ kind: 'text', text }, 'night');
    expect(result.total).toBe(2);
    expect(result.hits.map((h) => text.slice(h.offset, h.offset + h.length))).toEqual(['night', 'NIGHT']);
    expect(result.hits[0].page).toBeUndefined();
    expect(result.hits[0].snippet).toBe('The owl woke at night. The NIGHT was calm.');
  });

  it('returns hits in page order with the page and an offset inside that page', () => {
    const source = pages(['nothing here', 'a quiet night', 'night and more night']);
    const result = searchDocument(source, 'night');
    expect(result.hits.map((h) => [h.page, h.offset])).toEqual([
      [2, 8],
      [3, 0],
      [3, 15],
    ]);
    expect(result.total).toBe(3);
    expect(result.capped).toBe(false);
  });

  it('stops listing at the limit across pages while still counting every match', () => {
    const source = pages(['ab '.repeat(15), 'ab '.repeat(15)]);
    const result = searchDocument(source, 'ab');
    expect(result.hits).toHaveLength(MAX_HITS);
    expect(result.hits.filter((h) => h.page === 2)).toHaveLength(5);
    expect(result.total).toBe(30);
    expect(searchDocument(source, 'ab', 3).hits).toHaveLength(3);
  });

  it('caps the count over the whole document', () => {
    const source = pages(['ab '.repeat(COUNT_CAP - 10), 'ab '.repeat(100), 'ab ab']);
    const result = searchDocument(source, 'ab');
    expect(result.total).toBe(COUNT_CAP);
    expect(result.capped).toBe(true);
  });

  it('gives no hits for a query that is too short or too long', () => {
    const source = pages(['night night']);
    expect(searchDocument(source, 'n')).toEqual({ hits: [], total: 0, capped: false });
    expect(searchDocument(source, 'n'.repeat(101))).toEqual({ hits: [], total: 0, capped: false });
    expect(searchDocument(source, '   ')).toEqual({ hits: [], total: 0, capped: false });
  });
});

describe('pagesFromReflow', () => {
  it('joins a page the way Reflow shows it and keeps the page numbers', () => {
    const doc: ReflowDoc = {
      hasText: true,
      pages: [
        { page: 1, paragraphs: ['First paragraph.', 'Second paragraph.'] },
        { page: 2, paragraphs: [] },
        { page: 3, paragraphs: ['Last.'] },
      ],
    };
    expect(pagesFromReflow(doc)).toEqual([
      { page: 1, text: 'First paragraph.\n\nSecond paragraph.' },
      { page: 2, text: '' },
      { page: 3, text: 'Last.' },
    ]);
    expect(pagesFromReflow(doc)[0].text).toBe(pageText(doc.pages[0].paragraphs));
  });

  it('finds a phrase that runs across a paragraph break', () => {
    const doc: ReflowDoc = { hasText: true, pages: [{ page: 1, paragraphs: ['ends with night', 'owl starts here'] }] };
    const result = searchDocument({ kind: 'pages', pages: pagesFromReflow(doc) }, 'night owl');
    expect(result.total).toBe(1);
  });
});
