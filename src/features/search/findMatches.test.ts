import { COUNT_CAP, MAX_HITS, SNIPPET_RADIUS, findMatches, normaliseQuery, snippetAround } from './findMatches';

/** The matched text of each match, read back out of the original string. */
const found = (text: string, query: string) => findMatches(text, query).matches.map((m) => text.slice(m.offset, m.offset + m.length));

describe('normaliseQuery', () => {
  it('trims and collapses runs of spaces', () => {
    expect(normaliseQuery('  night   owl ')).toBe('night owl');
  });

  it('needs at least two characters', () => {
    expect(normaliseQuery('')).toBeNull();
    expect(normaliseQuery('  a ')).toBeNull();
    expect(normaliseQuery('ab')).toBe('ab');
  });

  it('refuses a query longer than 100 characters', () => {
    expect(normaliseQuery('a'.repeat(100))).toBe('a'.repeat(100));
    expect(normaliseQuery('a'.repeat(101))).toBeNull();
  });
});

describe('findMatches', () => {
  it('ignores case', () => {
    expect(found('Night night NIGHT', 'NiGhT')).toEqual(['Night', 'night', 'NIGHT']);
  });

  it('lets a space in the query match any run of whitespace', () => {
    expect(found('the night\n\nowl and night owl', 'night owl')).toEqual(['night\n\nowl', 'night owl']);
  });

  it('treats characters that mean something in a regular expression literally', () => {
    expect(found('call f(x) now', 'f(x)')).toEqual(['f(x)']);
    expect(found('list [a-z] here', '[a')).toEqual(['[a']);
    expect(found('a.*b and aXXb', 'a.*b')).toEqual(['a.*b']);
    expect(found('digits \\d and 12', '\\d')).toEqual(['\\d']);
    expect(found('c++ and c', 'c++')).toEqual(['c++']);
    expect(found('what? $5 ^ {x} | y', '? $')).toEqual(['? $']);
  });

  it('returns matches in order with offsets into the original text', () => {
    const text = 'one two one two one';
    const { matches, total, capped } = findMatches(text, 'one');
    expect(matches).toEqual([
      { offset: 0, length: 3 },
      { offset: 8, length: 3 },
      { offset: 16, length: 3 },
    ]);
    expect(total).toBe(3);
    expect(capped).toBe(false);
  });

  it('finds nothing in text that does not contain the query, or when the query is blank', () => {
    expect(findMatches('night owl', 'moon')).toEqual({ matches: [], total: 0, capped: false });
    expect(findMatches('night owl', '   ')).toEqual({ matches: [], total: 0, capped: false });
  });

  it('stops listing at the limit but keeps counting', () => {
    const text = 'ab '.repeat(50);
    const result = findMatches(text, 'ab', { limit: 5 });
    expect(result.matches).toHaveLength(5);
    expect(result.total).toBe(50);
    expect(result.capped).toBe(false);
  });

  it('lists at most 20 matches by default', () => {
    const result = findMatches('ab '.repeat(50), 'ab');
    expect(result.matches).toHaveLength(MAX_HITS);
    expect(MAX_HITS).toBe(20);
  });

  it('counts only up to the cap and says so', () => {
    const result = findMatches('ab '.repeat(COUNT_CAP + 100), 'ab');
    expect(result.total).toBe(COUNT_CAP);
    expect(result.capped).toBe(true);
    expect(findMatches('ab '.repeat(COUNT_CAP), 'ab')).toMatchObject({ total: COUNT_CAP, capped: false });
  });

  it('honours a smaller cap, and a cap of zero only reports whether there is any match', () => {
    expect(findMatches('ab ab ab ab', 'ab', { cap: 2 })).toMatchObject({ total: 2, capped: true });
    expect(findMatches('ab ab', 'ab', { cap: 0 })).toMatchObject({ matches: [], total: 0, capped: true });
    expect(findMatches('cd cd', 'ab', { cap: 0 })).toMatchObject({ total: 0, capped: false });
  });

  it('keeps offsets valid UTF-16 positions in Devanagari text and after an emoji', () => {
    const text = 'पढ़ना अच्छा है। 🦉 नमस्ते दुनिया, नमस्ते again';
    const matches = findMatches(text, 'नमस्ते').matches;
    expect(matches).toHaveLength(2);
    for (const m of matches) expect(text.slice(m.offset, m.offset + m.length)).toBe('नमस्ते');
    expect(found('🦉 owl 🦉 Owl', 'owl')).toEqual(['owl', 'Owl']);
  });

  it('is fast on a large text and still lists at most 20', () => {
    const text = 'lorem ipsum dolor sit amet '.repeat(80_000); // about 2 MB
    const started = performance.now();
    const result = findMatches(text, 'or');
    expect(performance.now() - started).toBeLessThan(500);
    expect(result.matches).toHaveLength(MAX_HITS);
    expect(result.capped).toBe(true);
  });
});

describe('snippetAround', () => {
  it('returns short text as it is, with no ellipsis', () => {
    expect(snippetAround('Hello world', 6, 5)).toBe('Hello world');
  });

  it('cuts to about 40 characters either side and marks both cut ends', () => {
    const text = `${'x'.repeat(100)} NEEDLE ${'y'.repeat(100)}`;
    const offset = text.indexOf('NEEDLE');
    const snippet = snippetAround(text, offset, 6);
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet).toContain('NEEDLE');
    expect(snippet.length).toBeLessThanOrEqual(2 * SNIPPET_RADIUS + 6 + 2);
  });

  it('marks only the end that was cut', () => {
    const near = `NEEDLE ${'y'.repeat(100)}`;
    expect(snippetAround(near, 0, 6).startsWith('…')).toBe(false);
    expect(snippetAround(near, 0, 6).endsWith('…')).toBe(true);
    const far = `${'x'.repeat(100)} NEEDLE`;
    expect(snippetAround(far, far.indexOf('NEEDLE'), 6).startsWith('…')).toBe(true);
    expect(snippetAround(far, far.indexOf('NEEDLE'), 6).endsWith('…')).toBe(false);
  });

  it('collapses whitespace, line breaks included', () => {
    expect(snippetAround('first\n\n  needle\t\tlast', 9, 6)).toBe('first needle last');
  });

  it('does not cut an emoji in half', () => {
    const text = `${'🦉'.repeat(60)} needle ${'🦉'.repeat(60)}`;
    const snippet = snippetAround(text, text.indexOf('needle'), 6);
    expect(snippet).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(snippet).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    expect(snippet).toContain('needle');
  });
});
