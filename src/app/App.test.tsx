import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useUi } from '../features/shell/ui';
import { resetFakes, state } from '../test/fakes';
import { makeFakeAdapters } from '../test/fakeAdapter';
import { setMedia } from '../test/media';
import type { DefaultAdapters } from '../features/music/defaultAdapters';

vi.mock('../shared/db', async () => (await import('../test/fakes')).fakeDbModule);
vi.mock('../features/library/library', async () => (await import('../test/fakes')).fakeLibraryModule);
vi.mock('../features/reader/progress', async () => (await import('../test/fakes')).fakeProgressModule);
vi.mock('../shared/prefs', async () => (await import('../test/fakes')).fakePrefsModule);
vi.mock('../features/reader/text', async () => (await import('../test/fakes')).fakeTextModule);
vi.mock('../features/library/importPipeline', async () => (await import('../test/fakes')).fakeImportPipelineModule);
vi.mock('../features/pdf/pdf', async () => (await import('../test/fakes')).fakePdfModule);
// A real engine on a fake AudioContext, shared by every test in this file.
vi.mock('../features/audio/instance', async () => {
  const { AudioEngine } = await import('../features/audio/engine');
  const { FakeAudioContext, asContext } = await import('../test/fakeAudio');
  const engine = new AudioEngine({ createContext: () => asContext(new FakeAudioContext()) });
  return { getAudioEngine: () => engine };
});
vi.mock('../features/music/tracks', () => ({ listTracks: async () => [] }));
vi.mock('../features/reader/highlightStore', async () => (await import('../test/fakes')).fakeHighlightStoreModule);

function press(init: KeyboardEventInit) {
  fireEvent.keyDown(document.body, init);
}

/** Renders the app and waits for the first document to load. */
async function renderApp() {
  const view = render(<App />);
  await screen.findByRole('article');
  return view;
}

async function openLibrary() {
  fireEvent.click(screen.getByRole('button', { name: 'Library' }));
  return screen.findByRole('region', { name: 'Library' });
}

describe('App shell', () => {
  beforeEach(() => {
    resetFakes();
    act(() => useUi.getState().reset());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the application root', async () => {
    await renderApp();
    expect(screen.getByRole('application', { name: 'NightOwl Reader' })).toBeInTheDocument();
  });

  it('shows local mode in the status line when Supabase is not configured', async () => {
    await renderApp();
    expect(within(screen.getByRole('status', { name: 'Document status' })).getByTestId('presence')).toHaveTextContent('Local mode');
  });

  it('opens the feedback form from the rail and the palette', async () => {
    const user = userEvent.setup();
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(await screen.findByRole('region', { name: 'Feedback' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close feedback' }));
    expect(screen.queryByRole('region', { name: 'Feedback' })).not.toBeInTheDocument();
    press({ key: 'k', ctrlKey: true });
    await user.type(screen.getByRole('combobox'), 'report a problem');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('region', { name: 'Feedback' })).toBeInTheDocument();
  });

  it('has a 48px tool rail', async () => {
    await renderApp();
    expect(screen.getByRole('navigation', { name: 'Tools' })).toHaveClass('w-12');
  });

  it('opens the most recent document in the status line and the reader', async () => {
    await renderApp();
    expect(screen.getByTestId('status-title')).toHaveTextContent('Sleep & Night Ergonomics.md');
    expect(screen.getByRole('article')).toHaveTextContent('NIGHT READING & OCULAR ERGONOMICS');
  });

  it('tints the page with the 5000K warmth overlay by default', async () => {
    await renderApp();
    const overlay = screen.getByTestId('warmth-overlay');
    expect(parseFloat(overlay.style.opacity)).toBeCloseTo(0.1221, 3);
    expect(overlay.style.pointerEvents).toBe('none');
  });

  it('opens the command palette with Ctrl+K', async () => {
    await renderApp();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    press({ key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('switches theme from the palette', async () => {
    const user = userEvent.setup();
    await renderApp();
    press({ key: 'k', ctrlKey: true });
    await user.type(screen.getByRole('combobox'), 'sepia');
    await user.keyboard('{Enter}');
    expect(document.documentElement.dataset.theme).toBe('sepia');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles the tuning panel with backslash', async () => {
    await renderApp();
    const panel = screen.getByRole('complementary', { name: 'Tuning' });
    expect(panel).toHaveAttribute('data-open', 'false');
    press({ key: '\\' });
    expect(panel).toHaveAttribute('data-open', 'true');
    press({ key: '\\' });
    expect(panel).toHaveAttribute('data-open', 'false');
  });

  it('toggles bionic reading with Ctrl+B', async () => {
    await renderApp();
    expect(screen.getByRole('article').querySelector('strong')).toBeNull();
    press({ key: 'b', ctrlKey: true });
    expect(screen.getByRole('article').querySelector('strong')).not.toBeNull();
  });

  it('toggles the focus ruler with F', async () => {
    await renderApp();
    expect(screen.queryByTestId('focus-ruler')).not.toBeInTheDocument();
    press({ key: 'f' });
    expect(screen.getByTestId('focus-ruler')).toBeInTheDocument();
  });

  it('changes the warmth overlay when the warmth scrubber moves', async () => {
    await renderApp();
    press({ key: '\\' });
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Warmth' }), { key: 'Home' });
    expect(parseFloat(screen.getByTestId('warmth-overlay').style.opacity)).toBeCloseTo(0.35, 5);
  });

  it('fades the chrome after 3 seconds and wakes on pointer movement', async () => {
    vi.useFakeTimers();
    render(<App />);
    const chrome = screen.getByTestId('chrome');
    expect(chrome.style.opacity).toBe('1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(chrome.style.opacity).toBe('0');
    act(() => {
      window.dispatchEvent(new Event('pointermove'));
    });
    expect(chrome.style.opacity).toBe('1');
  });

  it('keeps the chrome visible while the palette is open', async () => {
    vi.useFakeTimers();
    render(<App />);
    press({ key: 'k', ctrlKey: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByTestId('chrome').style.opacity).toBe('1');
  });
});

describe('App tuning hover strip', () => {
  beforeEach(() => {
    resetFakes();
    act(() => useUi.getState().reset());
  });

  it('opens the tuning panel on hover with a mouse, and closes when the pointer leaves', async () => {
    await renderApp();
    const panel = screen.getByRole('complementary', { name: 'Tuning' });
    fireEvent.mouseEnter(screen.getByTestId('tuning-hover-strip'));
    expect(panel).toHaveAttribute('data-open', 'true');
    fireEvent.mouseLeave(panel);
    expect(panel).toHaveAttribute('data-open', 'false');
  });

  it('has no hover strip on a touch device, so a swipe cannot open the panel', async () => {
    setMedia({ hover: false });
    await renderApp();
    expect(screen.queryByTestId('tuning-hover-strip')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Tuning' })).toHaveAttribute('data-open', 'false');
  });

  it('adds and removes the strip as the device changes, without a reload', async () => {
    await renderApp();
    expect(screen.getByTestId('tuning-hover-strip')).toBeInTheDocument();
    act(() => setMedia({ hover: false }));
    expect(screen.queryByTestId('tuning-hover-strip')).not.toBeInTheDocument();
    act(() => setMedia({ hover: true }));
    expect(screen.getByTestId('tuning-hover-strip')).toBeInTheDocument();
  });

  it('still opens from an explicit tap on a touch device', async () => {
    setMedia({ hover: false });
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Tuning' }));
    expect(screen.getByRole('complementary', { name: 'Tuning' })).toHaveAttribute('data-open', 'true');
  });
});

describe('App library', () => {
  beforeEach(() => {
    resetFakes();
    act(() => useUi.getState().reset());
  });

  it('lists the library and opens another document', async () => {
    await renderApp();
    const library = await openLibrary();
    fireEvent.click(within(library).getByRole('button', { name: 'Open NightOwl Engine Specs.txt' }));
    expect(await screen.findByText(/NIGHTOWL READER ENGINE/)).toBeInTheDocument();
    expect(screen.getByTestId('status-title')).toHaveTextContent('NightOwl Engine Specs.txt');
  });

  it('imports a chosen file and opens it', async () => {
    await renderApp();
    const library = await openLibrary();
    const file = new File(['hello imported night'], 'mine.txt');
    fireEvent.change(within(library).getByLabelText('Add documents'), { target: { files: [file] } });
    expect(await screen.findByText('hello imported night')).toBeInTheDocument();
    expect(screen.getByTestId('status-title')).toHaveTextContent('mine.txt');
  });

  it('shows why an import was refused', async () => {
    await renderApp();
    const library = await openLibrary();
    const file = new File(['x'], 'report.docx');
    fireEvent.change(within(library).getByLabelText('Add documents'), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('report.docx: Unsupported file type.');
    expect(screen.getByTestId('status-title')).toHaveTextContent('Sleep & Night Ergonomics.md');
  });

  it('says so when a document has gone missing', async () => {
    await renderApp();
    const library = await openLibrary();
    // Another tab removed it after this list was drawn.
    state.docs = state.docs.filter((doc) => doc.name !== 'NightOwl Engine Specs.txt');
    fireEvent.click(within(library).getByRole('button', { name: 'Open NightOwl Engine Specs.txt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This document is no longer in the library.');
  });

  it('opens the next document when the open one is removed', async () => {
    await renderApp();
    const library = await openLibrary();
    fireEvent.click(within(library).getByRole('button', { name: 'Remove Sleep & Night Ergonomics.md' }));
    expect(await screen.findByText(/NIGHTOWL READER ENGINE/)).toBeInTheDocument();
  });

  it('offers each document in the palette', async () => {
    const user = userEvent.setup();
    await renderApp();
    press({ key: 'k', ctrlKey: true });
    await user.type(screen.getByRole('combobox'), 'engine specs');
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/NIGHTOWL READER ENGINE/)).toBeInTheDocument();
  });

  it('clears the library after confirmation from the palette', async () => {
    const user = userEvent.setup();
    await renderApp();
    press({ key: 'k', ctrlKey: true });
    await user.type(screen.getByRole('combobox'), 'clear cache');
    await user.keyboard('{Enter}');
    expect(state.docs).toHaveLength(2);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete everything' }));
    expect(await screen.findByText(/Nothing is open/)).toBeInTheDocument();
    expect(state.docs).toHaveLength(0);
  });

  it('highlights a selection and lists it in the library', async () => {
    await renderApp();
    const article = screen.getByRole('article');
    const textNode = article.querySelector('[data-start]')?.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 13);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.mouseUp(article);
    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }));

    expect((await screen.findByText('NIGHT READING', { selector: 'mark' })).tagName).toBe('MARK');
    const library = await openLibrary();
    expect(await within(library).findByRole('button', { name: 'Go to highlight: NIGHT READING' })).toBeInTheDocument();
  });

  it('opens the ambient sound panel from the rail', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Ambient sound' }));
    const panel = await screen.findByRole('region', { name: 'Ambient sound' });
    expect(within(panel).getByRole('button', { name: 'Rain' })).toBeInTheDocument();
  });

  it('starts and stops ambient sound with the A key', async () => {
    await renderApp();
    press({ key: 'a' });
    expect(await screen.findByText('Sound')).toBeInTheDocument();
    expect(screen.getByTestId('led')).toHaveAttribute('data-source', 'synth');
    press({ key: 'a' });
    await waitFor(() => expect(screen.queryByText('Sound')).not.toBeInTheDocument());
  });

  it('starts and stops ambient sound with Ctrl+M', async () => {
    await renderApp();
    press({ key: 'm', ctrlKey: true });
    expect(await screen.findByText('Sound')).toBeInTheDocument();
    press({ key: 'm', ctrlKey: true });
    await waitFor(() => expect(screen.queryByText('Sound')).not.toBeInTheDocument());
  });

  it('adds a bookmark from the status line', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add bookmark' }));
    const library = await openLibrary();
    expect(await within(library).findByRole('button', { name: /Go to bookmark Page 1, page 1/ })).toBeInTheDocument();
  });
});

describe('App music dock', () => {
  beforeEach(() => {
    resetFakes();
    act(() => useUi.getState().reset());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function fakePlayers(): DefaultAdapters & { fakes: ReturnType<typeof makeFakeAdapters> } {
    const fakes = makeFakeAdapters();
    const youtube = Object.assign(fakes.youtube, { mount: vi.fn() });
    const spotify = Object.assign(fakes.spotify, { mount: vi.fn() });
    return { adapters: fakes, youtube, spotify, fakes } as unknown as DefaultAdapters & { fakes: ReturnType<typeof makeFakeAdapters> };
  }

  it('shows the music dock', async () => {
    render(<App adapters={fakePlayers()} />);
    await screen.findByRole('article');
    expect(screen.getByRole('region', { name: 'Music' })).toHaveClass('h-14');
  });

  it('plays and pauses the active source with Ctrl+M', async () => {
    const players = fakePlayers();
    render(<App adapters={players} />);
    await screen.findByRole('article');
    press({ key: 'm', ctrlKey: true });
    await waitFor(() => expect(players.fakes.noise.play).toHaveBeenCalledTimes(1));
    press({ key: 'm', ctrlKey: true });
    await waitFor(() => expect(players.fakes.noise.pause).toHaveBeenCalled());
  });

  it('switches to YouTube from the palette', async () => {
    const user = userEvent.setup();
    const players = fakePlayers();
    render(<App adapters={players} />);
    await screen.findByRole('article');
    press({ key: 'k', ctrlKey: true });
    await user.type(screen.getByRole('combobox'), 'switch to youtube');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'YouTube', pressed: true })).toBeInTheDocument());
  });

  it('keeps the YouTube player visible while the rest of the chrome fades', async () => {
    const players = fakePlayers();
    render(<App adapters={players} />);
    await screen.findByRole('article');
    fireEvent.click(screen.getByRole('button', { name: 'YouTube' }));
    await waitFor(() => expect(screen.getByTestId('yt-tile')).toBeVisible());
    vi.useFakeTimers();
    act(() => window.dispatchEvent(new Event('pointermove')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId('chrome').style.opacity).toBe('0');
    const tile = screen.getByTestId('yt-tile');
    expect(tile.closest('[data-testid="chrome"]')).toBeNull();
    expect(tile).toBeVisible();
  });
});
