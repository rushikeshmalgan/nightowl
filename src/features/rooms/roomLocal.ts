import type { DocType } from '../../shared/types';
import type { JumpTarget } from './roomModel';
import type { RoomLocal } from './useRoom';

/** The reader's position as the app tracks it. Text documents add the exact character offset. */
export interface PositionLike {
  page: number;
  numPages: number;
  offset?: number;
  length?: number;
}

/**
 * What the room is told about the open document: its kind, fingerprint, size (page count or text length)
 * and my place in it. A document that has not reported its size or place yet shares none.
 */
export function roomLocalFrom(docType: DocType | null, position: PositionLike | null, fp: string): RoomLocal {
  if (!docType) return { doc: 'none', fp: '', len: 0, progress: null };
  if (docType === 'pdf') {
    if (!position) return { doc: 'pdf', fp, len: 0, progress: null };
    const total = position.numPages;
    return { doc: 'pdf', fp, len: total, progress: { page: Math.min(Math.max(1, position.page), total), total } };
  }
  if (docType === 'text') {
    const exact = position && position.offset !== undefined && position.length ? { offset: position.offset, length: position.length } : null;
    return { doc: 'text', fp, len: exact?.length ?? 0, progress: exact };
  }
  return { doc: 'psd', fp, len: 0, progress: null };
}

/** Where I am now, as something I could be taken back to; null when there is no exact place. */
export function myJumpTarget(docType: DocType | null, position: PositionLike | null): JumpTarget | null {
  if (!position) return null;
  if (docType === 'pdf') return { kind: 'page', page: position.page };
  if (docType === 'text' && position.offset !== undefined && position.length) return { kind: 'offset', offset: position.offset, length: position.length };
  return null;
}
