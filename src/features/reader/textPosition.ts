/** Exact positions in a rendered text document, counted in characters the way highlights count them. */

/** How far below the top of the reading area a position is taken, and a jump puts a character: clear of the 32px status line. */
export const TEXT_TOP_MARGIN = 40;

/** How many following characters to try when a character (a line break, say) has no box of its own. */
const EMPTY_BOX_RETRIES = 3;

interface TextIndex {
  nodes: Text[];
  /** The offset of each node's first character in the whole text. */
  starts: number[];
  total: number;
}

/** One walk over the text nodes, so any number of offsets can then be found by binary search. */
function indexText(root: HTMLElement): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let total = 0;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    nodes.push(node);
    starts.push(total);
    total += node.data.length;
  }
  return { nodes, starts, total };
}

/** The text node holding the character at `offset` (which must be inside the text) and its place in that node. */
function locate(index: TextIndex, offset: number): { node: Text; local: number } {
  // The last node that starts at or before the offset.
  let low = 0;
  let high = index.nodes.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (index.starts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return { node: index.nodes[low], local: offset - index.starts[low] };
}

/** The range of the character at `offset`, or an empty range at the very end. */
function rangeIn(index: TextIndex, offset: number): Range | null {
  if (!Number.isFinite(offset) || offset < 0 || offset > index.total) return null;
  const range = document.createRange();
  if (offset === index.total) {
    const last = index.nodes[index.nodes.length - 1];
    if (!last) return null;
    range.setStart(last, last.data.length);
    range.collapse(true);
    return range;
  }
  const { node, local } = locate(index, offset);
  range.setStart(node, local);
  range.setEnd(node, local + 1);
  return range;
}

const hasNoBox = (rect: DOMRect) => rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.bottom === 0;

/** The box of the character at `offset`, trying the next few when it has none of its own (a line break). */
function rectIn(index: TextIndex, offset: number): DOMRect | null {
  for (let step = 0; step <= EMPTY_BOX_RETRIES; step++) {
    const range = rangeIn(index, offset + step);
    if (!range || typeof range.getBoundingClientRect !== 'function') return null;
    const rect = range.getBoundingClientRect();
    if (!hasNoBox(rect)) return rect;
  }
  return null;
}

/**
 * The range of one character at `offset` in the text rendered under `root`, counting characters
 * across all the markup (Bionic bold, highlights). At the very end it is an empty range.
 * Null when the offset is outside the text.
 */
export function rangeAtOffset(root: HTMLElement, offset: number): Range | null {
  return rangeIn(indexText(root), offset);
}

/**
 * Selects `length` characters from `offset` in the text rendered under `root`, counting across all the
 * markup, replacing the current selection. False (and the selection untouched) when that range is not
 * wholly inside the text.
 */
export function selectText(root: HTMLElement, offset: number, length: number): boolean {
  if (!Number.isFinite(offset) || !Number.isFinite(length)) return false;
  const first = Math.floor(offset);
  const count = Math.floor(length);
  const index = indexText(root);
  const selection = window.getSelection();
  if (!selection || first < 0 || count < 1 || first + count > index.total) return false;
  const start = locate(index, first);
  const end = locate(index, first + count - 1);
  const range = document.createRange();
  range.setStart(start.node, start.local);
  range.setEnd(end.node, end.local + 1);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/** Where a character is on screen, or null when it is outside the text or cannot be measured. */
export function rectAtOffset(root: HTMLElement, offset: number): DOMRect | null {
  return rectIn(indexText(root), offset);
}

/**
 * The character offset at the top of the reading area: the first character of the first line that
 * reaches below `margin` pixels from the scroller's top. It measures the text's own boxes, so a panel
 * or backdrop drawn over the reading area (as on a phone) cannot throw it off, the way asking the
 * browser what is under a point would. Falls back to the start of the first segment still on screen
 * when boxes cannot be measured, and to null when nothing can.
 */
export function topOffset(scroller: HTMLElement, article: HTMLElement, margin: number = TEXT_TOP_MARGIN): number | null {
  const cutoff = scroller.getBoundingClientRect().top + margin;
  const index = indexText(article);

  if (index.total > 0) {
    const lastBottom = rectIn(index, index.total - 1)?.bottom;
    if (lastBottom !== undefined) {
      if (lastBottom <= cutoff) return index.total - 1;
      let low = 0;
      let high = index.total - 1;
      while (low < high) {
        const mid = (low + high) >> 1;
        const bottom = rectIn(index, mid)?.bottom;
        if (bottom === undefined) break;
        if (bottom > cutoff) high = mid;
        else low = mid + 1;
      }
      return low;
    }
  }

  for (const segment of article.querySelectorAll<HTMLElement>('[data-start]')) {
    if (segment.getBoundingClientRect().bottom > cutoff) return Number(segment.dataset.start);
  }
  return null;
}
