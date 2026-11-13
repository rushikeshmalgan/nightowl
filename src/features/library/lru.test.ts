// @vitest-environment node
import { LIMIT_BYTES, planEviction } from './lru';

const doc = (id: string, size: number, lastOpenedAt: number) => ({ id, size, lastOpenedAt });

describe('planEviction', () => {
  it('uses a 500 MB limit', () => {
    expect(LIMIT_BYTES).toBe(500 * 1024 * 1024);
  });

  it('evicts nothing when under the limit', () => {
    expect(planEviction([doc('a', 200, 1), doc('b', 200, 2)], null, 500)).toEqual({ evictIds: [], overLimit: false });
  });

  it('evicts nothing when exactly at the limit', () => {
    expect(planEviction([doc('a', 250, 1), doc('b', 250, 2)], null, 500)).toEqual({ evictIds: [], overLimit: false });
  });

  it('evicts the least recently opened document first, and only as many as needed', () => {
    const docs = [doc('newest', 200, 30), doc('oldest', 200, 10), doc('middle', 200, 20)];
    expect(planEviction(docs, null, 500)).toEqual({ evictIds: ['oldest'], overLimit: false });
  });

  it('keeps evicting until the total fits', () => {
    const docs = [doc('a', 200, 1), doc('b', 200, 2), doc('c', 200, 3), doc('d', 200, 4)];
    expect(planEviction(docs, null, 500)).toEqual({ evictIds: ['a', 'b'], overLimit: false });
  });

  it('never evicts the protected document, even when it is the oldest', () => {
    const docs = [doc('just-imported', 200, 1), doc('b', 200, 2), doc('c', 200, 3)];
    const plan = planEviction(docs, 'just-imported', 500);
    expect(plan.evictIds).toEqual(['b']);
    expect(plan.overLimit).toBe(false);
  });

  it('reports over-limit when one protected document alone exceeds the limit', () => {
    expect(planEviction([doc('huge', 600, 1)], 'huge', 500)).toEqual({ evictIds: [], overLimit: true });
  });

  it('evicts everything else and still reports over-limit when the protected document is too big', () => {
    const docs = [doc('huge', 600, 5), doc('a', 100, 1), doc('b', 100, 2)];
    expect(planEviction(docs, 'huge', 500)).toEqual({ evictIds: ['a', 'b'], overLimit: true });
  });

  it('handles an empty library', () => {
    expect(planEviction([], null, 500)).toEqual({ evictIds: [], overLimit: false });
  });
});
