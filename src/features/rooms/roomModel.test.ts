import {
  MAX_MEMBERS,
  createRateLimiter,
  formatPosition,
  membersFromPresence,
  parseMeta,
  parseProgress,
  sameDocument,
  shouldLeaveFullRoom,
} from './roomModel';
import type { Member, MemberMeta } from './roomModel';

const meta = (over: Partial<MemberMeta> = {}): MemberMeta => ({ nick: 'Quiet Owl', doc: 'pdf', fp: 'abcdef0123456789', len: 40, status: 'reading', ...over });
const member = (over: Partial<Member> = {}): Member => ({ key: 'k', me: false, progress: null, ...meta(), ...over });

describe('parseMeta', () => {
  it('accepts a good payload and trims the nickname', () => {
    expect(parseMeta({ ...meta(), nick: '  Quiet Owl ' })).toEqual(meta());
    expect(parseMeta(meta({ fp: '', doc: 'none', len: 0 }))).not.toBeNull();
  });

  it('rejects anything malformed', () => {
    expect(parseMeta(null)).toBeNull();
    expect(parseMeta('hello')).toBeNull();
    expect(parseMeta(meta({ nick: 'x'.repeat(25) }))).toBeNull();
    expect(parseMeta(meta({ nick: '   ' }))).toBeNull();
    expect(parseMeta({ ...meta(), doc: 'epub' })).toBeNull();
    expect(parseMeta(meta({ fp: 'xyz' }))).toBeNull();
    expect(parseMeta(meta({ fp: 'a'.repeat(17) }))).toBeNull();
    expect(parseMeta(meta({ len: -1 }))).toBeNull();
    expect(parseMeta(meta({ len: 1.5 }))).toBeNull();
    expect(parseMeta({ ...meta(), status: 'busy' })).toBeNull();
  });
});

describe('parseProgress', () => {
  it('accepts a PDF page and a text offset', () => {
    expect(parseProgress({ page: 12, total: 40 })).toEqual({ page: 12, total: 40 });
    expect(parseProgress({ offset: 620, length: 1000 })).toEqual({ offset: 620, length: 1000 });
  });

  it('rejects positions that make no sense', () => {
    expect(parseProgress({ page: 99, total: 40 })).toBeNull();
    expect(parseProgress({ page: 0, total: 40 })).toBeNull();
    expect(parseProgress({ offset: 5, length: 3 })).toBeNull();
    expect(parseProgress({ page: Number.NaN, total: 4 })).toBeNull();
    expect(parseProgress({ page: 1, total: 1e9 })).toBeNull();
    expect(parseProgress({ page: '3', total: 4 })).toBeNull();
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress({})).toBeNull();
  });
});

describe('membersFromPresence', () => {
  it('lists me first, then the others by nickname, with their progress', () => {
    const state = {
      b: [meta({ nick: 'Zed Wren' })],
      me: [meta({ nick: 'Mine Lark' })],
      a: [meta({ nick: 'Amber Finch' })],
    };
    const progress = { a: { page: 2, total: 9 } };
    const list = membersFromPresence(state, 'me', progress);
    expect(list.map((m) => m.nick)).toEqual(['Mine Lark', 'Amber Finch', 'Zed Wren']);
    expect(list[0].me).toBe(true);
    expect(list[1].progress).toEqual({ page: 2, total: 9 });
    expect(list[2].progress).toBeNull();
  });

  it('ignores invalid entries and keeps the latest valid entry per key', () => {
    const state = { a: [meta({ nick: 'Old Name' }), meta({ nick: 'New Name' }), { junk: true }], b: [{ junk: true }] };
    const list = membersFromPresence(state, 'zz', {});
    expect(list.map((m) => m.nick)).toEqual(['New Name']);
  });
});

describe('sameDocument', () => {
  it('needs the same fingerprint and the same length', () => {
    expect(sameDocument(member(), member({ key: 'o' }))).toBe(true);
    expect(sameDocument(member(), member({ fp: '0000000000000000' }))).toBe(false);
    expect(sameDocument(member(), member({ len: 41 }))).toBe(false);
  });

  it('is never true without a fingerprint', () => {
    expect(sameDocument(member({ fp: '', len: 0 }), member({ fp: '', len: 0 }))).toBe(false);
  });
});

describe('shouldLeaveFullRoom', () => {
  const keys = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9'];

  it('keeps the eight smallest keys and drops the rest, in any order', () => {
    expect(MAX_MEMBERS).toBe(8);
    expect(shouldLeaveFullRoom([...keys].reverse(), 'k9')).toBe(true);
    expect(shouldLeaveFullRoom([...keys].reverse(), 'k1')).toBe(false);
    expect(shouldLeaveFullRoom(keys, 'k8')).toBe(false);
  });

  it('never leaves a room that is not over the limit', () => {
    expect(shouldLeaveFullRoom(keys.slice(0, 8), 'k8')).toBe(false);
  });

  it('does nothing while my own key has not appeared yet', () => {
    expect(shouldLeaveFullRoom(keys, 'unknown')).toBe(false);
  });
});

describe('formatPosition', () => {
  it('shows a PDF page of the total and a text file as a percentage', () => {
    expect(formatPosition('pdf', { page: 12, total: 40 })).toBe('p. 12 / 40');
    expect(formatPosition('text', { offset: 620, length: 1000 })).toBe('62%');
  });

  it('shows nothing when there is nothing to show', () => {
    expect(formatPosition('psd', null)).toBe('');
    expect(formatPosition('pdf', null)).toBe('');
    expect(formatPosition('text', { page: 1, total: 2 })).toBe('');
  });
});

describe('createRateLimiter', () => {
  it('allows one use per gap', () => {
    let now = 1000;
    const allowed = createRateLimiter(3000, () => now);
    expect(allowed()).toBe(true);
    now += 2999;
    expect(allowed()).toBe(false);
    now += 1;
    expect(allowed()).toBe(true);
  });
});
