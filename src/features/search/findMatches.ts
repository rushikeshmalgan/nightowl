/** Finding a typed phrase in text. Pure, so it tests in plain Node. */

export const MIN_QUERY_CHARS = 2;
export const MAX_QUERY_CHARS = 100;
/** How many matches are listed. */
export const MAX_HITS = 20;
/** How far the count goes before it is reported as "500+". */
export const COUNT_CAP = 500;
/** Characters of context kept on each side of a match in a snippet. */
export const SNIPPET_RADIUS = 40;

export interface Match {
  /** UTF-16 offset of the match in the text that was searched. */
  offset: number;
  length: number;
}

export interface MatchList {
  /** The first `limit` matches, in text order. */
  matches: Match[];
  /** How many matches there are, counted no further than the cap. */
  total: number;
  /** True when there are more matches than the cap. */
  capped: boolean;
}

/** The query as it will be searched: trimmed, spaces collapsed; null when it is too short or too long to search. */
export function normaliseQuery(raw: string): string | null {
  const query = raw.trim().replace(/\s+/g, ' ');
  return query.length >= MIN_QUERY_CHARS && query.length <= MAX_QUERY_CHARS ? query : null;
}

const REGEX_SYNTAX = /[.*+?^${}()|[\]\\]/g;

/** A pattern for the query: every character literal, and a run of spaces matching any whitespace (a line break included). */
function patternFor(query: string): RegExp | null {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return new RegExp(words.map((word) => word.replace(REGEX_SYNTAX, '\\$&')).join('\\s+'), 'giu');
}

/**
 * Case-insensitive, literal matches of `query` in `text`. Lists the first `limit`, counts up to `cap`
 * and stops scanning as soon as one more than the cap is found, so a huge text with a common query stays fast.
 */
export function findMatches(text: string, query: string, options: { limit?: number; cap?: number } = {}): MatchList {
  const { limit = MAX_HITS, cap = COUNT_CAP } = options;
  const pattern = patternFor(query);
  const matches: Match[] = [];
  if (!pattern) return { matches, total: 0, capped: false };
  let count = 0;
  for (let found = pattern.exec(text); found; found = pattern.exec(text)) {
    count += 1;
    if (count > cap) return { matches, total: cap, capped: true };
    if (matches.length < limit) matches.push({ offset: found.index, length: found[0].length });
  }
  return { matches, total: count, capped: false };
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** The match with about `radius` characters of context each side, whitespace collapsed, "…" where text was cut off. */
export function snippetAround(text: string, offset: number, length: number, radius = SNIPPET_RADIUS): string {
  let start = Math.max(0, offset - radius);
  let end = Math.min(text.length, offset + length + radius);
  if (start > 0 && isLowSurrogate(text.charCodeAt(start))) start += 1;
  if (end < text.length && isHighSurrogate(text.charCodeAt(end - 1))) end -= 1;
  // Do not cut a word in half: pull a cut end in to the nearest space, when there is one before the match.
  if (start > 0 && !/\s/.test(text[start - 1]) && !/\s/.test(text[start])) {
    const gap = text.slice(start, offset).search(/\s/);
    if (gap >= 0) start += gap + 1;
  }
  if (end < text.length && !/\s/.test(text[end - 1]) && !/\s/.test(text[end])) {
    const gap = text.slice(offset + length, end).search(/\s\S*$/);
    if (gap >= 0) end = offset + length + gap;
  }
  const clean = (part: string) => part.replace(/\s+/g, ' ');
  const cutBefore = text.slice(0, start).trim() !== '';
  const cutAfter = text.slice(end).trim() !== '';
  return `${cutBefore ? '…' : ''}${clean(text.slice(start, end)).trim()}${cutAfter ? '…' : ''}`;
}
