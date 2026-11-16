import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatCountdown } from '../audio/AudioPanel';
import { SheetHandle } from '../shell/SheetHandle';
import { SHEET_LAYOUT } from '../shell/sheet';
import { formatRoomCode, parseRoomCode, roomLink } from './roomCode';
import { NUDGES, TIMER_CHOICES, formatPosition, formatTarget, jumpTargetOf, movedAway, sameDocument } from './roomModel';
import type { JumpTarget, Member } from './roomModel';
import type { RoomControls, RoomState } from './useRoom';

export type { JumpTarget };

export interface RoomPanelProps {
  room: RoomState & RoomControls;
  /** False in local mode or offline: rooms need a connection. */
  online: boolean;
  /** Where I am in my document now, so a jump can offer a way back. */
  me: JumpTarget | null;
  onGoTo(target: JumpTarget): void;
  /** A code from a `#room=` link: ask before joining it. */
  pendingCode?: string | null;
  onPendingHandled(): void;
  onClose(): void;
}

const DOC_LABEL = { pdf: 'PDF', psd: 'PSD', text: 'Text', none: '' } as const;

/** 44px touch targets on a phone, 32px from `sm` up. */
const button =
  'motion-color flex h-11 shrink-0 items-center justify-center rounded border border-line px-3 text-xs text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40 sm:h-8';

/** Someone who jumped to another reader's place: where they came from, where they landed, and whether they got there. */
interface Jump {
  key: string;
  from: JumpTarget | null;
  landed: JumpTarget;
  arrived: boolean;
}

/** The Rooms panel: a bottom sheet on a phone, a drawer beside the rail from `sm` up. */
export function RoomPanel({ room, online, me, onGoTo, pendingCode, onPendingHandled, onClose }: RoomPanelProps) {
  const [codeText, setCodeText] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shownLink, setShownLink] = useState<string | null>(null);
  const [jump, setJump] = useState<Jump | null>(null);
  const [, setTick] = useState(0);

  const myMember = room.members.find((member) => member.me);
  const myFp = myMember?.fp ?? '';
  const previousFp = useRef(myFp);

  // Opening another document ends any way back: it belonged to the old one.
  useEffect(() => {
    if (previousFp.current !== myFp) setJump(null);
    previousFp.current = myFp;
  }, [myFp]);

  // The way back stays until the reader has arrived at the other place and then moved on from it.
  useEffect(() => {
    setJump((current) => {
      if (!current || !me || me.kind !== current.landed.kind) return current;
      const there = !movedAway(current.landed, me);
      if (there && !current.arrived) return { ...current, arrived: true };
      if (!there && current.arrived) return null;
      return current;
    });
  }, [me]);

  // A running timer redraws once a second.
  const timerRunning = room.timer !== null;
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const joinTyped = () => {
    const parsed = parseRoomCode(codeText);
    if (!parsed) {
      setCodeError(true);
      return;
    }
    setCodeError(false);
    room.join(parsed);
  };

  const copyLink = async (code: string) => {
    const link = roomLink(code, window.location.href);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an insecure page, say): show the link to copy by hand.
      setShownLink(link);
    }
  };

  const goTo = (member: Member, target: JumpTarget) => {
    setJump({ key: member.key, from: me, landed: target, arrived: false });
    onGoTo(target);
  };

  const phase = room.phase;
  const inRoom = phase === 'joined' || phase === 'reconnecting';
  const showPending = pendingCode && !(inRoom && room.code === pendingCode);

  const memberRow = (member: Member) => {
    const target = jumpTargetOf(member.doc, member.progress);
    const same = myMember !== undefined && !member.me && sameDocument(myMember, member);
    const way = jump && jump.key === member.key && jump.from ? jump.from : null;
    return (
      <li key={member.key} className="flex flex-col gap-1 border-b border-line px-3 py-2 text-xs">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-medium text-ink">{member.me ? 'You' : member.nick}</span>
          {member.doc !== 'none' ? <span className="text-[10px] uppercase tracking-wider text-muted">{DOC_LABEL[member.doc]}</span> : null}
          <span className="font-mono text-[11px] tabular-nums text-muted">{formatPosition(member.doc, member.progress)}</span>
          <span className="text-[11px] text-muted">{member.status}</span>
        </div>
        {same ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-accent">same document as you</span>
            {way ? (
              <button
                type="button"
                className={button}
                onClick={() => {
                  setJump(null);
                  onGoTo(way);
                }}
              >
                Back to {formatTarget(way)}
              </button>
            ) : target ? (
              <button type="button" className={button} onClick={() => goTo(member, target)}>
                Go to {formatTarget(target)}
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  let body: React.ReactNode;
  if (!online && phase === 'idle') {
    body = <p className="px-3 py-4 text-xs text-muted">Rooms need a connection</p>;
  } else if (phase === 'joining') {
    body = <p role="status" className="px-3 py-4 text-xs text-muted">Joining…</p>;
  } else if (inRoom && room.code) {
    const left = room.timer ? Math.max(0, room.timer.endsAt - Date.now()) : 0;
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          <span className="font-mono text-sm tracking-wider text-ink">{formatRoomCode(room.code)}</span>
          <button type="button" className={button} onClick={() => void copyLink(room.code!)}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        {shownLink ? <input readOnly aria-label="Room link" value={shownLink} onFocus={(event) => event.currentTarget.select()} className="mx-3 mt-2 rounded border border-line bg-transparent px-2 py-1 text-[11px] text-ink" /> : null}
        {phase === 'reconnecting' ? <p role="status" className="px-3 py-2 text-xs text-muted">Reconnecting…</p> : null}
        <ul className="border-t border-line">{room.members.map(memberRow)}</ul>

        <div className="flex flex-col gap-2 border-b border-line px-3 py-3">
          <h3 className="text-[10px] uppercase tracking-wider text-muted">Focus together</h3>
          {room.timer ? (
            <div className="flex items-center gap-2">
              <span role="timer" aria-label="Focus time left" className="font-mono text-lg tabular-nums text-ink">
                {formatCountdown(left)}
              </span>
              <button type="button" className={button} onClick={room.stopTimer}>
                Stop timer
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {TIMER_CHOICES.map((minutes) => (
                <button key={minutes} type="button" className={button} onClick={() => room.startTimer(minutes)}>
                  {minutes} min
                </button>
              ))}
            </div>
          )}
          {room.timerDone ? <p role="status" className="text-xs text-accent">Focus complete</p> : null}
        </div>

        <div className="flex flex-col gap-2 border-b border-line px-3 py-3">
          <div className="flex flex-wrap gap-2">
            {NUDGES.map((emoji) => (
              <button key={emoji} type="button" aria-label={`Send ${emoji}`} className={`${button} w-11`} onClick={() => room.sendNudge(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
          {room.nudges.map((nudge) => (
            <p key={nudge.id} className="text-xs text-muted">
              {nudge.from} {nudge.emoji}
            </p>
          ))}
        </div>

        <div className="px-3 py-3">
          <button type="button" className={button} onClick={room.leave}>
            Leave room
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <div className="flex flex-col gap-3 px-3 py-3">
        {phase === 'full' ? <p role="alert" className="text-xs text-red-400">This room is full</p> : null}
        {phase === 'busy' ? <p role="alert" className="text-xs text-red-400">This room is busy, try again in a moment</p> : null}
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>
            You will appear as <span className="text-ink">{room.nick}</span>
          </span>
          <button type="button" aria-label="New nickname" className={`${button} w-11`} onClick={room.rerollNick}>
            <RefreshCw size={14} strokeWidth={1.75} />
          </button>
        </p>
        <button type="button" className={`${button} text-ink`} onClick={room.create}>
          Create a room
        </button>
        <div className="flex gap-2">
          <input
            aria-label="Room code"
            placeholder="OWL-4F2K9X"
            value={codeText}
            onChange={(event) => {
              setCodeText(event.target.value);
              setCodeError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') joinTyped();
            }}
            className="h-11 min-w-0 flex-1 rounded border border-line bg-transparent px-2 text-xs text-ink outline-none placeholder:text-muted focus:border-accent sm:h-8"
          />
          <button type="button" className={button} onClick={joinTyped}>
            Join
          </button>
        </div>
        {codeError ? <p role="alert" className="text-xs text-red-400">That code does not look right.</p> : null}
      </div>
    );
  }

  return (
    <section aria-label="Rooms" className={`absolute bottom-14 left-12 top-8 flex w-72 flex-col border-r border-line bg-surface ${SHEET_LAYOUT}`}>
      <SheetHandle onClose={onClose} />
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="font-serif text-lg text-ink">Rooms</h2>
      </div>
      {showPending ? (
        <div className="flex flex-col gap-2 border-b border-line px-3 py-3">
          <p className="text-xs text-ink">Join room {formatRoomCode(pendingCode)}?</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={`${button} text-ink`}
              onClick={() => {
                room.join(pendingCode);
                onPendingHandled();
              }}
            >
              Join this room
            </button>
            <button type="button" className={button} onClick={onPendingHandled}>
              Not now
            </button>
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </section>
  );
}
