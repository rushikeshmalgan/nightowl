import { act, renderHook } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Room } from './presence';
import { usePresence } from './usePresence';

type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

function fakeClient() {
  function makeChannel(name: string, opts: unknown) {
    const handlers: Record<string, () => void> = {};
    const channel = {
      name,
      opts,
      state: {} as Record<string, Array<{ room: Room }>>,
      statusCallback: null as null | ((status: Status) => void),
      on: vi.fn((_type: string, filter: { event: string }, handler: () => void) => {
        handlers[filter.event] = handler;
        return channel;
      }),
      subscribe: vi.fn((callback: (status: Status) => void) => {
        channel.statusCallback = callback;
        return channel;
      }),
      track: vi.fn(async (_payload: object) => 'ok'),
      presenceState: () => channel.state,
      sync: (state: Record<string, Array<{ room: Room }>>) => {
        channel.state = state;
        handlers.sync?.();
      },
      status: (status: Status) => channel.statusCallback?.(status),
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

afterEach(() => {
  vi.useRealTimers();
});

describe('usePresence', () => {
  it('stays in local mode without Supabase settings and makes no connection', () => {
    const getClient = vi.fn(() => null);
    const { result } = renderHook(() => usePresence('text', { getClient }));
    expect(result.current).toEqual({ status: 'offline', total: null, byRoom: null });
  });

  it('joins one anonymous channel and goes online when subscribed', async () => {
    const { client, channels } = fakeClient();
    const { result } = renderHook(() => usePresence('pdf', { getClient: () => client }));
    expect(result.current.status).toBe('connecting');
    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(channels[0].name).toBe('nightowl-presence');
    const key = (channels[0].opts as { config: { presence: { key: string } } }).config.presence.key;
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    act(() => channels[0].status('SUBSCRIBED'));
    expect(result.current.status).toBe('online');
  });

  it('shares only what kind of document is open, never its name', async () => {
    const { client, channels } = fakeClient();
    renderHook(() => usePresence('pdf', { getClient: () => client }));
    act(() => channels[0].status('SUBSCRIBED'));
    expect(channels[0].track).toHaveBeenCalledWith({ room: 'pdf' });
    for (const [payload] of channels[0].track.mock.calls) expect(Object.keys(payload)).toEqual(['room']);
  });

  it('shows the live count and breakdown on sync', () => {
    const { client, channels } = fakeClient();
    const { result } = renderHook(() => usePresence('text', { getClient: () => client }));
    act(() => channels[0].status('SUBSCRIBED'));
    act(() => channels[0].sync({ a: [{ room: 'pdf' }], b: [{ room: 'text' }], c: [{ room: 'text' }] }));
    expect(result.current).toEqual({ status: 'online', total: 3, byRoom: { pdf: 1, psd: 0, text: 2 } });
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'] as const)('falls back to local mode on %s and retries after a second', (status) => {
    vi.useFakeTimers();
    const { client, channels } = fakeClient();
    const { result } = renderHook(() => usePresence('text', { getClient: () => client }));
    act(() => channels[0].status(status));
    expect(result.current.status).toBe('offline');
    expect(result.current.total).toBeNull();
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(client.channel).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(client.channel).toHaveBeenCalledTimes(2);
    expect(client.removeChannel).toHaveBeenCalled();
  });

  it('goes to local mode when the browser goes offline', () => {
    const { client, channels } = fakeClient();
    const { result } = renderHook(() => usePresence('text', { getClient: () => client }));
    act(() => channels[0].status('SUBSCRIBED'));
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.status).toBe('offline');
  });

  it('reports a new room through the throttle', () => {
    vi.useFakeTimers();
    const { client, channels } = fakeClient();
    const { rerender } = renderHook(({ room }) => usePresence(room, { getClient: () => client }), {
      initialProps: { room: 'pdf' as Room },
    });
    act(() => channels[0].status('SUBSCRIBED'));
    rerender({ room: 'psd' });
    expect(channels[0].track).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(6500);
    });
    expect(channels[0].track).toHaveBeenLastCalledWith({ room: 'psd' });
  });

  it('does not loop when leaving a channel makes it report CLOSED', () => {
    vi.useFakeTimers();
    const { client, channels } = fakeClient();
    // Supabase calls the status callback with CLOSED while removing a channel.
    client.removeChannel.mockImplementation(async (channel: unknown) => {
      (channel as { status(s: Status): void }).status('CLOSED');
      return 'ok';
    });
    const { result } = renderHook(() => usePresence('text', { getClient: () => client }));
    act(() => channels[0].status('SUBSCRIBED'));
    expect(() =>
      act(() => {
        window.dispatchEvent(new Event('offline'));
      }),
    ).not.toThrow();
    expect(result.current.status).toBe('offline');
    expect(client.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('leaves the channel on unmount', () => {
    const { client } = fakeClient();
    const { unmount } = renderHook(() => usePresence('text', { getClient: () => client }));
    unmount();
    expect(client.removeChannel).toHaveBeenCalled();
  });
});
