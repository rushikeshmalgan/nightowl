const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Splits a word for bionic reading: the first half (rounded up) is the head
 * to embolden. Counts grapheme clusters, not code units, so Devanagari
 * conjuncts, combining marks and emoji sequences are never cut in two.
 */
export function bionicSplit(word: string): { head: string; tail: string } {
  if (word === '') return { head: '', tail: '' };
  const clusters = Array.from(segmenter.segment(word), (part) => part.segment);
  const mid = Math.ceil(clusters.length / 2);
  return { head: clusters.slice(0, mid).join(''), tail: clusters.slice(mid).join('') };
}
