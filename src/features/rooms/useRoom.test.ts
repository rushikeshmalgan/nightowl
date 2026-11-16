import { act, renderHook } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AWAY_AFTER_MS, NUDGE_GAP_MS } from './roomModel';
import { useRoom } from './useRoom';
import type { RoomLocal } from './useRoom';

type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
type Handler = (arg: unknown) => void;

function fakeClient() {
  function makeChannel(name: string, opts: unknown) {
    const handlers = new Map<string, Handler>();
    const channel = {
      name,
      opts,
      state: {} as Record<string, unknown[]>,
      statusCallback: null as null | ((status: Status) => void),
      on: vi.fn((type: string, filter: { event: string }, handler: Handler) => {
        handlers.set(`${type}:${filter.event}`, handler);
        return channel;
      }),
      subscribe: vi.fn((callback: (status: Status) => void) => {
        channel.statusCallback = callback;
        return channel;
      }),
      track: vi.fn(async (_payload: unknown) => 'ok'),
      send: vi.fn(async (_message: { type: string; event: string; payload: unknown }) => 'ok'),
      presenceState: () => channel.state,
      sync: (state: Record<string, unknown[]>) => {
        channel.state = state;
        handlers.get('presence:sync')?.({});
      },
      deliver: (event: string, payload: unknown) => handlers.get(`broadcast:${event}`)?.({ type: 'broadcast', event, payload }),
      status: (status: Status) => channel.statusCallback?.(status),
      sent: (event: string) => channel.send.mock.calls.filter(([message]) => message.event === event).map(([message]) => message.payload as Record<string, unknown>),
      lastTrack: () => channel.track.mock.calls[channel.track.mock.calls.length - 1]?.[0] as Record<string, unknown> | undefined,
    };
    return channel;
  }
  const channels: Array<ReturnType<typeof makeChannel>> = [];
  const client = {
    channel: vi.fn((name: string, opts: unknown) => {
      const created = makeChannel(name, opts);
      channels.push(created);
      return created;
    }),
    removeChannel: vi.fn(async (_channel: unknown) => 'ok'),
  };
  return { client: client as unknown as SupabaseClient & typeof client, channels };
}

const CODE = '4F2K9X';
const OTHER = '11111111-1111-4111-8111-111111111111';
const meta = (over: Record<string, unknown> = {}) => ({ nick: 'Amber Finch', doc: 'pdf', fp: 'abcdef0123456789', len: 40, status: 'reading', ...over });
const local = (over: Partial<RoomLocal> = {}): RoomLocal => ({ doc: 'pdf', fp: 'abcdef0123456789', len: 40, progress: { page: 3, total: 40 }, ...over });
const storage = { getItem: () => 'Quiet Owl', setItem: () => {} };

function setup(initial: RoomLocal = local()) {
  const { client, channels } = fakeClient();
  const hook = renderHook(({ current }) => useRoom(current, { getClient: () => client, storage }), { initialProps: { current: initial } });
  const join = (code = CODE) => {
    act(() => hook.result.current.join(code));
    return channels[channels.length - 1];
  };
  const joined = (code = CODE) => {
    const channel = join(code);
    act(() => channel.status('SUBSCRIBED'));
    return channel;
  };
  const withLocal = (next: RoomLocal) => hook.rerender({ current: next });
  return { client, channels, hook, join, joined, withLocal, room: () => hook.result.current };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useRoom joining', () => {
  it('stays idle without Supabase settings', () => {
    const hook = renderHook(() => useRoom(local(), { getClient: () => null, storage }));
    act(() => hook.result.current.join(CODE));
    act(() => hook.result.current.create());
    expect(hook.result.current.phase).toBe('idle');
    expect(hook.result.current.code).toBeNull();
  });

  it('creates a room on a channel named after a generated code, with its own random key', () => {
    const { client, channels, hook } = setup();
    act(() => hook.result.current.create());
    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(channels[0].name).toMatch(/^nightowl-room:[A-HJKMNP-Z2-9]{6}$/);
    expect(hook.result.current.code).toBe(channels[0].name.split(':')[1]);
    const config = (channels[0].opts as { config: { presence: { key: string }; broadcast: { self: boolean } } }).config;
    expect(config.presence.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(config.broadcast.self).toBe(false);
    expect(hook.result.current.phase).toBe('joining');
    act(() => channels[0].status('SUBSCRIBED'));
    expect(hook.result.current.phase).toBe('joined');
  });

  it('joins with a code however it was typed, and ignores one that is not a code', () => {
    const { channels, hook, join } = setup();
    join(' owl-4f2 k9x ');
    expect(channels[0].name).toBe('nightowl-room:4F2K9X');
    act(() => hook.result.current.leave());
    act(() => hook.result.current.join('nope'));
    expect(channels).toHaveLength(1);
    expect(hook.result.current.phase).toBe('idle');
  });

  it('leaves the old room when joining another', () => {
    const { client, channels, join } = setup();
    join('4F2K9X');
    join('AAAAAA');
    expect(channels).toHaveLength(2);
    expect(client.removeChannel).toHaveBeenCalledWith(channels[0]);
  });

  it('leaves cleanly: removes the channel and forgets everything', () => {
    const { client, channels, hook, joined } = setup();
    joined();
    act(() => channels[0].sync({ [hook.result.current.myKey]: [meta()], [OTHER]: [meta()] }));
    expect(hook.result.current.members).toHaveLength(2);
    act(() => hook.result.current.leave());
    expect(client.removeChannel).toHaveBeenCalledWith(channels[0]);
    expect(hook.result.current).toMatchObject({ phase: 'idle', code: null, members: [], timer: null, nudges: [] });
  });

  it('removes the channel when the component unmounts', () => {
    const { client, channels, hook, joined } = setup();
    joined();
    hook.unmount();
    expect(client.removeChannel).toHaveBeenCalledWith(channels[0]);
  });
});

describe('useRoom presence and members', () => {
  it('shares exactly nick, doc, fp, len and status', () => {
    const { joined } = setup();
    const channel = joined();
    expect(channel.track).toHaveBeenCalledTimes(1);
    expect(channel.lastTrack()).toEqual({ nick: 'Quiet Owl', doc: 'pdf', fp: 'abcdef0123456789', len: 40, status: 'reading' });
    expect(Object.keys(channel.lastTrack() ?? {}).sort()).toEqual(['doc', 'fp', 'len', 'nick', 'status']);
  });

  it('lists the people in the room, me first, with my own progress', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => channel.sync({ [OTHER]: [meta()], [hook.result.current.myKey]: [meta({ nick: 'Quiet Owl' })] }));
    const { members } = hook.result.current;
    expect(members.map((m) => m.nick)).toEqual(['Quiet Owl', 'Amber Finch']);
    expect(members[0]).toMatchObject({ me: true, progress: { page: 3, total: 40 } });
  });

  it('tells the others when I open another document, and drops my old progress', () => {
    const { hook, joined, withLocal } = setup();
    const channel = joined();
    act(() => channel.sync({ [hook.result.current.myKey]: [meta({ nick: 'Quiet Owl' })] }));
    withLocal(local({ doc: 'text', fp: '1111111111111111', len: 900, progress: null }));
    act(() => {
      vi.advanceTimersByTime(6500);
    });
    expect(channel.lastTrack()).toMatchObject({ doc: 'text', fp: '1111111111111111', len: 900 });
    expect(hook.result.current.members[0].progress).toBeNull();
  });

  it('clears what I knew of a member when their document changes', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => channel.sync({ [OTHER]: [meta()] }));
    act(() => channel.deliver('progress', { key: OTHER, page: 2, total: 9 }));
    expect(hook.result.current.members[0].progress).toEqual({ page: 2, total: 9 });
    act(() => channel.sync({ [OTHER]: [meta({ fp: '2222222222222222', len: 9 })] }));
    expect(hook.result.current.members[0].progress).toBeNull();
  });

  it('shows one entry per person even when presence holds the same key twice', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => channel.sync({ [OTHER]: [meta({ nick: 'Old Name' }), meta({ nick: 'New Name' })] }));
    expect(hook.result.current.members.map((m) => m.nick)).toEqual(['New Name']);
  });
});

describe('useRoom progress', () => {
  it('sends my place once at once, never again unchanged, and later changes after the 10 second gap', () => {
    const { joined, withLocal } = setup();
    const channel = joined();
    expect(channel.sent('progress')).toHaveLength(1);
    expect(channel.sent('progress')[0]).toMatchObject({ page: 3, total: 40 });
    expect(typeof channel.sent('progress')[0].key).toBe('string');
    withLocal(local({ progress: { page: 3, total: 40 } }));
    expect(channel.sent('progress')).toHaveLength(1);
    withLocal(local({ progress: { page: 4, total: 40 } }));
    expect(channel.sent('progress')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(9999);
    });
    expect(channel.sent('progress')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(channel.sent('progress')).toHaveLength(2);
    expect(channel.sent('progress')[1]).toMatchObject({ page: 4 });
  });

  it('says hello once after subscribing, and answers a hello with my place and a running timer', () => {
    const { hook, joined } = setup();
    const channel = joined();
    expect(channel.sent('hello')).toHaveLength(1);
    act(() => hook.result.current.startTimer(25));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const before = channel.sent('progress').length;
    act(() => channel.deliver('hello', { key: OTHER }));
    expect(channel.sent('progress').length).toBe(before + 1);
    const timers = channel.sent('timer');
    expect(timers[timers.length - 1]).toMatchObject({ durationMs: 1_500_000, remainingMs: 1_440_000 });
  });

  it('does not answer a flood of hellos', () => {
    const { joined } = setup();
    const channel = joined();
    const before = channel.sent('progress').length;
    act(() => {
      for (let i = 0; i < 5; i++) channel.deliver('hello', { key: OTHER });
    });
    expect(channel.sent('progress').length).toBe(before + 1);
  });
});

describe('useRoom focus timer', () => {
  it('starts for everyone, counts down, shows me in focus and ends quietly', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => hook.result.current.startTimer(25));
    expect(channel.sent('timer')[0]).toMatchObject({ durationMs: 1_500_000 });
    expect(hook.result.current.timer?.durationMs).toBe(1_500_000);
    act(() => {
      vi.advanceTimersByTime(6500);
    });
    expect(channel.lastTrack()).toMatchObject({ status: 'focus' });
    act(() => {
      vi.advanceTimersByTime(1_500_000);
    });
    expect(hook.result.current.timer).toBeNull();
    expect(hook.result.current.timerDone).toBe(true);
    // Nobody touched the screen for 25 minutes, so I am away by now; what matters is that I am no longer in focus.
    expect(channel.lastTrack()).not.toMatchObject({ status: 'focus' });
  });

  it('follows a timer someone else starts, from when it arrives or from the time left', () => {
    const { hook, joined } = setup();
    const channel = joined();
    const start = Date.now();
    act(() => channel.deliver('timer', { key: OTHER, durationMs: 900_000 }));
    expect(hook.result.current.timer).toEqual({ durationMs: 900_000, endsAt: start + 900_000 });
    act(() => channel.deliver('timer', { key: OTHER, durationMs: 1_500_000, remainingMs: 600_000 }));
    expect(hook.result.current.timer).toEqual({ durationMs: 1_500_000, endsAt: start + 600_000 });
  });

  it('ignores timers of a length nobody can choose, or with impossible time left', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => channel.deliver('timer', { key: OTHER, durationMs: 12_345 }));
    act(() => channel.deliver('timer', { key: OTHER, durationMs: 900_000, remainingMs: 999_999_999 }));
    expect(hook.result.current.timer).toBeNull();
  });

  it('lets me stop it for myself without telling the others', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => hook.result.current.startTimer(15));
    act(() => hook.result.current.stopTimer());
    expect(hook.result.current.timer).toBeNull();
    expect(hook.result.current.timerDone).toBe(false);
    expect(channel.sent('timer')).toHaveLength(1);
  });
});

describe('useRoom nudges', () => {
  it('shows a nudge with the sender name, and drops a second one inside 3 seconds', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => channel.sync({ [OTHER]: [meta()] }));
    act(() => channel.deliver('nudge', { key: OTHER, emoji: '🔥' }));
    expect(hook.result.current.nudges).toMatchObject([{ from: 'Amber Finch', emoji: '🔥' }]);
    act(() => channel.deliver('nudge', { key: OTHER, emoji: '👋' }));
    expect(hook.result.current.nudges).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(NUDGE_GAP_MS);
    });
    act(() => channel.deliver('nudge', { key: OTHER, emoji: '👋' }));
    expect(hook.result.current.nudges.some((n) => n.emoji === '👋')).toBe(true);
  });

  it('lets a nudge fade after a few seconds', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => channel.deliver('nudge', { key: OTHER, emoji: '🌙' }));
    expect(hook.result.current.nudges).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(hook.result.current.nudges).toHaveLength(0);
  });

  it('only sends the four emoji, and at most one per 3 seconds', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => hook.result.current.sendNudge('💥'));
    expect(channel.sent('nudge')).toHaveLength(0);
    act(() => hook.result.current.sendNudge('🔥'));
    act(() => hook.result.current.sendNudge('☕'));
    expect(channel.sent('nudge')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(NUDGE_GAP_MS);
    });
    act(() => hook.result.current.sendNudge('☕'));
    expect(channel.sent('nudge')).toHaveLength(2);
    expect(channel.sent('nudge')[1]).toMatchObject({ emoji: '☕' });
  });
});

describe('useRoom full rooms', () => {
  const nineKeys = (mine: string) => {
    const state: Record<string, unknown[]> = { [mine]: [meta({ nick: 'Quiet Owl' })] };
    for (let i = 1; i <= 8; i++) state[`5555555${i}-5555-4555-8555-555555555555`] = [meta({ nick: `Bird ${i}` })];
    return state;
  };

  it('has the member whose key sorts last leave a ninth seat', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('ffffffff-ffff-4fff-8fff-ffffffffffff');
    const { client, channels, hook, joined } = setup();
    joined();
    act(() => channels[0].sync(nineKeys(hook.result.current.myKey)));
    expect(hook.result.current.phase).toBe('full');
    expect(client.removeChannel).toHaveBeenCalledWith(channels[0]);
    expect(hook.result.current.members).toEqual([]);
  });

  it('keeps a member whose key sorts first', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
    const { client, channels, hook, joined } = setup();
    joined();
    act(() => channels[0].sync(nineKeys(hook.result.current.myKey)));
    expect(hook.result.current.phase).toBe('joined');
    expect(client.removeChannel).not.toHaveBeenCalled();
  });
});

describe('useRoom connection trouble', () => {
  it('says the room is busy when the first join is refused, without retrying', () => {
    const { client, channels, hook, join } = setup();
    join();
    act(() => channels[0].status('CHANNEL_ERROR'));
    expect(hook.result.current.phase).toBe('busy');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(client.channel).toHaveBeenCalledTimes(1);
  });

  it('reconnects with the same key after a drop, and nobody appears twice', () => {
    const { client, channels, hook, joined } = setup();
    joined();
    const key = hook.result.current.myKey;
    act(() => channels[0].status('TIMED_OUT'));
    expect(hook.result.current.phase).toBe('reconnecting');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(client.channel).toHaveBeenCalledTimes(2);
    expect((channels[1].opts as { config: { presence: { key: string } } }).config.presence.key).toBe(key);
    act(() => channels[1].status('SUBSCRIBED'));
    expect(hook.result.current.phase).toBe('joined');
    act(() => channels[1].sync({ [key]: [meta({ nick: 'Quiet Owl' }), meta({ nick: 'Quiet Owl' })], [OTHER]: [meta()] }));
    expect(hook.result.current.members).toHaveLength(2);
  });

  it('does not loop when leaving makes the channel report CLOSED', () => {
    const { client, channels, hook, joined } = setup();
    client.removeChannel.mockImplementation(async (channel: unknown) => {
      (channel as { status(s: Status): void }).status('CLOSED');
      return 'ok';
    });
    joined();
    act(() => hook.result.current.leave());
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(channels).toHaveLength(1);
    expect(hook.result.current.phase).toBe('idle');
  });
});

describe('useRoom messages from strangers', () => {
  it('ignores payloads that are malformed, out of range or claim to be me', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => channel.sync({ [OTHER]: [meta()] }));
    const bad: Array<[string, unknown]> = [
      ['progress', { key: 5, page: 1, total: 2 }],
      ['progress', { key: OTHER, page: 99, total: 40 }],
      ['progress', { key: OTHER, offset: 5, length: 3 }],
      ['progress', null],
      ['progress', { key: hook.result.current.myKey, page: 1, total: 2 }],
      ['timer', { key: OTHER, durationMs: 'x' }],
      ['timer', { durationMs: 900_000 }],
      ['nudge', { key: OTHER, emoji: '💥' }],
      ['nudge', 'hi'],
    ];
    for (const [event, payload] of bad) act(() => channel.deliver(event, payload));
    expect(hook.result.current.members.find((m) => !m.me)?.progress).toBeNull();
    expect(hook.result.current.timer).toBeNull();
    expect(hook.result.current.nudges).toEqual([]);
  });

  it('never shows markup as anything but text', () => {
    const { hook, joined } = setup();
    const channel = joined();
    act(() => channel.sync({ [OTHER]: [meta({ nick: '<b>x</b>' })] }));
    expect(hook.result.current.members[0].nick).toBe('<b>x</b>');
  });
});

describe('useRoom being away', () => {
  it('shows me away after 2 minutes without input, and back on any input', () => {
    const { joined } = setup();
    const channel = joined();
    act(() => {
      vi.advanceTimersByTime(AWAY_AFTER_MS + 15_000);
    });
    expect(channel.lastTrack()).toMatchObject({ status: 'away' });
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    act(() => {
      vi.advanceTimersByTime(6500);
    });
    expect(channel.lastTrack()).toMatchObject({ status: 'reading' });
  });
});
