import { useEffect, useState } from 'react';
import { clearReflowCache, loadReflowText, peekReflowText } from '../pdf/reflowCache';
import type { ReflowState } from '../pdf/reflowCache';

import { REFLOW_READ_ERROR } from './reflowMessages';

export { REFLOW_READ_ERROR, clearReflowCache };
export type { ReflowState };

const IDLE: ReflowState = { status: 'idle' };
const STARTING: ReflowState = { status: 'loading', done: 0, total: 0 };

/**
 * The open PDF's text for Reflow mode. Nothing runs until `enabled`; the extraction is shared with
 * search (see reflowCache), cancelled when the document changes and cached once done.
 */
export function useReflowText(docId: string | null, data: ArrayBuffer | null, enabled: boolean): ReflowState {
  const [progress, setProgress] = useState<{ docId: string; state: ReflowState } | null>(null);
  const active = enabled && docId !== null && data !== null;

  useEffect(() => {
    if (!active || !docId || !data || peekReflowText(docId)) return;
    const controller = new AbortController();
    const report = (state: ReflowState) => {
      if (!controller.signal.aborted) setProgress({ docId, state });
    };
    void loadReflowText(docId, data, (done, total) => report({ status: 'loading', done, total }), controller.signal).then(report);
    return () => controller.abort();
  }, [active, docId, data]);

  if (!docId) return IDLE;
  // A finished result stays visible while Pages is showing, so the app can say whether Reflow is possible.
  const done = peekReflowText(docId);
  if (done) return done;
  if (!active) return IDLE;
  return progress?.docId === docId ? progress.state : STARTING;
}
