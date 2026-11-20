import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useUi } from '../features/shell/ui';
import * as cache from '../features/pdf/reflowCache';
import type { ReflowState } from '../features/pdf/reflowCache';
import { makeBinaryDoc, makeTextDoc, resetFakes, state } from '../test/fakes';

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
// The text extraction is replaced: what is under test is how the app uses its result.
vi.mock('../features/pdf/reflowCache', () => ({ loadReflowText: vi.fn(), peekReflowText: vi.fn(() => null), clearReflowCache: vi.fn() }));

/** The reader is a stand-in that reports its document the way the real one does and records the jump. */
const reader = vi.hoisted(() => ({ goToMatch: vi.fn(), pdfMode: 'pages' as 'pages' | 'reflow' }));
vi.mock('../features/reader/ReaderCanvas', async () => {
  const { useEffect, useImperativeHandle } = await import('react');
  const { readText } = await import('../features/reader/text');
  return {
    ReaderCanvas: (props: {
      doc: { type: string; blob: Blob } | null;
      onText?: (text: string) => void;
      onPdfView?: (view: unknown) => void;
      onPosition?: (position: unknown) => void;
      ref?: React.Ref<unknown>;
    }) => {
      useImperativeHandle(props.ref, () => ({ goToMatch: reader.goToMatch, goToPage: vi.fn(), setPdfMode: vi.fn(), goToOffset: vi.fn(), goToHighlight: vi.fn() }));
      const { doc, onText, onPdfView, onPosition } = props;
      useEffect(() => {
        if (doc?.type === 'text') void readText(doc.blob).then((text) => onText?.(text));
        else onText?.('');
        onPdfView?.(doc?.type === 'pdf' ? { mode: reader.pdfMode, reflow: 'idle' } : null);
        onPosition?.({ page: 1, numPages: 5 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [doc]);
      return <main data-testid="reader-stub" />;
    },
  };
});

const loadReflowText = vi.mocked(cache.loadReflowText);

const NOTES = 'The night was calm. The owl woke at night and read for a long time. Morning came.';
const reflowDoc = {
  hasText: true,
  pages: [
    { page: 1, paragraphs: ['A quiet night.'] },
    { page: 2, paragraphs: ['Night again.', 'night once more'] },
  ],
};
const ready: ReflowState = { status: 'ready', doc: reflowDoc };

/** Makes the given document the one the app opens first. */
function open(doc: ReturnType<typeof makeTextDoc>) {
  doc.lastOpenedAt = 10_000;
  state.docs.unshift(doc);
}

async function renderApp() {
  render(<App />);
  await screen.findByTestId('reader-stub');
  act(() => {
    window.dispatchEvent(new Event('pointermove'));
  });
}

const openPalette = () => fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
const box = () => screen.getByRole('combobox');
const findRows = () => [...document.body.querySelectorAll('[cmdk-group-heading]')].filter((el) => el.textContent === 'Find');

beforeEach(() => {
  resetFakes();
  act(() => useUi.getState().reset());
  vi.clearAllMocks();
  reader.pdfMode = 'pages';
  vi.mocked(cache.peekReflowText).mockReturnValue(null);
  loadReflowText.mockResolvedValue(ready);
});

describe('App: searching the open document', () => {
  it('lists matches in a text document, with how far through each is, and jumps to the one chosen', async () => {
    const user = userEvent.setup();
    open(makeTextDoc('notes.txt', NOTES));
    await renderApp();
    await waitFor(() => expect(screen.getByTestId('reader-stub')).toBeInTheDocument());
    openPalette();
    await user.type(box(), 'night');
    const rows = await screen.findAllByText(/The night was calm/);
    expect(rows).toHaveLength(2);
    expect(findRows()).toHaveLength(1);
    expect(within(screen.getByRole('dialog')).getAllByText(/^\d+%$/)).toHaveLength(2);
    await user.click(rows[0]);
    await waitFor(() => expect(reader.goToMatch).toHaveBeenCalledWith({ kind: 'text', offset: NOTES.indexOf('night'), length: 5 }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists nothing for a single character', async () => {
    const user = userEvent.setup();
    open(makeTextDoc('notes.txt', NOTES));
    await renderApp();
    openPalette();
    await user.type(box(), 'n');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(findRows()).toHaveLength(0);
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    open(makeTextDoc('notes.txt', NOTES));
    await renderApp();
    openPalette();
    await user.type(box(), 'zebra');
    expect(await screen.findByText('No matches for "zebra" in this document.')).toBeInTheDocument();
  });

  it('jumps to the page for a PDF in Pages', async () => {
    const user = userEvent.setup();
    open(makeBinaryDoc('paper.pdf', 'pdf'));
    await renderApp();
    openPalette();
    await user.type(box(), 'night');
    const rows = await screen.findAllByText(/p\. \d/);
    expect(rows.map((el) => el.textContent)).toEqual(['p. 1', 'p. 2', 'p. 2']);
    await user.click(rows[1]);
    await waitFor(() => expect(reader.goToMatch).toHaveBeenCalledWith({ kind: 'page', page: 2 }));
  });

  it('jumps to the spot in the page for a PDF in Reflow', async () => {
    reader.pdfMode = 'reflow';
    const user = userEvent.setup();
    open(makeBinaryDoc('paper.pdf', 'pdf'));
    await renderApp();
    openPalette();
    await user.type(box(), 'night');
    const rows = await screen.findAllByText(/p\. \d/);
    await user.click(rows[2]);
    await waitFor(() => expect(reader.goToMatch).toHaveBeenCalledWith({ kind: 'reflow', page: 2, offset: 14, length: 5 }));
  });

  it('shows the message for a scanned PDF', async () => {
    loadReflowText.mockResolvedValue({ status: 'empty' });
    const user = userEvent.setup();
    open(makeBinaryDoc('scan.pdf', 'pdf'));
    await renderApp();
    openPalette();
    await user.type(box(), 'night');
    expect(await screen.findByText('This PDF has no text to search (it looks scanned).')).toBeInTheDocument();
  });

  it('offers no search for a PSD, or when nothing is open', async () => {
    const user = userEvent.setup();
    open(makeBinaryDoc('art.psd', 'psd'));
    await renderApp();
    openPalette();
    await user.type(box(), 'night');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(findRows()).toHaveLength(0);
    expect(loadReflowText).not.toHaveBeenCalled();
  });

  it('offers no search when nothing is open', async () => {
    state.docs = [];
    const user = userEvent.setup();
    await renderApp();
    openPalette();
    await user.type(box(), 'night');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(findRows()).toHaveLength(0);
  });
});

describe('App: the palette prompt and its start', () => {
  it('mentions finding words only when a PDF or a text file is open', async () => {
    open(makeTextDoc('notes.txt', NOTES));
    const first = render(<App />);
    await screen.findByTestId('reader-stub');
    openPalette();
    expect(await screen.findByPlaceholderText(/find words/i)).toBeInTheDocument();
    first.unmount();

    resetFakes();
    act(() => useUi.getState().reset());
    open(makeBinaryDoc('art.psd', 'psd'));
    render(<App />);
    await screen.findByTestId('reader-stub');
    openPalette();
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/find words/i)).not.toBeInTheDocument();
  });

  it('reads nothing when the palette is merely opened, and starts clean when it is opened again', async () => {
    const user = userEvent.setup();
    open(makeBinaryDoc('paper.pdf', 'pdf'));
    await renderApp();
    openPalette();
    await screen.findByRole('combobox');
    expect(loadReflowText).not.toHaveBeenCalled();
    await user.type(box(), 'night');
    await screen.findAllByText(/p\. \d/);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    openPalette();
    expect(await screen.findByRole('combobox')).toHaveValue('');
    expect(findRows()).toHaveLength(0);
  });
});
