import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import { useAutoScroll } from './useAutoScroll';
import { useHotkeys } from '../shell/useHotkeys';
import type { HotkeyMap } from '../shell/useHotkeys';
import { useReadingProgress } from './useReadingProgress';
import { isCodeLike } from '../library/fileTypes';
import type { TextRange } from './highlights';
import { readText } from './text';
import { useUi } from '../shell/ui';
import type { DocRecord } from '../../shared/types';
import { ErrorPanel } from './ErrorPanel';
import { FocusRuler } from './FocusRuler';
import { PdfViewer } from '../pdf/PdfViewer';
import type { PdfProgress, PdfViewerHandle } from '../pdf/PdfViewer';
import { PsdInspector } from '../psd/PsdInspector';
import { TextView } from './TextView';
import { TEXT_TOP_MARGIN, rectAtOffset, topOffset } from './textPosition';
import { ReflowView, reflowPageAt, scrollToReflowPage } from './ReflowView';
import { useReflowText } from './useReflowText';
import type { ReflowState } from './useReflowText';
import type { PdfMode } from '../../shared/types';
import { REFLOW_EMPTY_REASON, REFLOW_READ_ERROR } from './reflowMessages';
import { X } from 'lucide-react';

const RULER_STEP = 24;
/** The exact text position is measured at most this often while scrolling: measuring walks all the text. */
const POSITION_GAP_MS = 120;
const STORAGE_READ_ERROR = 'This document could not be read from storage.';

export interface ReaderPosition {
  page: number;
  numPages: number;
  /** Text documents: the character at the top of the screen, and the length of the text. */
  offset?: number;
  length?: number;
}

/** What a PDF is showing: which view, and whether its text could be reflowed. */
export interface PdfView {
  mode: PdfMode;
  reflow: ReflowState['status'];
}

export interface ReaderHandle {
  goToPage(page: number): void;
  /** Switches the open PDF between Pages and Reflow. */
  setPdfMode(mode: PdfMode): void;
  /** Scrolls a text highlight into view, given its start offset. */
  goToHighlight(start: number): void;
  /** Scrolls a text document so the character at `offset` sits just under the status line. */
  goToOffset(offset: number): void;
}

export interface ReaderCanvasProps {
  doc: DocRecord | null;
  /** Saved highlights for the open text document. */
  highlights?: TextRange[];
  onHighlight?(range: TextRange): void;
  /** The plain text of the open document, for reading aloud. Empty when none. */
  onText?(text: string): void;
  onPosition?(position: ReaderPosition): void;
  /** The open PDF's view, or null when no PDF is open. */
  onPdfView?(view: PdfView | null): void;
  /** Offered from the error panel as the way out. */
  onOpenLibrary?(): void;
  ref?: Ref<ReaderHandle>;
}

type Loaded = { docId: string; kind: 'text'; text: string } | { docId: string; kind: 'binary'; data: ArrayBuffer };

/** The reading area: picks the viewer for the open document's type. */
export function ReaderCanvas({ doc, highlights, onHighlight, onText, onPosition, onPdfView, onOpenLibrary, ref }: ReaderCanvasProps) {
  const bionic = useUi((s) => s.bionic);
  const dyslexic = useUi((s) => s.dyslexic);
  const fontSize = useUi((s) => s.fontSize);
  const lineHeight = useUi((s) => s.lineHeight);
  const zoom = useUi((s) => s.zoom);
  const brightness = useUi((s) => s.brightness);
  const contrast = useUi((s) => s.contrast);
  const focusRuler = useUi((s) => s.focusRuler);
  const autoScroll = useUi((s) => s.autoScroll);
  const scrollSpeed = useUi((s) => s.scrollSpeed);
  const nightPages = useUi((s) => s.nightPages);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<PdfViewerHandle>(null);
  const pdfPage = useRef(1);
  const restoredFor = useRef<string | null>(null);
  const positionGate = useRef<{ timer: ReturnType<typeof setTimeout> | null; dirty: boolean }>({ timer: null, dirty: false });

  const [rulerY, setRulerY] = useState(250);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ docId: string; message: string } | null>(null);

  const docId = doc?.id ?? null;
  const progress = useReadingProgress(docId);

  const latest = useRef({ onText, onPosition, onPdfView });
  latest.current = { onText, onPosition, onPdfView };

  useAutoScroll(scrollRef, autoScroll, scrollSpeed);

  // Load the document's content: decoded text, or the raw bytes for a viewer.
  useEffect(() => {
    setFailure(null);
    pdfPage.current = 1;
    if (!doc) {
      setLoaded(null);
      latest.current.onText?.('');
      return;
    }
    let cancelled = false;
    const fail = () => {
      if (!cancelled) setFailure({ docId: doc.id, message: STORAGE_READ_ERROR });
    };
    if (doc.type === 'text') {
      readText(doc.blob).then((text) => {
        if (cancelled) return;
        setLoaded({ docId: doc.id, kind: 'text', text });
        latest.current.onText?.(text);
      }, fail);
    } else {
      latest.current.onText?.('');
      doc.blob.arrayBuffer().then((data) => {
        if (!cancelled) setLoaded({ docId: doc.id, kind: 'binary', data });
      }, fail);
    }
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const current = loaded && loaded.docId === docId ? loaded : null;
  const text = current?.kind === 'text' ? current.text : null;
  const data = current?.kind === 'binary' ? current.data : null;
  const error = failure && failure.docId === docId ? failure.message : null;

  // PDFs open in Pages unless they were last read in Reflow; the choice is saved per document.
  const isPdf = doc?.type === 'pdf';
  const [modeState, setModeState] = useState<{ docId: string | null; mode: PdfMode }>({ docId: null, mode: 'pages' });
  const resume = useRef<{ page: number; scrollTop: number } | null>(null);
  const enteredBySwitch = useRef(false);
  const placedReflow = useRef<string | null>(null);
  const [reflowNotice, setReflowNotice] = useState<{ docId: string; text: string } | null>(null);

  useEffect(() => {
    if (!docId || progress.initial === undefined || modeState.docId === docId) return;
    pdfPage.current = progress.initial?.page ?? 1;
    resume.current = null;
    placedReflow.current = null;
    setModeState({ docId, mode: isPdf ? (progress.initial?.pdfMode ?? 'pages') : 'pages' });
  }, [docId, isPdf, progress.initial, modeState.docId]);

  const knownMode = modeState.docId === docId ? modeState.mode : null;
  const reflowOn = isPdf && knownMode === 'reflow';
  const reflow = useReflowText(docId, data, reflowOn);
  // A PDF with no readable text falls straight back to Pages.
  const inReflow = reflowOn && reflow.status !== 'empty' && reflow.status !== 'error';
  const reflowDoc = inReflow && reflow.status === 'ready' ? reflow.doc : null;

  const choosePdfMode = (next: PdfMode) => {
    if (!docId || !isPdf || knownMode === null || next === knownMode) return;
    if (next === 'pages') resume.current = { page: pdfPage.current, scrollTop: 0 };
    enteredBySwitch.current = next === 'reflow';
    setModeState({ docId, mode: next });
    progress.update({ pdfMode: next });
  };

  useEffect(() => {
    if (!docId || !reflowOn || (reflow.status !== 'empty' && reflow.status !== 'error')) return;
    setModeState({ docId, mode: 'pages' });
    progress.update({ pdfMode: 'pages' });
    setReflowNotice({ docId, text: reflow.status === 'empty' ? REFLOW_EMPTY_REASON : REFLOW_READ_ERROR });
  }, [docId, reflowOn, reflow.status]);

  useEffect(() => {
    latest.current.onPdfView?.(isPdf && knownMode !== null ? { mode: knownMode, reflow: reflow.status } : null);
  }, [isPdf, knownMode, reflow.status]);

  // Read-aloud speaks the reflowed text.
  useEffect(() => {
    if (!reflowDoc) return;
    latest.current.onText?.(reflowDoc.pages.flatMap((p) => p.paragraphs).join('\n\n'));
    return () => latest.current.onText?.('');
  }, [reflowDoc]);

  // On entering Reflow, return to the page being read, or to the saved spot when reopening.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!reflowDoc || !scroller || !docId) {
      if (!reflowDoc) placedReflow.current = null;
      return;
    }
    if (placedReflow.current === docId) return;
    placedReflow.current = docId;
    const saved = progress.initial?.reflowScrollTop;
    if (!enteredBySwitch.current && saved !== undefined) scroller.scrollTop = saved;
    else scrollToReflowPage(scroller, pdfPage.current);
    enteredBySwitch.current = false;
    const page = reflowPageAt(scroller);
    pdfPage.current = page;
    latest.current.onPosition?.({ page, numPages: reflowDoc.pages.length });
  }, [reflowDoc, docId, progress.initial]);

  const goToPage = (page: number) => {
    if (reflowDoc) {
      const scroller = scrollRef.current;
      if (scroller) scrollToReflowPage(scroller, Math.min(Math.max(1, Math.floor(page)), reflowDoc.pages.length));
      return;
    }
    if (doc?.type === 'pdf') {
      pdfRef.current?.goToPage(page);
      return;
    }
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = Math.max(0, page - 1) * (scroller.clientHeight || 0);
  };

  // Arrow keys: up/down move the focus ruler while it is on, left/right turn
  // PDF pages. Otherwise they keep their normal scrolling behaviour.
  const hotkeys: HotkeyMap = {};
  if (focusRuler) {
    hotkeys.ArrowUp = () => setRulerY((y) => Math.max(0, y - RULER_STEP));
    hotkeys.ArrowDown = () => setRulerY((y) => y + RULER_STEP);
  }
  if (isPdf) {
    hotkeys.ArrowRight = () => goToPage(pdfPage.current + 1);
    hotkeys.ArrowLeft = () => goToPage(Math.max(1, pdfPage.current - 1));
  }
  useHotkeys(hotkeys);

  // Put the reader back where they left off in a text document, once per document.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !docId || text === null || progress.initial === undefined) return;
    if (restoredFor.current === docId) return;
    restoredFor.current = docId;
    scroller.scrollTop = progress.initial?.scrollTop ?? 0;
    // Say where the reader is now, not only after the first scroll.
    latest.current.onPosition?.(textPositionOf(scroller));
  }, [docId, text, progress.initial]);

  /** The position of the open text document, with the exact character at the top when the browser can tell. */
  const textPositionOf = (scroller: HTMLElement): ReaderPosition => {
    const position = screenOf(scroller);
    const article = scroller.querySelector('article');
    const offset = article && text !== null ? topOffset(scroller, article) : null;
    return offset === null || text === null ? position : { ...position, offset, length: text.length };
  };

  /** Reports the text position at once, then at most every POSITION_GAP_MS, ending on the latest place. */
  const reportTextPosition = (scroller: HTMLElement) => {
    const gate = positionGate.current;
    if (gate.timer) {
      gate.dirty = true;
      return;
    }
    latest.current.onPosition?.(textPositionOf(scroller));
    gate.timer = setTimeout(() => {
      gate.timer = null;
      if (gate.dirty) {
        gate.dirty = false;
        reportTextPosition(scroller);
      }
    }, POSITION_GAP_MS);
  };

  // A pending report belongs to the document it was made for.
  useEffect(
    () => () => {
      const gate = positionGate.current;
      if (gate.timer) clearTimeout(gate.timer);
      gate.timer = null;
      gate.dirty = false;
    },
    [docId],
  );

  const screenOf = (scroller: HTMLElement): ReaderPosition => {
    const viewport = scroller.clientHeight || 1;
    return {
      page: Math.floor(scroller.scrollTop / viewport) + 1,
      numPages: Math.max(1, Math.ceil(scroller.scrollHeight / viewport)),
    };
  };

  const onPdfProgress = (update: PdfProgress) => {
    pdfPage.current = update.page;
    progress.save(update.page, update.scrollTop);
    latest.current.onPosition?.({ page: update.page, numPages: update.numPages });
  };

  const reportFailure = (message: string) => {
    if (docId) setFailure({ docId, message });
  };

  useImperativeHandle(ref, () => ({
    goToPage,
    setPdfMode: choosePdfMode,
    goToOffset(offset: number) {
      const scroller = scrollRef.current;
      const article = scroller?.querySelector('article');
      if (!scroller || !article || text === null || !Number.isFinite(offset) || offset < 0 || offset > text.length) return;
      const rect = rectAtOffset(article, Math.floor(offset));
      if (rect) scroller.scrollTop += rect.top - scroller.getBoundingClientRect().top - TEXT_TOP_MARGIN;
    },
    goToHighlight(start: number) {
      const marks = scrollRef.current?.querySelectorAll<HTMLElement>('mark[data-start]') ?? [];
      for (const mark of marks) {
        const markStart = Number(mark.dataset.start);
        const markEnd = markStart + (mark.textContent?.length ?? 0);
        if (start >= markStart && start < markEnd) {
          mark.scrollIntoView?.({ block: 'center' });
          return;
        }
      }
    },
  }));

  const opening = <p className="mx-auto max-w-[60ch] text-sm text-muted">Opening…</p>;
  const showPdf = isPdf && !error && !inReflow;

  let body: React.ReactNode = null;
  if (!doc) {
    body = (
      <p className="mx-auto max-w-[72ch] text-sm text-muted">
        Nothing is open. Drop a file here, or press Ctrl K to find a document.
      </p>
    );
  } else if (error) {
    body = <ErrorPanel message={error} onClear={onOpenLibrary} />;
  } else if (doc.type === 'psd') {
    body = data ? <PsdInspector key={doc.id} data={data} zoom={zoom} onError={reportFailure} /> : opening;
  } else if (inReflow) {
    body = reflowDoc ? (
      <ReflowView doc={reflowDoc} bionic={bionic} dyslexic={dyslexic} fontSize={Math.round((fontSize * zoom) / 100)} lineHeight={lineHeight} />
    ) : (
      <p role="status" className="mx-auto max-w-[72ch] text-sm text-muted">
        {reflow.status === 'loading' && reflow.total > 0 ? `Preparing text… ${reflow.done} of ${reflow.total} pages` : 'Preparing text…'}
      </p>
    );
  } else if (doc.type === 'text' && text !== null) {
    body = (
      <TextView
        text={text}
        mono={isCodeLike(doc.name)}
        bionic={bionic}
        dyslexic={dyslexic}
        fontSize={Math.round((fontSize * zoom) / 100)}
        lineHeight={lineHeight}
        highlights={highlights}
        onHighlight={onHighlight}
      />
    );
  }

  return (
    <main
      className="absolute inset-0"
      style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
      onMouseMove={(event) => {
        if (!focusRuler) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setRulerY(event.clientY - rect.top);
      }}
    >
      {showPdf ? (
        data && progress.initial !== undefined ? (
          <PdfViewer
            key={doc.id}
            ref={pdfRef}
            scrollRef={scrollRef}
            data={data}
            initialPage={resume.current?.page ?? progress.initial?.page ?? 1}
            initialScrollTop={resume.current ? resume.current.scrollTop : (progress.initial?.scrollTop ?? 0)}
            zoom={zoom}
            nightPages={nightPages}
            onProgress={onPdfProgress}
            onError={reportFailure}
          />
        ) : (
          <div className="h-full pl-12 pt-8">
            <div className="px-6 py-12 md:px-12">{opening}</div>
          </div>
        )
      ) : (
        <div
          ref={scrollRef}
          data-testid="reader-scroll"
          className="h-full overflow-y-auto pl-12 pt-8"
          onScroll={(event) => {
            if (reflowDoc) {
              const page = reflowPageAt(event.currentTarget);
              pdfPage.current = page;
              progress.update({ page, reflowScrollTop: event.currentTarget.scrollTop });
              latest.current.onPosition?.({ page, numPages: reflowDoc.pages.length });
              return;
            }
            if (!docId || text === null) return;
            const scroller = event.currentTarget;
            progress.save(screenOf(scroller).page, scroller.scrollTop);
            reportTextPosition(scroller);
          }}
        >
          {/* Bottom padding clears the 56px music dock. */}
          <div className="px-6 pb-28 pt-12 md:px-12">{body}</div>
        </div>
      )}
      {reflowNotice && reflowNotice.docId === docId ? (
        <div role="alert" className="absolute left-16 right-4 top-10 z-10 flex items-start gap-2 rounded border border-line bg-surface px-3 py-2 text-xs text-muted">
          <span className="flex-1">{reflowNotice.text}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setReflowNotice(null)}
            className="motion-color flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
          >
            <X size={12} strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
      {focusRuler ? <FocusRuler y={rulerY} /> : null}
    </main>
  );
}
