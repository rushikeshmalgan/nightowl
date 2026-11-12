import { Fragment, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { bionicSplit } from '../lib/bionic';
import { offsetsFromRange, segmentText } from '../lib/highlights';
import type { TextRange } from '../lib/highlights';

export interface TextViewProps {
  text: string;
  mono: boolean;
  bionic: boolean;
  dyslexic: boolean;
  fontSize: number;
  lineHeight: number;
  /** Saved highlights, as character ranges. They may overlap. */
  highlights?: TextRange[];
  /** Called when the reader chooses to highlight the current selection. */
  onHighlight?(range: TextRange): void;
}

function fontClass(mono: boolean, dyslexic: boolean): string {
  if (dyslexic) return 'font-dyslexic';
  return mono ? 'font-mono' : 'font-serif';
}

/** Bolds the first half of each word; whitespace runs are kept as they are. */
function renderBionic(text: string): ReactNode {
  return text.split(/(\s+)/).map((token, index) => {
    if (token === '' || /^\s+$/.test(token)) return <Fragment key={index}>{token}</Fragment>;
    const { head, tail } = bionicSplit(token);
    return (
      <Fragment key={index}>
        <strong className="font-semibold">{head}</strong>
        {tail}
      </Fragment>
    );
  });
}

const NO_HIGHLIGHTS: TextRange[] = [];

export function TextView({
  text,
  mono,
  bionic,
  dyslexic,
  fontSize,
  lineHeight,
  highlights = NO_HIGHLIGHTS,
  onHighlight,
}: TextViewProps) {
  const articleRef = useRef<HTMLElement>(null);
  const [offer, setOffer] = useState<(TextRange & { x: number; y: number }) | null>(null);

  // Each segment carries its start offset, so a selection maps back to the text.
  const segments = useMemo(() => segmentText(text, highlights), [text, highlights]);

  const updateOffer = () => {
    if (!onHighlight) return;
    const selection = window.getSelection();
    const article = articleRef.current;
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !article) {
      setOffer(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!article.contains(range.commonAncestorContainer)) {
      setOffer(null);
      return;
    }
    const offsets = offsetsFromRange(range);
    if (!offsets || offsets.end <= offsets.start) {
      setOffer(null);
      return;
    }
    const rect = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
    setOffer({ ...offsets, x: rect ? rect.left + rect.width / 2 : 0, y: rect ? rect.top : 0 });
  };

  return (
    <>
      <article
        ref={articleRef}
        className={`mx-auto max-w-[72ch] whitespace-pre-wrap break-words text-ink ${fontClass(mono, dyslexic)}`}
        style={{ fontSize: `${fontSize}px`, lineHeight }}
        onMouseUp={updateOffer}
        onKeyUp={updateOffer}
      >
        {segments.map((segment) => {
          const content = bionic ? renderBionic(segment.text) : segment.text;
          return segment.highlighted ? (
            <mark key={segment.start} data-start={segment.start} className="rounded-[2px] bg-accent/25 text-ink">
              {content}
            </mark>
          ) : (
            <span key={segment.start} data-start={segment.start}>
              {content}
            </span>
          );
        })}
      </article>

      {offer && onHighlight ? (
        <button
          type="button"
          // Keep the selection alive while the button is pressed.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onHighlight({ start: offer.start, end: offer.end });
            window.getSelection()?.removeAllRanges();
            setOffer(null);
          }}
          className="motion-color fixed z-50 -translate-x-1/2 rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none hover:text-accent focus-visible:ring-1 focus-visible:ring-accent"
          style={{ left: `${offer.x}px`, top: `${Math.max(8, offer.y - 36)}px` }}
        >
          Highlight
        </button>
      ) : null}
    </>
  );
}
