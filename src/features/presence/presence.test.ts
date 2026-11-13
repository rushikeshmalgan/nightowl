import { createThrottledTracker, nextBackoffMs, summarizePresence } from './presence';
import type { Room } from './presence';

function presenceState(counts: Partial<Record<Room, number>>) {
  const state: Record<string, Array<{ room: Room }>> = {};
  let n = 0;
  for (const [room, count] of Object.entries(counts) as Array<[Room, number]>) {
    for (let i = 0; i < count; i++) state[`k${n++}`] = [{ room }];
  }
  return state;
}

describe('summarizePresence', () => {
  it('counts readers and breaks them down by what they are reading', () => {
    expect(summarizePresence(presenceState({ pdf: 12, psd: 3, text: 8 }))).toEqual({ total: 23, byRoom: { pdf: 12, psd: 3, text: 8 } });
  });

  it('counts each reader once, using their latest entry', () => {
    expect(summarizePresence({ a: [{ room: 'pdf' }, { room: 'text' }] })).toEqual({ total: 1, byRoom: { pdf: 0, psd: 0, text: 1 } });
  });

  it('counts readers with nothing open in the total only', () => {
    expect(summarizePresence(presenceState({ none: 2, pdf: 1 }))).toEqual({ total: 3, byRoom: { pdf: 1, psd: 0, text: 0 } });
  });

  it('ignores unknown rooms and empty entries', () => {
    expect(summarizePresence({ a: [], b: [{ room: 'cinema' as Room }] })).toEqual({ total: 1, byRoom: { pdf: 0, psd: 0, text: 0 } });
  });
});

describe('nextBackoffMs', () => {
  it('doubles from one second up to thirty', () => {
    expect(nextBackoffMs(0)).toBe(1000);
    expect(nextBackoffMs(3)).toBe(8000);
    expect(nextBackoffMs(10)).toBe(30000);
  });
});

describe('createThrottledTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the first update at once and folds the rest into one trailing update', () => {
    const track = vi.fn(async () => {});
    const send = createThrottledTracker(track, 6000);
    send('pdf');
    send('psd');
    send('text');
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenLastCalledWith({ room: 'pdf' });
    vi.advanceTimersByTime(6000);
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenLastCalledWith({ room: 'text' });
  });

  it('sends immediately again once the gap has passed', () => {
    const track = vi.fn(async () => {});
    const send = createThrottledTracker(track, 6000);
    send('pdf');
    vi.advanceTimersByTime(7000);
    send('text');
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('keeps to five calls per thirty seconds by default', () => {
    const track = vi.fn(async () => {});
    const send = createThrottledTracker(track);
    for (let second = 0; second < 30; second++) {
      send(second % 2 === 0 ? 'pdf' : 'text');
      vi.advanceTimersByTime(1000);
    }
    expect(track.mock.calls.length).toBeLessThanOrEqual(5);
  });
});
