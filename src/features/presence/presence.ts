export type Room = 'pdf' | 'psd' | 'text' | 'none';

export interface PresenceSummary {
  total: number;
  byRoom: { pdf: number; psd: number; text: number };
}

/**
 * Counts readers from Supabase's presence state. Each key is one browser tab;
 * a tab that re-tracked has several entries, and its latest one counts.
 */
export function summarizePresence(state: Record<string, Array<{ room: Room }>>): PresenceSummary {
  const byRoom = { pdf: 0, psd: 0, text: 0 };
  let total = 0;
  for (const entries of Object.values(state)) {
    const latest = entries[entries.length - 1];
    if (!latest) continue;
    total += 1;
    if (latest.room === 'pdf' || latest.room === 'psd' || latest.room === 'text') byRoom[latest.room] += 1;
  }
  return { total, byRoom };
}

/** How long to wait before reconnecting: 1 s, 2 s, 4 s ... capped at 30 s. */
export function nextBackoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** attempt);
}

/**
 * Sends room updates no more often than once per `minGapMs`. Supabase's free
 * plan allows 5 presence calls per client per 30 seconds; 6.5 s keeps a margin. The first update
 * goes at once; updates inside the gap collapse into one with the latest room.
 */
export function createThrottledTracker(track: (payload: { room: Room }) => Promise<unknown>, minGapMs = 6500): (room: Room) => void {
  let lastSent = -Infinity;
  let pending: Room | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const send = (room: Room) => {
    lastSent = Date.now();
    void track({ room }).catch(() => {
      // A failed update is retried with the next one.
    });
  };

  return (room) => {
    const wait = lastSent + minGapMs - Date.now();
    if (wait <= 0 && !timer) {
      send(room);
      return;
    }
    pending = room;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (pending) send(pending);
      pending = null;
    }, Math.max(0, wait));
  };
}
