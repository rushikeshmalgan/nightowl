/** Turns pdf.js text items into readable paragraphs for Reflow mode. Pure, so it tests in plain Node. */

/** One positioned run of text on a page. `y` is the baseline in PDF space (it grows upward). */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
}

export interface ReflowPage {
  /** 1-based page number in the PDF. */
  page: number;
  paragraphs: string[];
}

export interface ReflowDoc {
  pages: ReflowPage[];
  /** False for an image-only (scanned) PDF: there is nothing to reflow. */
  hasText: boolean;
}

interface Line {
  text: string;
  y: number;
  height: number;
  end: number;
  eol: boolean;
}

/** Groups items into lines: a new line starts after an end-of-line mark or when the baseline moves. */
function toLines(items: PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  let current: Line | null = null;
  for (const it of items) {
    if (it.str.trim() === '') {
      if (current) {
        if (it.str.length > 0) current.text += ' ';
        if (it.hasEOL) current.eol = true;
      }
      continue;
    }
    const sameLine = current !== null && !current.eol && Math.abs(it.y - current.y) <= Math.max(it.height, current.height) * 0.5;
    if (!current || !sameLine) {
      if (current) lines.push(current);
      current = { text: it.str, y: it.y, height: it.height, end: it.x + it.width, eol: it.hasEOL };
      continue;
    }
    const gap = it.x - current.end;
    if (gap > Math.max(it.height, current.height) * 0.15 && !/\s$/.test(current.text) && !/^\s/.test(it.str)) current.text += ' ';
    current.text += it.str;
    current.end = it.x + it.width;
    current.height = Math.max(current.height, it.height);
    current.eol = it.hasEOL;
  }
  if (current) lines.push(current);
  return lines.map((line) => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() })).filter((line) => line.text !== '');
}

/** Joins two wrapped lines, mending a word hyphenated across them. */
function joinLines(before: string, after: string): string {
  if (/[A-Za-z]-$/.test(before)) return /^[a-z]/.test(after) ? before.slice(0, -1) + after : before + after;
  return `${before} ${after}`;
}

/** Groups lines into paragraphs: a gap clearly bigger than the usual line spacing, or a change of font size, starts a new one. */
function toParagraphs(lines: Line[]): string[] {
  const gaps = lines
    .slice(1)
    .map((line, index) => lines[index].y - line.y)
    .filter((gap) => gap > 0)
    .sort((a, b) => a - b);
  // The lower median, so a few paragraph gaps do not drag up the usual spacing.
  const usual = gaps.length > 0 ? gaps[Math.floor((gaps.length - 1) / 2)] : 0;
  const paragraphs: string[] = [];
  let current = '';
  lines.forEach((line, index) => {
    if (index === 0) {
      current = line.text;
      return;
    }
    const previous = lines[index - 1];
    const gap = previous.y - line.y;
    const sizeChanged = Math.abs(line.height - previous.height) > 0.2 * Math.max(line.height, previous.height);
    if (gap <= 0 || (usual > 0 && gap > usual * 1.4) || sizeChanged) {
      paragraphs.push(current);
      current = line.text;
    } else {
      current = joinLines(current, line.text);
    }
  });
  if (current) paragraphs.push(current);
  return paragraphs;
}

/** The paragraphs of a single page. */
export function assemblePage(items: PdfTextItem[]): string[] {
  return toParagraphs(toLines(items));
}

const PAGE_NUMBER = /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i;
/** Lines that differ only in their numbers count as the same header or footer. */
const edgeKey = (text: string) => text.toLowerCase().replace(/\d+/g, '#');

/** How many lines at the top and at the bottom of a page can be a running header or footer. */
const EDGE_LINES = 3;

/**
 * The lines nearest the top and the bottom of the page, found by where they sit and not by the order they
 * were drawn in: a word processor draws a header first, but a browser's print-to-PDF draws the header and
 * footer after the whole body.
 */
function edgeLines(lines: Line[]): Set<Line> {
  const byHeight = [...lines].sort((a, b) => b.y - a.y);
  return new Set([...byHeight.slice(0, EDGE_LINES), ...byHeight.slice(-EDGE_LINES)]);
}

/**
 * Assembles every page, dropping bare page numbers and the header or footer
 * lines that repeat at the top or bottom of most pages.
 */
export function buildReflow(pages: PdfTextItem[][]): ReflowDoc {
  const pageLines = pages.map(toLines);
  const edges = pageLines.map(edgeLines);
  const counts = new Map<string, number>();
  pageLines.forEach((_, index) => {
    for (const key of new Set([...edges[index]].map((line) => edgeKey(line.text)))) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const repeatAt = Math.max(2, Math.ceil(pages.length * 0.5));
  const isEdgeNoise = (line: Line) => PAGE_NUMBER.test(line.text) || (pages.length >= 2 && (counts.get(edgeKey(line.text)) ?? 0) >= repeatAt);

  const result = pageLines.map((lines, index) => {
    const kept = lines.filter((line) => !(edges[index].has(line) && isEdgeNoise(line)));
    return { page: index + 1, paragraphs: toParagraphs(kept) };
  });
  return { pages: result, hasText: result.some((page) => page.paragraphs.length > 0) };
}
