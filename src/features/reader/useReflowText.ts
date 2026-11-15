import { useEffect, useState } from 'react';
import { extractReflow } from '../pdf/reflowExtract';
import type { ReflowDoc } from '../pdf/reflowText';

import { REFLOW_READ_ERROR } from './reflowMessages';

export { REFLOW_READ_ERROR };

export type ReflowState =
  | { status: 'idle' }
  | { status: 'loading'; done: number; total: number }
  | { status: 'ready'; doc: ReflowDoc }
  | { status: 'empty' }
  | { status: 'error'; message: string };

const IDLE: ReflowState = { status: 'idle' };
const STARTING: ReflowState = { status: 'loading', done: 0, total: 0 };

/** Finished extractions (text, scanned or failed) by document id, so switching back to Reflow is instant. */
const settled = new Map<string, ReflowState>();

export function clearReflowCache(): void {
  settled.clear();
}

const settle = (doc: ReflowDoc): ReflowState => (doc.hasText ? { status: 'ready', doc } : { status: 'empty' });

/**
 * The open PDF's text for Reflow mode. Nothing runs until `enabled`; the
 * extraction is cancelled when the document changes and cached once done.
 */
export function useReflowText(docId: string | null, data: ArrayBuffer | null, enabled: boolean): ReflowState {
  const [progress, setProgress] = useState<{ docId: string; state: ReflowState } | null>(null);
  const active = enabled && docId !== null && data !== null;

  useEffect(() => {
    if (!active || !docId || !data || settled.has(docId)) return;
    const controller = new AbortController();
    const report = (state: ReflowState) => {
      if (!controller.signal.aborted) setProgress({ docId, state });
    };
    extractReflow(data, (done, total) => report({ status: 'loading', done, total }), controller.signal).then(
      (doc) => {
        const state = settle(doc);
        settled.set(docId, state);
        report(state);
      },
      () => {
        if (controller.signal.aborted) return;
        const state: ReflowState = { status: 'error', message: REFLOW_READ_ERROR };
        settled.set(docId, state);
        report(state);
      },
    );
    return () => controller.abort();
  }, [active, docId, data]);

  if (!docId) return IDLE;
  // A finished result stays visible while Pages is showing, so the app can say whether Reflow is possible.
  const done = settled.get(docId);
  if (done) return done;
  if (!active) return IDLE;
  return progress?.docId === docId ? progress.state : STARTING;
}
