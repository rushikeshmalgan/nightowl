import { pageText } from '../pdf/reflowText';
import type { ReflowDoc } from '../pdf/reflowText';
import { COUNT_CAP, MAX_HITS, findMatches, normaliseQuery, snippetAround } from './findMatches';

export interface PageText {
  page: number;
  text: string;
}

/** What is searched: a text file's text, or a PDF's text page by page (the extraction Reflow uses). */
export type DocumentText = { kind: 'text'; text: string } | { kind: 'pages'; pages: PageText[] };

export interface SearchHit {
  /** The PDF page; absent for a text document. */
  page?: number;
  /** Offset of the match in the page's text (the whole text for a text document). */
  offset: number;
  length: number;
  snippet: string;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Matches counted, no further than the cap. */
  total: number;
  /** True when there are more matches than were counted. */
  capped: boolean;
}

const NONE: SearchResult = { hits: [], total: 0, capped: false };

/** The text of every page as Reflow renders it, so a match offset is a position in what is on screen. */
export function pagesFromReflow(doc: ReflowDoc): PageText[] {
  return doc.pages.map(({ page, paragraphs }) => ({ page, text: pageText(paragraphs) }));
}

export function searchDocument(source: DocumentText, rawQuery: string, limit = MAX_HITS): SearchResult {
  const query = normaliseQuery(rawQuery);
  if (!query) return NONE;
  const parts: PageText[] = source.kind === 'text' ? [{ page: 0, text: source.text }] : source.pages;
  const hits: SearchHit[] = [];
  let total = 0;
  for (const part of parts) {
    const found = findMatches(part.text, query, { limit: limit - hits.length, cap: COUNT_CAP - total });
    for (const match of found.matches) {
      const hit: SearchHit = { ...match, snippet: snippetAround(part.text, match.offset, match.length) };
      if (source.kind === 'pages') hit.page = part.page;
      hits.push(hit);
    }
    total += found.total;
    if (found.capped) return { hits, total, capped: true };
  }
  return { hits, total, capped: false };
}
