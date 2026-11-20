import { searchCommands } from './searchCommands';
import type { MatchTarget } from './searchCommands';
import type { DocumentSearch } from './useDocumentSearch';

const search = (overrides: Partial<DocumentSearch> = {}): DocumentSearch => ({
  status: 'ready',
  query: 'night',
  done: 0,
  total: 0,
  hits: [],
  totalHits: 0,
  capped: false,
  ...overrides,
});

const pdfHits = [
  { page: 3, offset: 10, length: 5, snippet: '…a quiet night in the…' },
  { page: 12, offset: 40, length: 5, snippet: 'Night again' },
];
const pdfPages = { type: 'pdf' as const, mode: 'pages' as const, textLength: 0 };
const pdfReflow = { type: 'pdf' as const, mode: 'reflow' as const, textLength: 0 };
const textView = { type: 'text' as const, mode: null, textLength: 1000 };

describe('searchCommands: hits', () => {
  it('turns hits into Find commands in order, with the snippet as the title and the page as the hint', () => {
    const commands = searchCommands(search({ hits: pdfHits, totalHits: 2 }), pdfPages, vi.fn());
    expect(commands.map((c) => [c.group, c.title, c.hint, c.fixed, c.disabled])).toEqual([
      ['Find', '…a quiet night in the…', 'p. 3', true, undefined],
      ['Find', 'Night again', 'p. 12', true, undefined],
    ]);
    expect(new Set(commands.map((c) => c.id)).size).toBe(2);
  });

  it('shows how far into a text document a hit is as a percentage', () => {
    const hits = [
      { offset: 620, length: 5, snippet: 'at sixty two' },
      { offset: 0, length: 5, snippet: 'the start' },
    ];
    const commands = searchCommands(search({ hits, totalHits: 2 }), textView, vi.fn());
    expect(commands.map((c) => c.hint)).toEqual(['62%', '0%']);
  });

  it('does not divide by zero for an empty text', () => {
    const commands = searchCommands(search({ hits: [{ offset: 0, length: 2, snippet: 'ab' }], totalHits: 1 }), { ...textView, textLength: 0 }, vi.fn());
    expect(commands[0].hint).toBe('0%');
  });

  it('jumps to the page for a PDF in Pages', () => {
    const go = vi.fn<(target: MatchTarget) => void>();
    searchCommands(search({ hits: pdfHits, totalHits: 2 }), pdfPages, go)[1].run();
    expect(go).toHaveBeenCalledWith({ kind: 'page', page: 12 });
  });

  it('jumps to the spot in the page for a PDF in Reflow', () => {
    const go = vi.fn<(target: MatchTarget) => void>();
    searchCommands(search({ hits: pdfHits, totalHits: 2 }), pdfReflow, go)[0].run();
    expect(go).toHaveBeenCalledWith({ kind: 'reflow', page: 3, offset: 10, length: 5 });
  });

  it('jumps to the offset for a text file', () => {
    const go = vi.fn<(target: MatchTarget) => void>();
    searchCommands(search({ hits: [{ offset: 620, length: 5, snippet: 'x' }], totalHits: 1 }), textView, go)[0].run();
    expect(go).toHaveBeenCalledWith({ kind: 'text', offset: 620, length: 5 });
  });
});

describe('searchCommands: status rows', () => {
  const only = (s: DocumentSearch, view = pdfPages) => searchCommands(s, view, vi.fn());

  it('says it is preparing, with the pages read so far', () => {
    const [row, ...rest] = only(search({ status: 'preparing', done: 3, total: 12 }));
    expect(rest).toEqual([]);
    expect(row).toMatchObject({ group: 'Find', title: 'Preparing search… 3 of 12 pages', fixed: true, disabled: true });
  });

  it('gives no count while the number of pages is not known yet', () => {
    expect(only(search({ status: 'preparing' }))[0].title).toBe('Preparing search…');
  });

  it('says there are no matches, naming the query', () => {
    const [row] = only(search({ status: 'ready', query: 'moon' }));
    expect(row).toMatchObject({ title: 'No matches for "moon" in this document.', fixed: true, disabled: true });
  });

  it('says when only the first hits are listed, with the exact total', () => {
    const hits = Array.from({ length: 20 }, (_, i) => ({ page: 1, offset: i, length: 2, snippet: `hit ${i}` }));
    const commands = searchCommands(search({ hits, totalHits: 37 }), pdfPages, vi.fn());
    expect(commands).toHaveLength(21);
    expect(commands[20]).toMatchObject({ title: 'Showing the first 20 of 37 matches.', fixed: true, disabled: true });
  });

  it('says "500+" when the count was capped', () => {
    const hits = Array.from({ length: 20 }, (_, i) => ({ page: 1, offset: i, length: 2, snippet: `hit ${i}` }));
    const commands = searchCommands(search({ hits, totalHits: 500, capped: true }), pdfPages, vi.fn());
    expect(commands[20].title).toBe('Showing the first 20 of 500+ matches.');
  });

  it('adds no count row when every match is listed', () => {
    expect(searchCommands(search({ hits: pdfHits, totalHits: 2 }), pdfPages, vi.fn())).toHaveLength(2);
  });

  it('explains a scanned PDF', () => {
    expect(only(search({ status: 'empty' }))[0]).toMatchObject({ title: 'This PDF has no text to search (it looks scanned).', disabled: true });
  });

  it('explains a failed read', () => {
    expect(only(search({ status: 'error' }))[0]).toMatchObject({ title: "Could not read this PDF's text to search it.", disabled: true });
  });

  it('gives nothing when idle or for a document that cannot be searched', () => {
    expect(only(search({ status: 'idle' }))).toEqual([]);
    expect(only(search({ status: 'unsupported' }))).toEqual([]);
  });
});
