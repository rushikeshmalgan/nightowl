import { describePdfError, pageAtOffset, pageOffsets, visiblePages } from './pdfUtil';

describe('visiblePages', () => {
  const heights = [100, 100, 100];

  it('returns the pages that intersect the viewport', () => {
    expect(visiblePages(0, 150, heights, 0)).toEqual([1, 2]);
    expect(visiblePages(150, 100, heights, 0)).toEqual([2, 3]);
  });

  it('excludes a page that only touches the viewport edge', () => {
    expect(visiblePages(100, 100, heights, 0)).toEqual([2]);
  });

  it('widens by the buffer on both sides', () => {
    const five = [100, 100, 100, 100, 100];
    expect(visiblePages(200, 100, five, 0)).toEqual([3]);
    expect(visiblePages(200, 100, five, 100)).toEqual([2, 3, 4]);
  });

  it('clamps the buffer to the pages that exist', () => {
    expect(visiblePages(0, 100, heights, 1000)).toEqual([1, 2, 3]);
  });

  it('handles pages of different heights', () => {
    expect(visiblePages(250, 100, [200, 50, 400], 0)).toEqual([3]);
    expect(visiblePages(190, 100, [200, 50, 400], 0)).toEqual([1, 2, 3]);
  });

  it('returns nothing for an empty document', () => {
    expect(visiblePages(0, 500, [], 100)).toEqual([]);
  });
});

describe('pageOffsets and pageAtOffset', () => {
  it('gives the top of each page', () => {
    expect(pageOffsets([200, 50, 400])).toEqual([0, 200, 250]);
  });

  it('finds the page under a scroll position', () => {
    const heights = [200, 50, 400];
    expect(pageAtOffset(0, heights)).toBe(1);
    expect(pageAtOffset(199, heights)).toBe(1);
    expect(pageAtOffset(200, heights)).toBe(2);
    expect(pageAtOffset(250, heights)).toBe(3);
    expect(pageAtOffset(99999, heights)).toBe(3);
  });

  it('is page 1 for an empty document', () => {
    expect(pageAtOffset(50, [])).toBe(1);
  });
});

describe('describePdfError', () => {
  it('explains a password-protected PDF', () => {
    expect(describePdfError({ name: 'PasswordException' })).toBe('This PDF is password-protected and cannot be opened.');
  });

  it('explains a file that is not a PDF', () => {
    expect(describePdfError({ name: 'InvalidPDFException' })).toBe('This file is not a valid PDF.');
    expect(describePdfError({ name: 'FormatError' })).toBe('This file is not a valid PDF.');
  });

  it('falls back to a general message', () => {
    expect(describePdfError(new Error('network'))).toBe('This PDF could not be opened.');
    expect(describePdfError(null)).toBe('This PDF could not be opened.');
    expect(describePdfError('boom')).toBe('This PDF could not be opened.');
  });
});
