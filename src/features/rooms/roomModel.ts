/** What a room shares, how it is checked, and how members are listed. Pure, so it tests in plain Node. */

export const MAX_MEMBERS = 8;
export const AWAY_AFTER_MS = 120_000;
export const PROGRESS_GAP_MS = 10_000;
export const NUDGE_GAP_MS = 3_000;
export const TIMER_CHOICES = [15, 25, 45] as const;
export const NUDGES = ['👋', '🔥', '☕', '🌙'] as const;

export type DocKind = 'pdf' | 'psd' | 'text' | 'none';
export type MemberStatus = 'reading' | 'focus' | 'away';

/** What each member shares through presence. Never a file name or any text. */
export interface MemberMeta {
  nick: string;
  doc: DocKind;
  /** The document fingerprint, or empty when nothing is open. */
  fp: string;
  /** Page count (PDF) or length in characters (text); 0 otherwise. */
  len: number;
  status: MemberStatus;
}

/** Where a member is: PDF pages, or a character offset in a text file. */
export interface Progress {
  page?: number;
  total?: number;
  offset?: number;
  length?: number;
}

export interface Member extends MemberMeta {
  key: string;
  me: boolean;
  progress: Progress | null;
}

const DOCS: readonly string[] = ['pdf', 'psd', 'text', 'none'];
const STATUSES: readonly string[] = ['reading', 'focus', 'away'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const integerWithin = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;

/** A member's presence payload, if it is well formed. Anything a stranger sends is checked, never trusted. */
export function parseMeta(raw: unknown): MemberMeta | null {
  if (!isRecord(raw)) return null;
  const nick = typeof raw.nick === 'string' ? raw.nick.trim() : '';
  const len = integerWithin(raw.len, 0, 1e9);
  if (nick.length < 1 || nick.length > 24 || len === null) return null;
  if (typeof raw.doc !== 'string' || !DOCS.includes(raw.doc)) return null;
  if (typeof raw.status !== 'string' || !STATUSES.includes(raw.status)) return null;
  if (typeof raw.fp !== 'string' || !/^[0-9a-f]{0,16}$/.test(raw.fp)) return null;
  return { nick, doc: raw.doc as DocKind, fp: raw.fp, len, status: raw.status as MemberStatus };
}

/** A progress message, if its numbers make sense for a document. */
export function parseProgress(raw: unknown): Progress | null {
  if (!isRecord(raw)) return null;
  const total = integerWithin(raw.total, 1, 100_000);
  const page = total === null ? null : integerWithin(raw.page, 1, total);
  if (page !== null && total !== null) return { page, total };
  const length = integerWithin(raw.length, 1, 1e9);
  const offset = length === null ? null : integerWithin(raw.offset, 0, length);
  if (offset !== null && length !== null) return { offset, length };
  return null;
}

/** The people in the room, me first, then by nickname. Invalid presence entries are skipped. */
export function membersFromPresence(state: Record<string, unknown[]>, myKey: string, progress: Record<string, Progress>): Member[] {
  const members: Member[] = [];
  for (const [key, entries] of Object.entries(state)) {
    let meta: MemberMeta | null = null;
    for (let i = entries.length - 1; i >= 0 && !meta; i--) meta = parseMeta(entries[i]);
    if (meta) members.push({ ...meta, key, me: key === myKey, progress: progress[key] ?? null });
  }
  return members.sort((a, b) => Number(b.me) - Number(a.me) || a.nick.localeCompare(b.nick) || a.key.localeCompare(b.key));
}

/** True when both have the same file open: the same fingerprint and the same page count or length. */
export function sameDocument(a: Member, b: Member): boolean {
  return a.fp !== '' && a.fp === b.fp && a.len === b.len;
}

/** After joining, whether this member must leave because more than `max` are present: the largest keys go. */
export function shouldLeaveFullRoom(keys: string[], myKey: string, max: number = MAX_MEMBERS): boolean {
  if (keys.length <= max || !keys.includes(myKey)) return false;
  return ![...keys].sort().slice(0, max).includes(myKey);
}

/** "p. 12 / 40" for a PDF, "62%" for a text file, or nothing. */
export function formatPosition(doc: DocKind, progress: Progress | null): string {
  if (!progress) return '';
  if (doc === 'pdf' && progress.page !== undefined && progress.total !== undefined) return `p. ${progress.page} / ${progress.total}`;
  if (doc === 'text' && progress.offset !== undefined && progress.length) return `${Math.round((progress.offset / progress.length) * 100)}%`;
  return '';
}

/** Returns a function that says true at most once per `minGapMs`, recording each use. */
export function createRateLimiter(minGapMs: number, now: () => number = Date.now): () => boolean {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const time = now();
    if (time - last < minGapMs) return false;
    last = time;
    return true;
  };
}
