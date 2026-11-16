import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { nextBackoffMs } from '../presence/presence';
import { getSupabase } from '../presence/supabase';
import { rerollNickname, sessionNickname } from './nickname';
import { generateRoomCode, parseRoomCode, roomChannelName } from './roomCode';
import {
  AWAY_AFTER_MS,
  NUDGES,
  NUDGE_GAP_MS,
  PROGRESS_GAP_MS,
  TIMER_CHOICES,
  createRateLimiter,
  membersFromPresence,
  parseProgress,
  shouldLeaveFullRoom,
} from './roomModel';
import type { DocKind, Member, MemberMeta, Progress } from './roomModel';

export type RoomPhase = 'idle' | 'joining' | 'joined' | 'full' | 'busy' | 'reconnecting';

/** What the app tells the room about the open document. */
export interface RoomLocal {
  doc: DocKind;
  fp: string;
  len: number;
  progress: Progress | null;
}

/** The shared focus timer; `endsAt` is on this device's clock. */
export interface RoomTimer {
  durationMs: number;
  endsAt: number;
}

export interface RoomNudge {
  id: number;
  from: string;
  emoji: string;
}

export interface RoomState {
  phase: RoomPhase;
  code: string | null;
  myKey: string;
  nick: string;
  members: Member[];
  timer: RoomTimer | null;
  /** True once a timer has run out, until the next one starts. */
  timerDone: boolean;
  nudges: RoomNudge[];
}

export interface RoomControls {
  create(): void;
  join(code: string): void;
  leave(): void;
  startTimer(minutes: 15 | 25 | 45): void;
  /** Stops the timer on this device only. */
  stopTimer(): void;
  sendNudge(emoji: string): void;
  rerollNick(): void;
}

export interface RoomDeps {
  getClient?: () => SupabaseClient | null;
  now?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

const PRESENCE_GAP_MS = 6500;
const AWAY_CHECK_MS = 15_000;
const NUDGE_SHOWN_MS = 4000;
const MAX_NUDGES_SHOWN = 5;
const HELLO_REPLY_GAP_MS = 2000;
const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;
const TIMER_LENGTHS_MS: readonly number[] = TIMER_CHOICES.map((minutes) => minutes * 60_000);

/**
 * Sends my presence at most once per gap (Supabase allows 5 presence calls per client per 30 seconds),
 * skipping repeats of what was already sent, and collapsing changes inside the gap into the latest.
 */
function createPresenceThrottle(send: (meta: MemberMeta) => Promise<unknown>) {
  let lastSent = Number.NEGATIVE_INFINITY;
  let lastJson: string | null = null;
  let pending: MemberMeta | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (meta: MemberMeta) => {
    lastSent = Date.now();
    lastJson = JSON.stringify(meta);
    void send(meta).catch(() => {
      // A failed update is retried with the next one.
    });
  };
  const reset = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
    lastSent = Number.NEGATIVE_INFINITY;
    lastJson = null;
  };
  return {
    push(meta: MemberMeta) {
      if (!timer && JSON.stringify(meta) === lastJson) return;
      const wait = lastSent + PRESENCE_GAP_MS - Date.now();
      if (wait <= 0 && !timer) {
        flush(meta);
        return;
      }
      pending = meta;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const next = pending;
        pending = null;
        if (next && JSON.stringify(next) !== lastJson) flush(next);
      }, Math.max(0, wait));
    },
    reset,
  };
}

interface Session {
  code: string;
  key: string;
  client: SupabaseClient;
  channel: RealtimeChannel | null;
  /** Has been in the room at least once, so a failure is a dropped connection and not a refusal. */
  joined: boolean;
  attempt: number;
  retry: ReturnType<typeof setTimeout> | null;
  progress: Record<string, Progress>;
  signatures: Record<string, string>;
  track: ReturnType<typeof createPresenceThrottle>;
  lastProgress: string | null;
  lastProgressAt: number;
  progressTimer: ReturnType<typeof setTimeout> | null;
  nudgeFrom: Map<string, () => boolean>;
  nudgeTo: () => boolean;
  hello: () => boolean;
}

/**
 * A reading room: who is in, where they are, a shared focus timer and a few emoji nudges. One Realtime
 * channel per room on the client the reader count already uses. Presence says who is here; broadcasts
 * carry progress, the timer, nudges and a hello for late joiners. Everything a stranger sends is checked.
 */
export function useRoom(local: RoomLocal, deps: RoomDeps = {}): RoomState & RoomControls {
  const getClient = deps.getClient ?? getSupabase;
  const now = deps.now ?? (() => Date.now());

  const [phase, setPhase] = useState<RoomPhase>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [myKey, setMyKey] = useState('');
  const [nick, setNick] = useState(() => sessionNickname(deps.storage));
  const [members, setMembers] = useState<Member[]>([]);
  const [timer, setTimer] = useState<RoomTimer | null>(null);
  const [timerDone, setTimerDone] = useState(false);
  const [nudges, setNudges] = useState<RoomNudge[]>([]);
  const [away, setAway] = useState(false);

  const session = useRef<Session | null>(null);
  const lastInput = useRef(0);
  const nudgeId = useRef(0);
  const membersRef = useRef<Member[]>([]);
  const localRef = useRef(local);
  localRef.current = local;
  const nickRef = useRef(nick);
  nickRef.current = nick;
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const awayRef = useRef(away);
  awayRef.current = away;

  const currentMeta = (): MemberMeta => ({
    nick: nickRef.current,
    doc: localRef.current.doc,
    fp: localRef.current.fp,
    len: localRef.current.len,
    status: timerRef.current ? 'focus' : awayRef.current ? 'away' : 'reading',
  });

  const broadcast = (s: Session, event: string, payload: Record<string, unknown>) => {
    void s.channel?.send({ type: 'broadcast', event, payload: { key: s.key, ...payload } })?.catch(() => {
      // A lost message is replaced by the next.
    });
  };

  /** Stops everything the session owns, without touching React state. */
  const endSession = (s: Session) => {
    if (s.retry) clearTimeout(s.retry);
    if (s.progressTimer) clearTimeout(s.progressTimer);
    s.retry = null;
    s.progressTimer = null;
    s.track.reset();
    // Forget the channel first: removing it makes Supabase report CLOSED, which must not look like a failure.
    const leaving = s.channel;
    s.channel = null;
    if (leaving) void s.client.removeChannel(leaving);
    if (session.current === s) session.current = null;
  };

  const resetState = () => {
    membersRef.current = [];
    setMembers([]);
    setTimer(null);
    setTimerDone(false);
    setNudges([]);
    setAway(false);
  };

  const publish = (s: Session) => {
    if (!s.channel) return;
    const state = s.channel.presenceState() as unknown as Record<string, unknown[]>;
    const list = membersFromPresence(state, s.key, s.progress).map((member) => (member.me ? { ...member, progress: localRef.current.progress } : member));
    membersRef.current = list;
    setMembers(list);
  };

  const sendProgressNow = (s: Session) => {
    const progress = localRef.current.progress;
    if (!progress) return;
    s.lastProgress = JSON.stringify(progress);
    s.lastProgressAt = now();
    broadcast(s, 'progress', progress as Record<string, unknown>);
  };

  /** Sends my place when it changed, at most once per gap; a change inside the gap goes out when it ends. */
  const pushProgress = (s: Session) => {
    const progress = localRef.current.progress;
    if (!s.joined || !s.channel || !progress || JSON.stringify(progress) === s.lastProgress) return;
    const wait = s.lastProgressAt + PROGRESS_GAP_MS - now();
    if (wait > 0) {
      if (!s.progressTimer) {
        s.progressTimer = setTimeout(() => {
          s.progressTimer = null;
          pushProgress(s);
        }, wait);
      }
      return;
    }
    sendProgressNow(s);
  };

  const showNudge = (from: string, emoji: string) => {
    const id = (nudgeId.current += 1);
    setNudges((list) => [...list.slice(-(MAX_NUDGES_SHOWN - 1)), { id, from, emoji }]);
    setTimeout(() => setNudges((list) => list.filter((nudge) => nudge.id !== id)), NUDGE_SHOWN_MS);
  };

  const onSync = (s: Session) => {
    if (!s.channel) return;
    const state = s.channel.presenceState() as unknown as Record<string, unknown[]>;
    if (shouldLeaveFullRoom(Object.keys(state), s.key)) {
      endSession(s);
      resetState();
      setPhase('full');
      return;
    }
    // What I knew of someone's place belongs to the document they had open.
    const present = membersFromPresence(state, s.key, {});
    const keys = new Set(present.map((member) => member.key));
    for (const member of present) {
      if (member.me) continue;
      const signature = `${member.doc}|${member.fp}|${member.len}`;
      if (s.signatures[member.key] !== undefined && s.signatures[member.key] !== signature) delete s.progress[member.key];
      s.signatures[member.key] = signature;
    }
    for (const key of Object.keys(s.progress)) {
      if (!keys.has(key)) {
        delete s.progress[key];
        delete s.signatures[key];
      }
    }
    publish(s);
  };

  const onBroadcast = (s: Session, event: string, payload: unknown) => {
    const message = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
    const from = message && typeof message.key === 'string' ? message.key : null;
    if (!message || !from || from === s.key) return;

    if (event === 'progress') {
      const progress = parseProgress(message);
      if (progress) {
        s.progress[from] = progress;
        publish(s);
      }
    } else if (event === 'timer') {
      const durationMs = message.durationMs;
      if (typeof durationMs !== 'number' || !TIMER_LENGTHS_MS.includes(durationMs)) return;
      let remaining = durationMs;
      if (message.remainingMs !== undefined) {
        const left = message.remainingMs;
        if (typeof left !== 'number' || !Number.isFinite(left) || left < 0 || left > durationMs) return;
        remaining = left;
      }
      setTimerDone(false);
      setTimer({ durationMs, endsAt: now() + remaining });
    } else if (event === 'nudge') {
      const emoji = message.emoji;
      if (typeof emoji !== 'string' || !(NUDGES as readonly string[]).includes(emoji)) return;
      let allowed = s.nudgeFrom.get(from);
      if (!allowed) {
        allowed = createRateLimiter(NUDGE_GAP_MS, now);
        s.nudgeFrom.set(from, allowed);
      }
      if (!allowed()) return;
      showNudge(membersRef.current.find((member) => member.key === from)?.nick ?? 'Someone', emoji);
    } else if (event === 'hello') {
      if (!s.hello()) return;
      sendProgressNow(s);
      const running = timerRef.current;
      if (running) broadcast(s, 'timer', { durationMs: running.durationMs, remainingMs: Math.max(0, running.endsAt - now()) });
    }
  };

  const handleDrop = (s: Session) => {
    if (session.current !== s) return;
    const old = s.channel;
    s.channel = null;
    if (old) void s.client.removeChannel(old);
    s.track.reset();
    if (!s.joined) {
      // Refused on the first try: a limit or a full server, not something retrying will fix soon.
      endSession(s);
      resetState();
      setPhase('busy');
      return;
    }
    setPhase('reconnecting');
    if (s.retry) return;
    s.retry = setTimeout(() => {
      s.retry = null;
      connect(s);
    }, nextBackoffMs(s.attempt));
    s.attempt += 1;
  };

  function connect(s: Session) {
    if (session.current !== s) return;
    const channel = s.client.channel(roomChannelName(s.code), { config: { presence: { key: s.key }, broadcast: { self: false } } });
    s.channel = channel;
    channel.on('presence', { event: 'sync' }, () => {
      if (s.channel === channel) onSync(s);
    });
    for (const event of ['progress', 'timer', 'nudge', 'hello']) {
      channel.on('broadcast', { event }, (message: { payload?: unknown }) => {
        if (s.channel === channel) onBroadcast(s, event, message.payload);
      });
    }
    channel.subscribe((status) => {
      if (s.channel !== channel) return;
      if (status === 'SUBSCRIBED') {
        s.attempt = 0;
        s.joined = true;
        s.lastProgress = null;
        lastInput.current = now();
        setPhase('joined');
        s.track.reset();
        s.track.push(currentMeta());
        broadcast(s, 'hello', {});
        pushProgress(s);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handleDrop(s);
      }
    });
  }

  const start = (roomCode: string, client: SupabaseClient) => {
    const s: Session = {
      code: roomCode,
      key: crypto.randomUUID(),
      client,
      channel: null,
      joined: false,
      attempt: 0,
      retry: null,
      progress: {},
      signatures: {},
      track: createPresenceThrottle((meta) => (session.current?.channel ? session.current.channel.track({ ...meta }) : Promise.resolve())),
      lastProgress: null,
      lastProgressAt: Number.NEGATIVE_INFINITY,
      progressTimer: null,
      nudgeFrom: new Map(),
      nudgeTo: createRateLimiter(NUDGE_GAP_MS, now),
      hello: createRateLimiter(HELLO_REPLY_GAP_MS, now),
    };
    session.current = s;
    lastInput.current = now();
    resetState();
    setCode(roomCode);
    setMyKey(s.key);
    setPhase('joining');
    connect(s);
  };

  const leave = () => {
    const s = session.current;
    if (s) endSession(s);
    resetState();
    setCode(null);
    setMyKey('');
    setPhase('idle');
  };

  const join = (input: string) => {
    const parsed = parseRoomCode(input);
    const client = getClient();
    if (!parsed || !client) return;
    const s = session.current;
    if (s) endSession(s);
    start(parsed, client);
  };

  const controls: RoomControls = {
    create: () => join(generateRoomCode()),
    join,
    leave,
    startTimer(minutes) {
      const s = session.current;
      if (!s?.joined || !TIMER_CHOICES.includes(minutes)) return;
      const durationMs = minutes * 60_000;
      setTimerDone(false);
      setTimer({ durationMs, endsAt: now() + durationMs });
      broadcast(s, 'timer', { durationMs });
    },
    stopTimer() {
      setTimer(null);
      setTimerDone(false);
    },
    sendNudge(emoji) {
      const s = session.current;
      if (!s?.joined || !(NUDGES as readonly string[]).includes(emoji) || !s.nudgeTo()) return;
      broadcast(s, 'nudge', { emoji });
    },
    rerollNick: () => setNick(rerollNickname(deps.storage)),
  };

  // Tell the room when what I share changes: the document, my nickname, being in focus or away.
  const status = timer ? 'focus' : away ? 'away' : 'reading';
  useEffect(() => {
    const s = session.current;
    if (s?.joined && s.channel) s.track.push(currentMeta());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.doc, local.fp, local.len, nick, status]);

  // My place: send it (rate limited) and show it in my own row.
  const progressJson = JSON.stringify(local.progress);
  useEffect(() => {
    const s = session.current;
    if (!s) return;
    pushProgress(s);
    publish(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressJson, phase]);

  // The timer running out is quiet: it just becomes "done".
  useEffect(() => {
    if (!timer) return;
    const ending = setTimeout(() => {
      setTimer(null);
      setTimerDone(true);
    }, Math.max(0, timer.endsAt - now()));
    return () => clearTimeout(ending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer]);

  // Away after 2 minutes without input, back on any input.
  useEffect(() => {
    if (phase !== 'joined') return;
    const onInput = () => {
      lastInput.current = now();
      setAway(false);
    };
    for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, { passive: true });
    window.addEventListener('scroll', onInput, { capture: true, passive: true });
    const check = setInterval(() => setAway(now() - lastInput.current >= AWAY_AFTER_MS), AWAY_CHECK_MS);
    return () => {
      for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput);
      window.removeEventListener('scroll', onInput, { capture: true });
      clearInterval(check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // The browser going offline is a dropped connection; coming back reconnects at once.
  useEffect(() => {
    if (!code) return;
    const onOffline = () => {
      const s = session.current;
      if (s) handleDrop(s);
    };
    const onOnline = () => {
      const s = session.current;
      if (!s || s.channel || !s.joined) return;
      if (s.retry) clearTimeout(s.retry);
      s.retry = null;
      connect(s);
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(
    () => () => {
      const s = session.current;
      if (s) endSession(s);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { phase, code, myKey, nick, members, timer, timerDone, nudges, ...controls };
}
