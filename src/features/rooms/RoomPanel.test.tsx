import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RoomPanel } from './RoomPanel';
import type { RoomPanelProps } from './RoomPanel';
import type { Member } from './roomModel';
import type { RoomControls, RoomState } from './useRoom';

const FP = 'aaaaaaaaaaaaaaaa';
const member = (over: Partial<Member> = {}): Member => ({
  key: 'k',
  me: false,
  nick: 'Amber Finch',
  doc: 'pdf',
  fp: FP,
  len: 40,
  status: 'reading',
  progress: { page: 12, total: 40 },
  ...over,
});
const meRow = member({ key: 'me', me: true, nick: 'Quiet Owl', progress: { page: 7, total: 40 } });
const amber = member({ key: 'a' });
const heron = member({ key: 'b', nick: 'Night Heron', doc: 'text', fp: 'bbbbbbbbbbbbbbbb', len: 900, progress: { offset: 620, length: 1000 } });

function makeRoom(over: Partial<RoomState> = {}) {
  const controls = {
    create: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    sendNudge: vi.fn(),
    rerollNick: vi.fn(),
  } satisfies RoomControls;
  const state: RoomState = { phase: 'idle', code: null, myKey: 'me', nick: 'Quiet Owl', members: [], timer: null, timerDone: false, nudges: [], ...over };
  return { ...state, ...controls };
}
type Room = ReturnType<typeof makeRoom>;

function setup(room: Room = makeRoom(), props: Partial<RoomPanelProps> = {}) {
  const onGoTo = vi.fn();
  const onClose = vi.fn();
  const onPendingHandled = vi.fn();
  const base: RoomPanelProps = { room, online: true, me: { kind: 'page', page: 7 }, onGoTo, onClose, onPendingHandled, ...props };
  const view = render(<RoomPanel {...base} />);
  const update = (next: Partial<RoomPanelProps>) => view.rerender(<RoomPanel {...base} {...next} />);
  return { room, onGoTo, onClose, onPendingHandled, update };
}

const inRoom = (over: Partial<RoomState> = {}) => makeRoom({ phase: 'joined', code: '4F2K9X', members: [meRow, amber, heron], ...over });
const row = (nick: string) => screen.getByText(nick).closest('li') as HTMLElement;

describe('RoomPanel offline and lobby', () => {
  it('says rooms need a connection, and offers nothing else', () => {
    setup(makeRoom(), { online: false });
    expect(screen.getByText('Rooms need a connection')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create a room' })).toBeNull();
  });

  it('creates a room, shows my nickname and lets me pick another', () => {
    const { room } = setup();
    expect(screen.getByText(/Quiet Owl/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    expect(room.create).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'New nickname' }));
    expect(room.rerollNick).toHaveBeenCalled();
  });

  it('joins with a messy code, and refuses one that is not a code', () => {
    const { room } = setup();
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: ' owl-4f2 k9x ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(room.join).toHaveBeenCalledWith('4F2K9X');
    room.join.mockClear();
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByRole('alert')).toHaveTextContent('That code does not look right.');
    expect(room.join).not.toHaveBeenCalled();
  });

  it.each([
    ['joining', 'Joining…'],
    ['full', 'This room is full'],
    ['busy', 'This room is busy, try again in a moment'],
  ] as const)('shows what happened when the phase is %s', (phase, message) => {
    setup(makeRoom({ phase, code: phase === 'joining' ? '4F2K9X' : null }));
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('asks before joining from a link, and joins only on Join', () => {
    const { room, onPendingHandled } = setup(makeRoom(), { pendingCode: '4F2K9X' });
    expect(screen.getByText('Join room OWL-4F2K9X?')).toBeInTheDocument();
    expect(room.join).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Join this room' }));
    expect(room.join).toHaveBeenCalledWith('4F2K9X');
    expect(onPendingHandled).toHaveBeenCalled();
  });

  it('lets me decline a link without joining', () => {
    const { room, onPendingHandled } = setup(makeRoom(), { pendingCode: '4F2K9X' });
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(room.join).not.toHaveBeenCalled();
    expect(onPendingHandled).toHaveBeenCalled();
  });
});

describe('RoomPanel in a room', () => {
  it('shows the code and copies the link', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    setup(inRoom());
    expect(screen.getByText('OWL-4F2K9X')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.href.split('#')[0]}#room=4F2K9X`);
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('lists each person with their document and place, and marks me', () => {
    setup(inRoom());
    expect(within(row('You')).getByText('p. 7 / 40')).toBeInTheDocument();
    expect(within(row('Amber Finch')).getByText('p. 12 / 40')).toBeInTheDocument();
    expect(within(row('Night Heron')).getByText('62%')).toBeInTheDocument();
    expect(within(row('Amber Finch')).getByText('reading')).toBeInTheDocument();
  });

  it('shows markup in a nickname as plain text', () => {
    setup(inRoom({ members: [meRow, member({ key: 'x', nick: '<b>x</b>' })] }));
    expect(screen.getByText('<b>x</b>')).toBeInTheDocument();
    expect(document.querySelector('li b')).toBeNull();
  });

  it('says it is reconnecting while the connection is down', () => {
    setup(inRoom({ phase: 'reconnecting' }));
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  });

  it('leaves the room', () => {
    const { room } = setup(inRoom());
    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(room.leave).toHaveBeenCalled();
  });
});

describe('RoomPanel same document, Go to and Back', () => {
  it('offers Go to only for someone on the same document', () => {
    setup(inRoom());
    expect(within(row('Amber Finch')).getByText('same document as you')).toBeInTheDocument();
    expect(within(row('Amber Finch')).getByRole('button', { name: 'Go to p. 12' })).toBeInTheDocument();
    expect(within(row('Night Heron')).queryByText('same document as you')).toBeNull();
    expect(within(row('Night Heron')).queryByRole('button')).toBeNull();
    expect(within(row('You')).queryByRole('button')).toBeNull();
  });

  it('jumps a PDF to their page', () => {
    const { onGoTo } = setup(inRoom());
    fireEvent.click(screen.getByRole('button', { name: 'Go to p. 12' }));
    expect(onGoTo).toHaveBeenCalledWith({ kind: 'page', page: 12 });
  });

  it('jumps a text file to their exact spot', () => {
    const textMe = member({ key: 'me', me: true, nick: 'Quiet Owl', doc: 'text', fp: 'bbbbbbbbbbbbbbbb', len: 900, progress: { offset: 100, length: 1000 } });
    const { onGoTo } = setup(inRoom({ members: [textMe, heron] }), { me: { kind: 'offset', offset: 100, length: 1000 } });
    fireEvent.click(screen.getByRole('button', { name: 'Go to 62%' }));
    expect(onGoTo).toHaveBeenCalledWith({ kind: 'offset', offset: 620, length: 1000 });
    fireEvent.click(screen.getByRole('button', { name: 'Back to 10%' }));
    expect(onGoTo).toHaveBeenLastCalledWith({ kind: 'offset', offset: 100, length: 1000 });
  });

  it('offers a way back after a jump, once, and takes it back', () => {
    const { onGoTo } = setup(inRoom());
    fireEvent.click(screen.getByRole('button', { name: 'Go to p. 12' }));
    expect(screen.queryByRole('button', { name: 'Go to p. 12' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to p. 7' }));
    expect(onGoTo).toHaveBeenLastCalledWith({ kind: 'page', page: 7 });
    expect(screen.queryByRole('button', { name: 'Back to p. 7' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to p. 12' })).toBeInTheDocument();
  });

  it('keeps the way back until the reader moves on from where they landed', () => {
    const { update } = setup(inRoom());
    fireEvent.click(screen.getByRole('button', { name: 'Go to p. 12' }));
    update({ me: { kind: 'page', page: 7 } });
    expect(screen.getByRole('button', { name: 'Back to p. 7' })).toBeInTheDocument();
    update({ me: { kind: 'page', page: 12 } });
    expect(screen.getByRole('button', { name: 'Back to p. 7' })).toBeInTheDocument();
    update({ me: { kind: 'page', page: 15 } });
    expect(screen.queryByRole('button', { name: 'Back to p. 7' })).toBeNull();
  });

  it('drops the way back when I open another document', () => {
    const room = inRoom();
    const { update } = setup(room);
    fireEvent.click(screen.getByRole('button', { name: 'Go to p. 12' }));
    expect(screen.getByRole('button', { name: 'Back to p. 7' })).toBeInTheDocument();
    update({ room: { ...room, members: [{ ...meRow, fp: 'cccccccccccccccc' }, amber, heron] } });
    expect(screen.queryByRole('button', { name: 'Back to p. 7' })).toBeNull();
  });
});

describe('RoomPanel focus timer and nudges', () => {
  it.each([15, 25, 45] as const)('starts a %i minute timer', (minutes) => {
    const { room } = setup(inRoom());
    fireEvent.click(screen.getByRole('button', { name: `${minutes} min` }));
    expect(room.startTimer).toHaveBeenCalledWith(minutes);
  });

  it('shows the time left with Stop while it runs', () => {
    vi.useFakeTimers();
    const { room } = setup(inRoom({ timer: { durationMs: 1_500_000, endsAt: Date.now() + 1_470_000 } }));
    expect(screen.getByRole('timer')).toHaveTextContent('24:30');
    expect(screen.queryByRole('button', { name: '25 min' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('24:29');
    fireEvent.click(screen.getByRole('button', { name: 'Stop timer' }));
    expect(room.stopTimer).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('says when a focus session is complete', () => {
    setup(inRoom({ timerDone: true }));
    expect(screen.getByText('Focus complete')).toBeInTheDocument();
  });

  it('sends one of four nudges, and shows the ones that arrive', () => {
    const { room } = setup(inRoom({ nudges: [{ id: 1, from: 'Amber Finch', emoji: '🔥' }] }));
    for (const emoji of ['👋', '🔥', '☕', '🌙']) {
      fireEvent.click(screen.getByRole('button', { name: `Send ${emoji}` }));
      expect(room.sendNudge).toHaveBeenLastCalledWith(emoji);
    }
    expect(screen.getByText('Amber Finch 🔥')).toBeInTheDocument();
  });
});

describe('RoomPanel as a sheet', () => {
  it('is the Rooms region, closed from the sheet handle', () => {
    const { onClose } = setup();
    expect(screen.getByRole('region', { name: 'Rooms' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('gives every button a 44px touch target on a phone', () => {
    setup(inRoom());
    for (const button of screen.getAllByRole('button')) expect(button.className).toContain('h-11');
  });
});
