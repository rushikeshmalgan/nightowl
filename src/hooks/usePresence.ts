import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createThrottledTracker, nextBackoffMs, summarizePresence } from '../lib/presence';
import type { PresenceSummary, Room } from '../lib/presence';
import { getSupabase } from '../lib/supabase';

export interface Presence {
  status: 'connecting' | 'online' | 'offline';
  total: number | null;
  byRoom: PresenceSummary['byRoom'] | null;
}

const OFFLINE: Presence = { status: 'offline', total: null, byRoom: null };
const CHANNEL = 'nightowl-presence';

/**
 * How many people are reading right now, from one Supabase presence channel.
 * Each tab joins with a random key and shares only the kind of document open.
 * Without Supabase settings, or when the connection fails, it reports local mode
 * and retries with a growing delay.
 */
export function usePresence(room: Room, deps: { getClient?: () => SupabaseClient | null } = {}): Presence {
  const getClient = deps.getClient ?? getSupabase;
  const [presence, setPresence] = useState<Presence>(() => (getClient() ? { status: 'connecting', total: null, byRoom: null } : OFFLINE));
  const roomRef = useRef(room);
  roomRef.current = room;
  const trackRef = useRef<((room: Room) => void) | null>(null);

  useEffect(() => {
    const client = getClient();
    if (!client) {
      setPresence(OFFLINE);
      return;
    }

    let channel: RealtimeChannel | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;
    const key = crypto.randomUUID();

    const leave = () => {
      // Forget the channel first: removing it makes Supabase report CLOSED,
      // which must not be treated as a new failure.
      const leaving = channel;
      channel = null;
      trackRef.current = null;
      if (leaving) void client.removeChannel(leaving);
    };

    const scheduleRetry = () => {
      if (stopped || retry) return;
      retry = setTimeout(() => {
        retry = null;
        connect();
      }, nextBackoffMs(attempt));
      attempt += 1;
    };

    const goOffline = () => {
      setPresence(OFFLINE);
      leave();
      scheduleRetry();
    };

    function connect() {
      if (stopped) return;
      setPresence({ status: 'connecting', total: null, byRoom: null });
      const joined = client!.channel(CHANNEL, { config: { presence: { key } } });
      channel = joined;
      joined.on('presence', { event: 'sync' }, () => {
        const summary = summarizePresence(joined.presenceState() as unknown as Record<string, Array<{ room: Room }>>);
        setPresence({ status: 'online', ...summary });
      });
      joined.subscribe((status) => {
        if (joined !== channel) return;
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          setPresence((current) => ({ ...current, status: 'online' }));
          // Only the kind of document is shared, never its name.
          const track = createThrottledTracker((payload) => joined.track({ room: payload.room }));
          trackRef.current = track;
          track(roomRef.current);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          goOffline();
        }
      });
    }

    const onOffline = () => goOffline();
    const onOnline = () => {
      if (!channel && !retry) connect();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    connect();

    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      leave();
    };
    // getClient is a dependency injection point, stable for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tell the channel when the reader opens a different kind of document.
  useEffect(() => {
    trackRef.current?.(room);
  }, [room]);

  return presence;
}
