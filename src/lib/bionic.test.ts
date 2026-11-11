import { bionicSplit } from './bionic';

function graphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
}

describe('bionicSplit', () => {
  it('bolds the first half of a word, rounded up', () => {
    expect(bionicSplit('hello')).toEqual({ head: 'hel', tail: 'lo' });
    expect(bionicSplit('word')).toEqual({ head: 'wo', tail: 'rd' });
  });

  it('handles a single character', () => {
    expect(bionicSplit('a')).toEqual({ head: 'a', tail: '' });
  });

  it('handles an empty string', () => {
    expect(bionicSplit('')).toEqual({ head: '', tail: '' });
  });

  it('never splits a Devanagari character cluster', () => {
    const word = 'नमस्ते';
    const { head, tail } = bionicSplit(word);
    const total = graphemes(word).length;
    expect(head + tail).toBe(word);
    expect(graphemes(head).length).toBe(Math.ceil(total / 2));
    // The head must end on a cluster boundary: re-segmenting the two halves
    // gives the same clusters as segmenting the whole word.
    expect([...graphemes(head), ...graphemes(tail)]).toEqual(graphemes(word));
  });

  it('keeps an emoji with a modifier in one piece', () => {
    const word = '👍🏽ok';
    const { head, tail } = bionicSplit(word);
    expect(head + tail).toBe(word);
    expect(head).toBe('👍🏽o');
  });
});
