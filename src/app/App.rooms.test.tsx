import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useUi } from '../features/shell/ui';
import { makeBinaryDoc, resetFakes, state } from '../test/fakes';
import { fingerprintBlob } from '../features/rooms/fingerprint';

vi.mock('../shared/db', async () => (await import('../test/fakes')).fakeDbModule);
vi.mock('../features/library/library', async () => (await import('../test/fakes')).fakeLibraryModule);
vi.mock('../features/reader/progress', async () => (await import('../test/fakes')).fakeProgressModule);
vi.mock('../shared/prefs', async () => (await import('../test/fakes')).fakePrefsModule);
vi.mock('../features/reader/text', async () => (await import('../test/fakes')).fakeTextModule);
vi.mock('../features/library/importPipeline', async () => (await import('../test/fakes')).fakeImportPipelineModule);
vi.mock('../features/pdf/pdf', async () => (await import('../test/fakes')).fakePdfModule);
vi.mock('../features/audio/instance', async () => {
  const { AudioEngine } = await import('../features/audio/engine');
  const { FakeAudioContext, asContext } = await import('../test/fakeAudio');
  const engine = new AudioEngine({ createContext: () => asContext(new FakeAudioContext()) });
  return { getAudioEngine: () => engine };
});
vi.mock('../features/music/tracks', () => ({ listTracks: async () => [] }));
vi.mock('../features/reader/highlightStore', async () => (await import('../test/fakes')).fakeHighlightStoreModule);

/** The room hook is replaced by a controllable one; mutate `state`, then nudge a re-render. */
const roomHook = vi.hoisted(() => ({
  state: { phase: 'idle', code: null, myKey: '', nick: 'Quiet Owl', members: [], timer: null, timerDone: false, nudges: [] } as Record<string, unknown>,
  controls: { create: vi.fn(), join: vi.fn(), leave: vi.fn(), startTimer: vi.fn(), stopTimer: vi.fn(), sendNudge: vi.fn(), rerollNick: vi.fn() },
  calls: [] as Array<Record<string, unknown>>,
}));
vi.mock('../features/rooms/useRoom', () => ({
  useRoom: (local: Record<string, unknown>) => {
    roomHook.calls.push(local);
    return { ...roomHook.state, ...roomHook.controls };
  },
}));
vi.mock('../features/rooms/fingerprint', () => ({ fingerprintBlob: vi.fn(async () => 'abcdef0123456789') }));

/** Presence is the real hook (local mode in tests) unless a test says the connection is up. */
const presenceHook = vi.hoisted(() => ({ value: null as null | { status: 'online'; total: number; byRoom: { pdf: number; psd: number; text: number } } }));
vi.mock('../features/presence/usePresence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/presence/usePresence')>();
  return { ...actual, usePresence: (room: never, deps: never) => presenceHook.value ?? actual.usePresence(room, deps) };
});

const ONLINE = { status: 'online', total: 3, byRoom: { pdf: 1, psd: 0, text: 2 } } as const;
const lastLocal = () => roomHook.calls[roomHook.calls.length - 1];
const roomsButton = () => screen.getByRole('button', { name: 'Rooms' });
/** Any store change re-renders the app, which is how a changed mocked hook gets read. */
const rerenderApp = () => act(() => useUi.getState().set('zoom', useUi.getState().zoom === 100 ? 110 : 100));

async function renderApp() {
  const view = render(<App />);
  await screen.findByRole('article');
  act(() => {
    window.dispatchEvent(new Event('pointermove'));
  });
  return view;
}

beforeEach(() => {
  resetFakes();
  act(() => useUi.getState().reset());
  presenceHook.value = null;
  roomHook.state = { phase: 'idle', code: null, myKey: '', nick: 'Quiet Owl', members: [], timer: null, timerDone: false, nudges: [] };
  roomHook.calls = [];
  vi.mocked(fingerprintBlob).mockClear();
  for (const control of Object.values(roomHook.controls)) control.mockClear();
  window.location.hash = '';
});

describe('App rooms', () => {
  it('has a Rooms button that is disabled, with the reason, in local mode', async () => {
    await renderApp();
    expect(roomsButton()).toBeDisabled();
    expect(roomsButton()).toHaveAttribute('title', 'Rooms need a connection');
  });

  it('opens the Rooms panel when online, and shares a sheet slot with Library', async () => {
    presenceHook.value = ONLINE;
    await renderApp();
    expect(roomsButton()).toBeEnabled();
    fireEvent.click(roomsButton());
    expect(screen.getByRole('region', { name: 'Rooms' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.queryByRole('region', { name: 'Rooms' })).toBeNull();
    expect(await screen.findByRole('region', { name: 'Library' })).toBeInTheDocument();
    fireEvent.click(roomsButton());
    expect(screen.queryByRole('region', { name: 'Library' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Rooms' })).toBeInTheDocument();
  });

  it('stays usable while in a room even if the connection drops', async () => {
    roomHook.state = { ...roomHook.state, phase: 'reconnecting', code: '4F2K9X' };
    await renderApp();
    expect(roomsButton()).toBeEnabled();
  });

  it('asks before joining from a #room= link, then clears the link', async () => {
    presenceHook.value = ONLINE;
    window.location.hash = '#room=4f2k9x';
    await renderApp();
    expect(await screen.findByText('Join room OWL-4F2K9X?')).toBeInTheDocument();
    expect(roomHook.controls.join).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Join this room' }));
    expect(roomHook.controls.join).toHaveBeenCalledWith('4F2K9X');
    expect(screen.queryByText('Join room OWL-4F2K9X?')).toBeNull();
  });

  it('does not offer a link join while offline', async () => {
    window.location.hash = '#room=4F2K9X';
    await renderApp();
    expect(screen.queryByText('Join room OWL-4F2K9X?')).toBeNull();
  });

  it('tells the room which kind of document is open, and fingerprints it only once in a room', async () => {
    presenceHook.value = ONLINE;
    await renderApp();
    expect(lastLocal()).toMatchObject({ doc: 'text', fp: '' });
    expect(fingerprintBlob).not.toHaveBeenCalled();
    roomHook.state = { ...roomHook.state, phase: 'joined', code: '4F2K9X' };
    rerenderApp();
    await waitFor(() => expect(lastLocal()).toMatchObject({ doc: 'text', fp: 'abcdef0123456789' }));
    expect(fingerprintBlob).toHaveBeenCalledTimes(1);
  });

  it('updates what the room knows when another document opens', async () => {
    presenceHook.value = ONLINE;
    roomHook.state = { ...roomHook.state, phase: 'joined', code: '4F2K9X' };
    state.docs.push(makeBinaryDoc('paper.pdf', 'pdf'));
    await renderApp();
    await waitFor(() => expect(fingerprintBlob).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    const library = await screen.findByRole('region', { name: 'Library' });
    fireEvent.click(library.querySelector('button[aria-label="Open paper.pdf"]') as HTMLElement);
    await waitFor(() => expect(lastLocal()).toMatchObject({ doc: 'pdf' }));
    await waitFor(() => expect(fingerprintBlob).toHaveBeenCalledTimes(2));
  });

  it('pulses the Rooms button for a nudge or a finished timer while the panel is closed, until it is opened', async () => {
    presenceHook.value = ONLINE;
    await renderApp();
    expect(roomsButton().className).not.toContain('animate-pulse');
    roomHook.state = { ...roomHook.state, phase: 'joined', code: '4F2K9X', nudges: [{ id: 1, from: 'Amber Finch', emoji: '🔥' }] };
    rerenderApp();
    await waitFor(() => expect(roomsButton().className).toContain('animate-pulse'));
    fireEvent.click(roomsButton());
    expect(roomsButton().className).not.toContain('animate-pulse');
    fireEvent.click(roomsButton());
    roomHook.state = { ...roomHook.state, timerDone: true };
    rerenderApp();
    await waitFor(() => expect(roomsButton().className).toContain('animate-pulse'));
  });

  it('opens rooms from the command palette, and offers Leave room only inside one', async () => {
    presenceHook.value = ONLINE;
    const user = userEvent.setup();
    await renderApp();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    await user.type(screen.getByRole('combobox'), 'rooms');
    expect(screen.queryByText('Leave room')).toBeNull();
    await user.click(screen.getByText('Open rooms'));
    expect(await screen.findByRole('region', { name: 'Rooms' })).toBeInTheDocument();
  });

  it('offers Leave room in the palette once joined, and it leaves', async () => {
    presenceHook.value = ONLINE;
    roomHook.state = { ...roomHook.state, phase: 'joined', code: '4F2K9X' };
    const user = userEvent.setup();
    await renderApp();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    await user.type(screen.getByRole('combobox'), 'leave room');
    await user.click(screen.getByText('Leave room'));
    expect(roomHook.controls.leave).toHaveBeenCalled();
  });
});
