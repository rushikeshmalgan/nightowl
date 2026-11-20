import type { Command } from '../../app/commands';
import type { DocType, PdfMode } from '../../shared/types';
import type { SearchHit } from './searchDocument';
import type { DocumentSearch } from './useDocumentSearch';

/** Where a chosen match takes the reader, depending on what is open and how it is being shown. */
export type MatchTarget =
  | { kind: 'page'; page: number }
  | { kind: 'reflow'; page: number; offset: number; length: number }
  | { kind: 'text'; offset: number; length: number };

export interface SearchView {
  type: DocType;
  /** The PDF's current view; null for anything else. */
  mode: PdfMode | null;
  /** Length of the open text document, for the percentage hint. */
  textLength: number;
}

export const SCANNED_MESSAGE = 'This PDF has no text to search (it looks scanned).';
export const READ_ERROR_MESSAGE = "Could not read this PDF's text to search it.";

/** A line of information in the Find group: always shown, never chosen. */
const note = (id: string, title: string): Command => ({ id: `find-${id}`, title, group: 'Find', fixed: true, disabled: true, run: () => {} });

function hitCommand(hit: SearchHit, view: SearchView, go: (target: MatchTarget) => void): Command {
  const isPdf = view.type === 'pdf' && hit.page !== undefined;
  const percent = view.textLength > 0 ? Math.min(100, Math.round((hit.offset / view.textLength) * 100)) : 0;
  const target: MatchTarget = !isPdf
    ? { kind: 'text', offset: hit.offset, length: hit.length }
    : view.mode === 'reflow'
      ? { kind: 'reflow', page: hit.page!, offset: hit.offset, length: hit.length }
      : { kind: 'page', page: hit.page! };
  return {
    id: `find-${hit.page ?? 0}-${hit.offset}`,
    title: hit.snippet,
    group: 'Find',
    fixed: true,
    hint: isPdf ? `p. ${hit.page}` : `${percent}%`,
    run: () => go(target),
  };
}

/** The palette's "Find" rows for the current search: the hits, or one line saying why there are none yet. */
export function searchCommands(search: DocumentSearch, view: SearchView, go: (target: MatchTarget) => void): Command[] {
  switch (search.status) {
    case 'preparing':
      return [note('status', search.total > 0 ? `Preparing search… ${search.done} of ${search.total} pages` : 'Preparing search…')];
    case 'empty':
      return [note('status', SCANNED_MESSAGE)];
    case 'error':
      return [note('status', READ_ERROR_MESSAGE)];
    case 'ready': {
      if (search.hits.length === 0) return [note('status', `No matches for "${search.query ?? ''}" in this document.`)];
      const rows = search.hits.map((hit) => hitCommand(hit, view, go));
      if (search.capped || search.totalHits > search.hits.length) {
        rows.push(note('count', `Showing the first ${search.hits.length} of ${search.totalHits}${search.capped ? '+' : ''} matches.`));
      }
      return rows;
    }
    default:
      return [];
  }
}
