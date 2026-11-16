import { myJumpTarget, roomLocalFrom } from './roomLocal';

describe('roomLocalFrom', () => {
  it('shares nothing when no document is open', () => {
    expect(roomLocalFrom(null, null, '')).toEqual({ doc: 'none', fp: '', len: 0, progress: null });
  });

  it('shares a PDF as its page count and my page', () => {
    expect(roomLocalFrom('pdf', { page: 3, numPages: 40 }, 'abcdef0123456789')).toEqual({
      doc: 'pdf',
      fp: 'abcdef0123456789',
      len: 40,
      progress: { page: 3, total: 40 },
    });
  });

  it('keeps a PDF page inside the document', () => {
    expect(roomLocalFrom('pdf', { page: 99, numPages: 40 }, '').progress).toEqual({ page: 40, total: 40 });
    expect(roomLocalFrom('pdf', { page: 0, numPages: 40 }, '').progress).toEqual({ page: 1, total: 40 });
  });

  it('shares a PDF that has not reported its pages yet as having no place', () => {
    expect(roomLocalFrom('pdf', null, 'f')).toEqual({ doc: 'pdf', fp: 'f', len: 0, progress: null });
  });

  it('shares a text file as its length and my exact offset', () => {
    expect(roomLocalFrom('text', { page: 2, numPages: 9, offset: 620, length: 1000 }, 'f')).toEqual({
      doc: 'text',
      fp: 'f',
      len: 1000,
      progress: { offset: 620, length: 1000 },
    });
  });

  it('shares a text file without an exact offset as having no place', () => {
    expect(roomLocalFrom('text', { page: 2, numPages: 9 }, 'f')).toEqual({ doc: 'text', fp: 'f', len: 0, progress: null });
  });

  it('shares a PSD as just its kind', () => {
    expect(roomLocalFrom('psd', { page: 1, numPages: 1 }, 'f')).toEqual({ doc: 'psd', fp: 'f', len: 0, progress: null });
  });
});

describe('myJumpTarget', () => {
  it('is my page in a PDF and my exact spot in a text file', () => {
    expect(myJumpTarget('pdf', { page: 7, numPages: 40 })).toEqual({ kind: 'page', page: 7 });
    expect(myJumpTarget('text', { page: 1, numPages: 3, offset: 410, length: 1000 })).toEqual({ kind: 'offset', offset: 410, length: 1000 });
  });

  it('is nothing when there is no place to come back to', () => {
    expect(myJumpTarget('text', { page: 1, numPages: 3 })).toBeNull();
    expect(myJumpTarget('psd', { page: 1, numPages: 1 })).toBeNull();
    expect(myJumpTarget('pdf', null)).toBeNull();
    expect(myJumpTarget(null, null)).toBeNull();
  });
});
