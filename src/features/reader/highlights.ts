export interface TextRange {
  start: number;
  end: number;
}

export interface Segment {
  text: string;
  /** Offset of this segment's first character in the whole text. */
  start: number;
  highlighted: boolean;
}

/** Sorts ranges and joins any that overlap or touch. Empty ranges are dropped. */
export function mergeRanges(ranges: TextRange[]): TextRange[] {
  const sorted = ranges.filter((range) => range.end > range.start).sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ start: range.start, end: range.end });
  }
  return merged;
}

/**
 * Cuts `text` into alternating plain and highlighted pieces. Every character
 * appears in exactly one segment, however the stored highlights overlap.
 */
export function segmentText(text: string, ranges: TextRange[]): Segment[] {
  if (text === '') return [];
  const clamped = ranges.map((range) => ({
    start: Math.max(0, Math.min(text.length, range.start)),
    end: Math.max(0, Math.min(text.length, range.end)),
  }));
  const segments: Segment[] = [];
  let cursor = 0;
  for (const range of mergeRanges(clamped)) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), start: cursor, highlighted: false });
    segments.push({ text: text.slice(range.start, range.end), start: range.start, highlighted: true });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), start: cursor, highlighted: false });
  return segments;
}

/** Text offset of one end of a DOM range, using the `data-start` of the segment it falls in. */
function boundaryOffset(node: Node, offset: number): number | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const segment = element?.closest('[data-start]');
  if (segment) {
    // Count the characters between the segment's start and the boundary, so
    // nested markup (bionic <strong>) does not throw the offset off.
    const before = document.createRange();
    before.selectNodeContents(segment);
    before.setEnd(node, offset);
    return Number(segment.getAttribute('data-start')) + before.toString().length;
  }

  // The boundary sits between segments, in their shared parent.
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const children = Array.from(node.childNodes);
  const next = children[offset];
  if (next instanceof Element && next.hasAttribute('data-start')) return Number(next.getAttribute('data-start'));
  const previous = children[offset - 1];
  if (previous instanceof Element && previous.hasAttribute('data-start')) {
    return Number(previous.getAttribute('data-start')) + (previous.textContent?.length ?? 0);
  }
  return null;
}

/** Converts a selection range over rendered segments into text offsets. */
export function offsetsFromRange(range: Range): TextRange | null {
  const start = boundaryOffset(range.startContainer, range.startOffset);
  const end = boundaryOffset(range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  return { start, end };
}
