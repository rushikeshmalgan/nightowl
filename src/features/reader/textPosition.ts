import { offsetsFromRange } from './highlights';

/** How far below the top of the reading area a jump puts a character: clear of the 32px status line. */
export const TEXT_TOP_MARGIN = 40;

/** The browser's text caret at a point: Chromium and Safari call it caretRangeFromPoint, Firefox caretPositionFromPoint. */
export type CaretFn = (x: number, y: number) => Range | null;

const browserCaret: CaretFn = (x, y) => {
  const doc = document as Document & {
    caretRangeFromPoint?(x: number, y: number): Range | null;
    caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === 'function') return doc.caretRangeFromPoint(x, y);
  if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(x, y);
    if (!position) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return null;
};

/**
 * The range of one character at `offset` in the text rendered under `root`, counting characters
 * across all the markup (Bionic bold, highlights). At the very end it is an empty range.
 * Null when the offset is outside the text.
 */
export function rangeAtOffset(root: HTMLElement, offset: number): Range | null {
  if (!Number.isFinite(offset) || offset < 0) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let last: Text | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const length = node.data.length;
    if (offset < seen + length) {
      const range = document.createRange();
      range.setStart(node, offset - seen);
      range.setEnd(node, offset - seen + 1);
      return range;
    }
    seen += length;
    last = node;
  }
  if (offset === seen && last) {
    const range = document.createRange();
    range.setStart(last, last.data.length);
    range.collapse(true);
    return range;
  }
  return null;
}

/**
 * The character offset at the top left of the reading area, the same offsets highlights use.
 * Falls back to the start of the first segment still on screen when the browser cannot place a caret.
 */
export function topOffset(scroller: HTMLElement, article: HTMLElement, margin: number = TEXT_TOP_MARGIN, caret: CaretFn = browserCaret): number | null {
  const y = scroller.getBoundingClientRect().top + margin;
  const range = caret(article.getBoundingClientRect().left + 4, y);
  if (range && article.contains(range.startContainer)) {
    const offsets = offsetsFromRange(range);
    if (offsets) return offsets.start;
  }
  for (const segment of article.querySelectorAll<HTMLElement>('[data-start]')) {
    if (segment.getBoundingClientRect().bottom > y) return Number(segment.dataset.start);
  }
  return null;
}
