import { REFLOW_READ_ERROR } from '../reader/reflowMessages';
import { extractReflow } from './reflowExtract';
import type { ReflowDoc } from './reflowText';

/**
 * One text extraction per document, shared by everything that needs the PDF's text (Reflow mode and search),
 * so a document is never read twice and nothing runs until somebody asks.
 */

export type ReflowState =
  | { status: 'idle' }
  | { status: 'loading'; done: number; total: number }
  | { status: 'ready'; doc: ReflowDoc }
  | { status: 'empty' }
  | { status: 'error'; message: string };

type Progress = (done: number, total: number) => void;

/** An extraction under way. */
interface Flight {
  controller: AbortController;
  /** Everyone waiting on it. It is cancelled only when this becomes empty. */
  listeners: Set<Progress>;
  /** The latest progress, for a caller that joins part-way. */
  last: { done: number; total: number } | null;
  /** Settles when the extraction does: with its state, or `idle` when it was cancelled. */
  done: Promise<ReflowState>;
}

/** Finished extractions (text, scanned or failed) by document id. */
const settled = new Map<string, ReflowState>();
/** Extractions under way by document id. */
const flights = new Map<string, Flight>();

const IDLE: ReflowState = { status: 'idle' };

export function clearReflowCache(): void {
  settled.clear();
}

/** The finished result for a document, or null while it is unread or still being read. */
export function peekReflowText(docId: string): ReflowState | null {
  return settled.get(docId) ?? null;
}

const settle = (doc: ReflowDoc): ReflowState => (doc.hasText ? { status: 'ready', doc } : { status: 'empty' });

function startFlight(docId: string, data: ArrayBuffer): Flight {
  const flight: Flight = { controller: new AbortController(), listeners: new Set(), last: null, done: Promise.resolve(IDLE) };
  flights.set(docId, flight);
  const finish = (state: ReflowState): ReflowState => {
    // A cancelled extraction that limps to its end after a new one has started must not touch the cache or the map.
    if (flights.get(docId) === flight) flights.delete(docId);
    if (flight.controller.signal.aborted) return IDLE;
    settled.set(docId, state);
    return state;
  };
  flight.done = extractReflow(
    data,
    (page, total) => {
      flight.last = { done: page, total };
      for (const listener of [...flight.listeners]) listener(page, total);
    },
    flight.controller.signal,
  ).then(
    (doc) => finish(settle(doc)),
    () => finish({ status: 'error', message: REFLOW_READ_ERROR }),
  );
  return flight;
}

/**
 * The text of a PDF, extracted at most once per document. Callers that ask while it is being read share that
 * one extraction and each hears its progress. It is cancelled only when every caller has aborted; an aborted
 * caller's promise settles quietly with `idle`, so there is nothing to catch. A failed read resolves to an
 * `error` state rather than rejecting.
 */
export function loadReflowText(docId: string, data: ArrayBuffer, onProgress?: Progress, signal?: AbortSignal): Promise<ReflowState> {
  const cached = settled.get(docId);
  if (cached) return Promise.resolve(cached);
  if (signal?.aborted) return Promise.resolve(IDLE);

  const flight = flights.get(docId) ?? startFlight(docId, data);
  const listener: Progress = onProgress ?? (() => {});
  flight.listeners.add(listener);
  if (onProgress && flight.last) onProgress(flight.last.done, flight.last.total);

  return new Promise<ReflowState>((resolve) => {
    signal?.addEventListener(
      'abort',
      () => {
        flight.listeners.delete(listener);
        if (flight.listeners.size === 0) {
          flight.controller.abort();
          if (flights.get(docId) === flight) flights.delete(docId);
        }
        resolve(IDLE);
      },
      { once: true },
    );
    void flight.done.then(resolve);
  });
}
