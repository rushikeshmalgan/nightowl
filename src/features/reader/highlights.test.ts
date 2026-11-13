import { mergeRanges, offsetsFromRange, segmentText } from './highlights';

describe('mergeRanges', () => {
  it('merges overlapping and touching ranges', () => {
    expect(
      mergeRanges([
        { start: 5, end: 10 },
        { start: 8, end: 12 },
        { start: 12, end: 15 },
      ]),
    ).toEqual([{ start: 5, end: 15 }]);
  });

  it('sorts and keeps separate ranges apart', () => {
    expect(
      mergeRanges([
        { start: 20, end: 25 },
        { start: 1, end: 3 },
      ]),
    ).toEqual([
      { start: 1, end: 3 },
      { start: 20, end: 25 },
    ]);
  });

  it('drops empty and inverted ranges', () => {
    expect(
      mergeRanges([
        { start: 4, end: 4 },
        { start: 9, end: 2 },
      ]),
    ).toEqual([]);
  });
});

describe('segmentText', () => {
  const join = (segments: ReturnType<typeof segmentText>) => segments.map((s) => s.text).join('');

  it('returns one plain segment when nothing is highlighted', () => {
    expect(segmentText('abcdef', [])).toEqual([{ text: 'abcdef', start: 0, highlighted: false }]);
  });

  it('splits around a highlight and covers the text exactly once', () => {
    const segments = segmentText('abcdef', [{ start: 1, end: 3 }]);
    expect(segments).toEqual([
      { text: 'a', start: 0, highlighted: false },
      { text: 'bc', start: 1, highlighted: true },
      { text: 'def', start: 3, highlighted: false },
    ]);
    expect(join(segments)).toBe('abcdef');
  });

  it('does not duplicate text for overlapping highlights', () => {
    const segments = segmentText('the quick brown fox', [
      { start: 4, end: 9 },
      { start: 6, end: 15 },
    ]);
    expect(join(segments)).toBe('the quick brown fox');
    expect(segments.filter((s) => s.highlighted).map((s) => s.text)).toEqual(['quick brown']);
  });

  it('clamps ranges that run past the text', () => {
    const segments = segmentText('abc', [{ start: 1, end: 99 }]);
    expect(join(segments)).toBe('abc');
    expect(segments[segments.length - 1]).toEqual({ text: 'bc', start: 1, highlighted: true });
  });

  it('handles highlights at both edges', () => {
    const segments = segmentText('abcdef', [
      { start: 0, end: 2 },
      { start: 4, end: 6 },
    ]);
    expect(segments.map((s) => [s.text, s.highlighted])).toEqual([
      ['ab', true],
      ['cd', false],
      ['ef', true],
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(segmentText('', [{ start: 0, end: 5 }])).toEqual([]);
  });
});

describe('offsetsFromRange', () => {
  function build(html: string): HTMLElement {
    const root = document.createElement('article');
    root.innerHTML = html;
    document.body.appendChild(root);
    return root;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('adds the offset inside a segment to that segment start', () => {
    const root = build('<span data-start="0">0123456789</span><span data-start="10">abcdefgh</span>');
    const text = root.children[1].firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 2);
    range.setEnd(text, 5);
    expect(offsetsFromRange(range)).toEqual({ start: 12, end: 15 });
  });

  it('spans segments', () => {
    const root = build('<span data-start="0">0123456789</span><mark data-start="10">abcdefgh</mark>');
    const range = document.createRange();
    range.setStart(root.children[0].firstChild as Text, 7);
    range.setEnd(root.children[1].firstChild as Text, 3);
    expect(offsetsFromRange(range)).toEqual({ start: 7, end: 13 });
  });

  it('counts text in earlier nodes of the same segment (bionic markup)', () => {
    const root = build('<span data-start="20"><strong>hel</strong>lo <strong>wor</strong>ld</span>');
    const tail = root.querySelectorAll('strong')[1].nextSibling as Text; // "ld"
    const range = document.createRange();
    range.setStart(root.querySelector('strong')?.firstChild as Text, 1);
    range.setEnd(tail, 1);
    // "h|el" starts at 21; "hello wor" is 9 chars, plus 1 into "ld" = 30.
    expect(offsetsFromRange(range)).toEqual({ start: 21, end: 30 });
  });

  it('handles a boundary placed between segments', () => {
    const root = build('<span data-start="0">01234</span><span data-start="5">56789</span>');
    const range = document.createRange();
    range.setStart(root, 1);
    range.setEnd(root, 2);
    expect(offsetsFromRange(range)).toEqual({ start: 5, end: 10 });
  });

  it('returns null outside any segment', () => {
    const outside = document.createElement('p');
    outside.textContent = 'elsewhere';
    document.body.appendChild(outside);
    const range = document.createRange();
    range.setStart(outside.firstChild as Text, 1);
    range.setEnd(outside.firstChild as Text, 4);
    expect(offsetsFromRange(range)).toBeNull();
  });
});
