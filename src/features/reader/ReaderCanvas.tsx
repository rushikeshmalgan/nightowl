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

const RULER_STEP = 24;
const STORAGE_READ_ERROR = 'This document could not be read from storage.';

export interface ReaderPosition {
  page: number;
  numPages: number;
}

export interface ReaderHandle {
  goToPage(page: number): void;
  /** Scrolls a text highlight into view, given its start offset. */
  goToHighlight(start: number): void;
}

export interface ReaderCanvasProps {
  doc: DocRecord | null;
  /** Saved highlights for the open text document. */
  highlights?: TextRange[];
  onHighlight?(range: TextRange): void;
  /** The plain text of the open document, for reading aloud. Empty when none. */
  onText?(text: string): void;
  onPosition?(position: ReaderPosition): void;
  /** Offered from the error panel as the way out. */
  onOpenLibrary?(): void;
  ref?: Ref<ReaderHandle>;
}

type Loaded = { docId: string; kind: 'text'; text: string } | { docId: string; kind: 'binary'; data: ArrayBuffer };

/** The reading area: picks the viewer for the open document's type. */
export function ReaderCanvas({ doc, highlights, onHighlight, onText, onPosition, onOpenLibrary, ref }: ReaderCanvasProps) {
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

  const [rulerY, setRulerY] = useState(250);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ docId: string; message: string } | null>(null);

  const docId = doc?.id ?? null;
  const progress = useReadingProgress(docId);

  const latest = useRef({ onText, onPosition });
  latest.current = { onText, onPosition };

  useAutoScroll(scrollRef, autoScroll, scrollSpeed);

  // Arrow keys: up/down move the focus ruler while it is on, left/right turn
  // PDF pages. Otherwise they keep their normal scrolling behaviour.
  const hotkeys: HotkeyMap = {};
  if (focusRuler) {
    hotkeys.ArrowUp = () => setRulerY((y) => Math.max(0, y - RULER_STEP));
    hotkeys.ArrowDown = () => setRulerY((y) => y + RULER_STEP);
  }
  if (doc?.type === 'pdf') {
    hotkeys.ArrowRight = () => pdfRef.current?.goToPage(pdfPage.current + 1);
    hotkeys.ArrowLeft = () => pdfRef.current?.goToPage(Math.max(1, pdfPage.current - 1));
  }
  useHotkeys(hotkeys);

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

  // Put the reader back where they left off in a text document, once per document.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !docId || text === null || progress.initial === undefined) return;
    if (restoredFor.current === docId) return;
    restoredFor.current = docId;
    scroller.scrollTop = progress.initial?.scrollTop ?? 0;
  }, [docId, text, progress.initial]);

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
    goToPage(page: number) {
      if (doc?.type === 'pdf') {
        pdfRef.current?.goToPage(page);
        return;
      }
      const scroller = scrollRef.current;
      if (!scroller) return;
      scroller.scrollTop = Math.max(0, page - 1) * (scroller.clientHeight || 0);
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
  const showPdf = doc?.type === 'pdf' && !error;

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
            initialPage={progress.initial?.page ?? 1}
            initialScrollTop={progress.initial?.scrollTop ?? 0}
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
            if (!docId || text === null) return;
            const position = screenOf(event.currentTarget);
            progress.save(position.page, event.currentTarget.scrollTop);
            latest.current.onPosition?.(position);
          }}
        >
          {/* Bottom padding clears the 56px music dock. */}
          <div className="px-6 pb-28 pt-12 md:px-12">{body}</div>
        </div>
      )}
      {focusRuler ? <FocusRuler y={rulerY} /> : null}
    </main>
  );
}
