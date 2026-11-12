export const LIMIT_BYTES = 500 * 1024 * 1024;

export interface EvictionCandidate {
  id: string;
  size: number;
  lastOpenedAt: number;
}

export interface EvictionPlan {
  /** Documents to delete, least recently opened first. */
  evictIds: string[];
  /** True when the library is still over the limit after every allowed eviction. */
  overLimit: boolean;
}

/**
 * Decides which documents to drop so the library fits in `limitBytes`.
 * The protected document (the one just imported) is never chosen, so a single
 * oversized import is kept and reported as over-limit instead of looping.
 */
export function planEviction(docs: EvictionCandidate[], protectedId: string | null, limitBytes: number): EvictionPlan {
  let total = docs.reduce((sum, doc) => sum + doc.size, 0);
  const evictIds: string[] = [];
  const candidates = docs.filter((doc) => doc.id !== protectedId).sort((a, b) => a.lastOpenedAt - b.lastOpenedAt);

  for (const doc of candidates) {
    if (total <= limitBytes) break;
    evictIds.push(doc.id);
    total -= doc.size;
  }

  return { evictIds, overLimit: total > limitBytes };
}
