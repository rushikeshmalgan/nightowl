import { useEffect, useMemo, useState } from 'react';
import type { DocType } from '../../shared/types';
import { loadReflowText, peekReflowText } from '../pdf/reflowCache';
import type { ReflowState } from '../pdf/reflowCache';
import { normaliseQuery } from './findMatches';
import { pagesFromReflow, searchDocument } from './searchDocument';
import type { SearchHit } from './searchDocument';

/** How long typing must pause before the text is searched. */
export const DEBOUNCE_MS = 150;

export type SearchStatus = 'idle' | 'preparing' | 'ready' | 'empty' | 'error' | 'unsupported';

export interface DocumentSearch {
  status: SearchStatus;
  /** The normalised query the hits are for; null when there are none. */
  query: string | null;
  /** Pages read so far, and of how many, while `preparing` (0 / 0 until the first page is read). */
  done: number;
  total: number;
  hits: SearchHit[];
  /** Matches counted, no further than the cap. */
  totalHits: number;
  capped: boolean;
}

export interface DocumentSearchArgs {
  doc: { id: string; type: DocType; blob: Blob } | null;
  /** The open text document's decoded text; ignored for a PDF. */
  text: string;
  /** What is typed in the palette. */
  query: string;
  /** The palette is open. */
  active: boolean;
}

const NO_HITS: SearchHit[] = [];
const COULD_NOT_READ = 'Could not read the file.';

/**
 * Searches the open document for what is typed in the palette. Text is searched directly. A PDF's text comes
 * from the extraction Reflow shares (see reflowCache): nothing is read until a valid query is typed, one
 * extraction serves every query, and it is let go of when the palette closes or the document changes.
 */
export function useDocumentSearch({ doc, text, query, active }: DocumentSearchArgs): DocumentSearch {
  const docId = doc?.id ?? null;
  const type = doc?.type ?? null;
  const blob = doc?.blob ?? null;

  // Typing is searched after a pause. A query too short to search takes effect at once.
  const [settledQuery, setSettledQuery] = useState('');
  useEffect(() => {
    if (!active) {
      setSettledQuery('');
      return;
    }
    const timer = setTimeout(() => setSettledQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [active, query]);
  const liveValid = active && normaliseQuery(query) !== null;
  const q = normaliseQuery(settledQuery);

  // A PDF is read from the first valid query on, and stays wanted while the palette is open
  // (deleting back to one character and typing again must not start over).
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!active) setArmed(null);
    else if (liveValid && type === 'pdf' && docId) setArmed(docId);
  }, [active, liveValid, type, docId]);
  const wantsPdf = active && type === 'pdf' && docId !== null && armed === docId;

  const [pdf, setPdf] = useState<{ docId: string; state: ReflowState } | null>(null);
  useEffect(() => {
    if (!wantsPdf || !docId || !blob || peekReflowText(docId)) return;
    const controller = new AbortController();
    const report = (state: ReflowState) => {
      if (!controller.signal.aborted) setPdf({ docId, state });
    };
    setPdf(null);
    blob
      .arrayBuffer()
      .then((data) => loadReflowText(docId, data, (done, total) => report({ status: 'loading', done, total }), controller.signal))
      .then(report, () => report({ status: 'error', message: COULD_NOT_READ }));
    return () => controller.abort();
  }, [wantsPdf, docId, blob]);

  // Only a result for this very document counts, whatever finishes late.
  const extraction: ReflowState | null = type === 'pdf' && docId ? (peekReflowText(docId) ?? (pdf?.docId === docId ? pdf.state : null)) : null;
  const readyDoc = extraction?.status === 'ready' ? extraction.doc : null;
  const pages = useMemo(() => (readyDoc ? pagesFromReflow(readyDoc) : null), [readyDoc]);
  const isText = type === 'text';
  const result = useMemo(() => {
    if (!q) return null;
    if (isText) return text ? searchDocument({ kind: 'text', text }, q) : null;
    return pages ? searchDocument({ kind: 'pages', pages }, q) : null;
  }, [q, isText, text, pages]);

  let status: SearchStatus = 'idle';
  let done = 0;
  let total = 0;
  if (active && doc) {
    if (type === 'psd') status = 'unsupported';
    else if (liveValid) {
      if (isText) status = result ? 'ready' : 'idle';
      else if (extraction?.status === 'empty') status = 'empty';
      else if (extraction?.status === 'error') status = 'error';
      else if (extraction?.status === 'ready') status = result ? 'ready' : 'idle';
      else {
        status = 'preparing';
        if (extraction?.status === 'loading') ({ done, total } = extraction);
      }
    }
  }

  const shown = status === 'ready' ? result : null;
  return useMemo(
    () => ({
      status,
      query: shown ? q : null,
      done,
      total,
      hits: shown?.hits ?? NO_HITS,
      totalHits: shown?.total ?? 0,
      capped: shown?.capped ?? false,
    }),
    [status, q, done, total, shown],
  );
}
