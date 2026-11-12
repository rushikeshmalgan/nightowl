import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useHotkeys } from '../hooks/useHotkeys';
import { useReadingProgress } from '../hooks/useReadingProgress';
import { isCodeLike } from '../lib/fileTypes';
import type { TextRange } from '../lib/highlights';
import { readText } from '../lib/text';
import { useUi } from '../store/ui';
import type { DocRecord } from '../types';
import { FocusRuler } from './FocusRuler';
import { TextView } from './TextView';

const RULER_STEP = 24;

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
  ref?: Ref<ReaderHandle>;
}

export function ReaderCanvas({ doc, highlights, onHighlight, onText, onPosition, ref }: ReaderCanvasProps) {
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [rulerY, setRulerY] = useState(250);
  const [loaded, setLoaded] = useState<{ docId: string; text: string } | null>(null);
  const restoredFor = useRef<string | null>(null);

  const docId = doc?.id ?? null;
  const progress = useReadingProgress(docId);

  const latest = useRef({ onText, onPosition });
  latest.current = { onText, onPosition };

  useAutoScroll(scrollRef, autoScroll, scrollSpeed);

  // The arrow keys move the ruler only while it is on; otherwise they keep
  // their normal scrolling behaviour.
  useHotkeys(
    focusRuler
      ? {
          ArrowUp: () => setRulerY((y) => Math.max(0, y - RULER_STEP)),
          ArrowDown: () => setRulerY((y) => y + RULER_STEP),
        }
      : {},
  );

  // Decode text documents.
  useEffect(() => {
    if (!doc || doc.type !== 'text') {
      setLoaded(null);
      latest.current.onText?.('');
      return;
    }
    let cancelled = false;
    void readText(doc.blob).then((text) => {
      if (cancelled) return;
      setLoaded({ docId: doc.id, text });
      latest.current.onText?.(text);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const text = loaded && loaded.docId === docId ? loaded.text : null;

  // Put the reader back where they left off, once per document.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !docId || text === null || progress.initial === undefined) return;
    if (restoredFor.current === docId) return;
    restoredFor.current = docId;
    scroller.scrollTop = progress.initial?.scrollTop ?? 0;
  }, [docId, text, progress.initial]);

  const pageOf = (scroller: HTMLElement): ReaderPosition => {
    const viewport = scroller.clientHeight || 1;
    return {
      page: Math.floor(scroller.scrollTop / viewport) + 1,
      numPages: Math.max(1, Math.ceil(scroller.scrollHeight / viewport)),
    };
  };

  useImperativeHandle(ref, () => ({
    goToPage(page: number) {
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

  return (
    <main
      className="absolute inset-0"
      onMouseMove={(event) => {
        if (!focusRuler) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setRulerY(event.clientY - rect.top);
      }}
    >
      <div
        ref={scrollRef}
        data-testid="reader-scroll"
        className="h-full overflow-y-auto pl-12 pt-8"
        style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
        onScroll={(event) => {
          if (!docId || text === null) return;
          const position = pageOf(event.currentTarget);
          progress.save(position.page, event.currentTarget.scrollTop);
          latest.current.onPosition?.(position);
        }}
      >
        <div className="px-6 py-12 md:px-12">
          {!doc ? (
            <p className="mx-auto max-w-[72ch] text-sm text-muted">
              Nothing is open. Drop a file here, or press Ctrl K to find a document.
            </p>
          ) : doc.type !== 'text' ? (
            <p className="mx-auto max-w-[72ch] text-sm text-muted">This file type cannot be shown yet.</p>
          ) : text !== null ? (
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
          ) : null}
        </div>
      </div>
      {focusRuler ? <FocusRuler y={rulerY} /> : null}
    </main>
  );
}
