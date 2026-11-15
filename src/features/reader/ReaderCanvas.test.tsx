import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useImperativeHandle } from 'react';
import { useUi } from '../shell/ui';
import type { DocRecord, ProgressRecord } from '../../shared/types';
import type { PdfViewerProps } from '../pdf/PdfViewer';
import type { PsdInspectorProps } from '../psd/PsdInspector';
import { ReaderCanvas } from './ReaderCanvas';
import type { ReaderHandle } from './ReaderCanvas';

const progress = vi.hoisted(() => ({
  initial: null as ProgressRecord | null | undefined,
  save: vi.fn(),
  update: vi.fn(),
}));
const reflowHook = vi.hoisted(() => ({ state: { status: 'idle' } as import('./useReflowText').ReflowState, calls: [] as unknown[][] }));
const stubs = vi.hoisted(() => ({
  pdfProps: null as unknown,
  psdProps: null as unknown,
  goToPage: vi.fn(),
}));

vi.mock('./text', () => ({
  readText: vi.fn(async (blob: Blob) => (blob as unknown as { __text: string }).__text),
}));
vi.mock('./useReadingProgress', () => ({
  useReadingProgress: () => ({ initial: progress.initial, save: progress.save, update: progress.update }),
}));
vi.mock('./useReflowText', () => ({
  REFLOW_READ_ERROR: "This PDF's text could not be read.",
  useReflowText: (...args: unknown[]) => {
    reflowHook.calls.push(args);
    return reflowHook.state;
  },
}));
// The real viewers need pdf.js and a canvas; routing is what is under test here.
vi.mock('../pdf/PdfViewer', () => ({
  PdfViewer: (props: PdfViewerProps) => {
    stubs.pdfProps = props;
    useImperativeHandle(props.ref, () => ({ goToPage: stubs.goToPage }));
    return <div data-testid="pdf-viewer-stub" />;
  },
}));
vi.mock('../psd/PsdInspector', () => ({
  PsdInspector: (props: PsdInspectorProps) => {
    stubs.psdProps = props;
    return <div data-testid="psd-inspector-stub" />;
  },
}));

const pdfProps = () => stubs.pdfProps as PdfViewerProps;
const psdProps = () => stubs.psdProps as PsdInspectorProps;

function textDoc(id: string, name: string, text: string): DocRecord {
  const blob = { __text: text, size: text.length } as unknown as Blob;
  return { id, name, type: 'text', size: text.length, blob, addedAt: 1, lastOpenedAt: 1 };
}

function binaryDoc(id: string, name: string, type: 'pdf' | 'psd'): DocRecord {
  const bytes = new ArrayBuffer(8);
  const blob = { size: 8, arrayBuffer: async () => bytes } as unknown as Blob;
  return { id, name, type, size: 8, blob, addedAt: 1, lastOpenedAt: 1 };
}

beforeEach(() => {
  progress.initial = null;
  progress.save.mockReset();
  progress.update.mockReset();
  reflowHook.state = { status: 'idle' };
  reflowHook.calls = [];
  stubs.pdfProps = null;
  stubs.psdProps = null;
  stubs.goToPage.mockReset();
  act(() => useUi.getState().reset());
});

describe('ReaderCanvas text documents', () => {
  it('shows an empty state when nothing is open', () => {
    render(<ReaderCanvas doc={null} />);
    expect(screen.getByText(/Nothing is open/)).toBeInTheDocument();
  });

  it('renders the decoded text of a text document', async () => {
    render(<ReaderCanvas doc={textDoc('a', 'a.txt', 'नमस्ते night owl')} />);
    expect(await screen.findByRole('article')).toHaveTextContent('नमस्ते night owl');
  });

  it('reports the decoded text to its parent', async () => {
    const onText = vi.fn();
    render(<ReaderCanvas doc={textDoc('a', 'a.txt', 'read me aloud')} onText={onText} />);
    await screen.findByRole('article');
    expect(onText).toHaveBeenLastCalledWith('read me aloud');
  });

  it('uses the mono face for code-like files', async () => {
    render(<ReaderCanvas doc={textDoc('a', 'data.json', '{}')} />);
    expect(await screen.findByRole('article')).toHaveClass('font-mono');
  });

  it('switches documents', async () => {
    const { rerender } = render(<ReaderCanvas doc={textDoc('a', 'a.txt', 'first document')} />);
    await screen.findByText('first document');
    rerender(<ReaderCanvas doc={textDoc('b', 'b.txt', 'second document')} />);
    expect(await screen.findByText('second document')).toBeInTheDocument();
    expect(screen.queryByText('first document')).not.toBeInTheDocument();
  });

  it('restores the saved scroll position', async () => {
    progress.initial = { docId: 'a', page: 1, scrollTop: 300 };
    render(<ReaderCanvas doc={textDoc('a', 'a.txt', 'long text')} />);
    await screen.findByRole('article');
    // The position is restored in an effect that runs after the text appears.
    await waitFor(() => expect(screen.getByTestId('reader-scroll').scrollTop).toBe(300));
  });

  it('saves the position while scrolling', async () => {
    render(<ReaderCanvas doc={textDoc('a', 'a.txt', 'long text')} />);
    await screen.findByRole('article');
    const scroller = screen.getByTestId('reader-scroll');
    Object.defineProperty(scroller, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scroller, 'scrollHeight', { value: 2000, configurable: true });
    scroller.scrollTop = 900;
    fireEvent.scroll(scroller);
    // 900px down a 400px viewport is the third screen.
    expect(progress.save).toHaveBeenLastCalledWith(3, 900);
  });

  it('reports the reading position as screens for text documents', async () => {
    const onPosition = vi.fn();
    render(<ReaderCanvas doc={textDoc('a', 'a.txt', 'long text')} onPosition={onPosition} />);
    await screen.findByRole('article');
    const scroller = screen.getByTestId('reader-scroll');
    Object.defineProperty(scroller, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scroller, 'scrollHeight', { value: 2000, configurable: true });
    scroller.scrollTop = 900;
    fireEvent.scroll(scroller);
    expect(onPosition).toHaveBeenLastCalledWith({ page: 3, numPages: 5 });
  });
});

describe('ReaderCanvas routing', () => {
  it('opens a PDF in the PDF viewer with the saved position and settings', async () => {
    progress.initial = { docId: 'p', page: 4, scrollTop: 2600 };
    act(() => {
      useUi.getState().set('zoom', 150);
      useUi.getState().set('nightPages', true);
    });
    render(<ReaderCanvas doc={binaryDoc('p', 'paper.pdf', 'pdf')} />);
    expect(await screen.findByTestId('pdf-viewer-stub')).toBeInTheDocument();
    expect(pdfProps().data.byteLength).toBe(8);
    expect(pdfProps()).toMatchObject({ initialPage: 4, initialScrollTop: 2600, zoom: 150, nightPages: true });
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('waits for the saved position before opening a PDF', async () => {
    progress.initial = undefined;
    render(<ReaderCanvas doc={binaryDoc('p', 'paper.pdf', 'pdf')} />);
    await act(async () => {});
    expect(screen.queryByTestId('pdf-viewer-stub')).not.toBeInTheDocument();
  });

  it('saves PDF progress and reports the position', async () => {
    const onPosition = vi.fn();
    render(<ReaderCanvas doc={binaryDoc('p', 'paper.pdf', 'pdf')} onPosition={onPosition} />);
    await screen.findByTestId('pdf-viewer-stub');
    act(() => pdfProps().onProgress({ page: 3, numPages: 12, scrollTop: 1700 }));
    expect(progress.save).toHaveBeenLastCalledWith(3, 1700);
    expect(onPosition).toHaveBeenLastCalledWith({ page: 3, numPages: 12 });
  });

  it('turns PDF pages with the arrow keys and through its handle', async () => {
    const ref = createRef<ReaderHandle>();
    render(<ReaderCanvas ref={ref} doc={binaryDoc('p', 'paper.pdf', 'pdf')} />);
    await screen.findByTestId('pdf-viewer-stub');
    act(() => pdfProps().onProgress({ page: 3, numPages: 12, scrollTop: 1700 }));
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(stubs.goToPage).toHaveBeenLastCalledWith(4);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(stubs.goToPage).toHaveBeenLastCalledWith(2);
    act(() => ref.current?.goToPage(9));
    expect(stubs.goToPage).toHaveBeenLastCalledWith(9);
  });

  it('opens a PSD in the layer inspector', async () => {
    render(<ReaderCanvas doc={binaryDoc('s', 'art.psd', 'psd')} />);
    expect(await screen.findByTestId('psd-inspector-stub')).toBeInTheDocument();
    expect(psdProps().data.byteLength).toBe(8);
  });

  it('shows the error panel when a viewer cannot open the file', async () => {
    render(<ReaderCanvas doc={binaryDoc('p', 'paper.pdf', 'pdf')} />);
    await screen.findByTestId('pdf-viewer-stub');
    act(() => pdfProps().onError('This PDF is password-protected and cannot be opened.'));
    expect(screen.getByRole('alert')).toHaveTextContent('This PDF is password-protected and cannot be opened.');
    expect(screen.queryByTestId('pdf-viewer-stub')).not.toBeInTheDocument();
  });

  it('clears the error when another document is opened', async () => {
    const { rerender } = render(<ReaderCanvas doc={binaryDoc('s', 'art.psd', 'psd')} />);
    await screen.findByTestId('psd-inspector-stub');
    act(() => psdProps().onError('This PSD could not be read.'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<ReaderCanvas doc={textDoc('a', 'a.txt', 'fine again')} />);
    expect(await screen.findByText('fine again')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the stored file cannot be read back', async () => {
    const doc = binaryDoc('p', 'paper.pdf', 'pdf');
    (doc.blob as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => {
      throw new Error('gone');
    };
    render(<ReaderCanvas doc={doc} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('This document could not be read from storage.');
  });
});

describe('ReaderCanvas PDF reflow', () => {
  const pdf = () => binaryDoc('p', 'paper.pdf', 'pdf');
  const readyDoc = {
    hasText: true,
    pages: [
      { page: 1, paragraphs: ['Night reading is calm.'] },
      { page: 2, paragraphs: ['The lamp is warm.'] },
    ],
  };
  const lastEnabled = () => reflowHook.calls[reflowHook.calls.length - 1]?.[2];

  it('opens in Pages and extracts nothing until Reflow is chosen', async () => {
    render(<ReaderCanvas doc={pdf()} />);
    await screen.findByTestId('pdf-viewer-stub');
    expect(lastEnabled()).toBe(false);
  });

  it('opens in Reflow when that is how the PDF was last read', async () => {
    progress.initial = { docId: 'p', page: 2, scrollTop: 10, pdfMode: 'reflow' };
    reflowHook.state = { status: 'ready', doc: readyDoc };
    render(<ReaderCanvas doc={pdf()} />);
    expect(await screen.findByText('Night reading is calm.')).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-viewer-stub')).not.toBeInTheDocument();
    expect(lastEnabled()).toBe(true);
  });

  it('switches to Reflow on request and remembers the choice', async () => {
    const ref = createRef<ReaderHandle>();
    const onPdfView = vi.fn();
    render(<ReaderCanvas ref={ref} doc={pdf()} onPdfView={onPdfView} />);
    await screen.findByTestId('pdf-viewer-stub');
    expect(onPdfView).toHaveBeenLastCalledWith({ mode: 'pages', reflow: 'idle' });
    reflowHook.state = { status: 'loading', done: 3, total: 12 };
    act(() => ref.current?.setPdfMode('reflow'));
    expect(progress.update).toHaveBeenCalledWith({ pdfMode: 'reflow' });
    expect(screen.getByRole('status')).toHaveTextContent('Preparing text… 3 of 12 pages');
    expect(onPdfView).toHaveBeenLastCalledWith({ mode: 'reflow', reflow: 'loading' });
  });

  it('shows the reflowed text with the reading settings applied', async () => {
    progress.initial = { docId: 'p', page: 1, scrollTop: 0, pdfMode: 'reflow' };
    reflowHook.state = { status: 'ready', doc: readyDoc };
    act(() => {
      useUi.getState().set('bionic', true);
      useUi.getState().set('fontSize', 22);
    });
    render(<ReaderCanvas doc={pdf()} />);
    const article = (await screen.findByRole('region', { name: 'Page 1' })).querySelector('article') as HTMLElement;
    expect(article.style.fontSize).toBe('22px');
    expect(article.querySelector('strong')).not.toBeNull();
  });

  it('hands the reflowed text to read-aloud, and clears it when leaving Reflow', async () => {
    progress.initial = { docId: 'p', page: 1, scrollTop: 0, pdfMode: 'reflow' };
    reflowHook.state = { status: 'ready', doc: readyDoc };
    const onText = vi.fn();
    const ref = createRef<ReaderHandle>();
    render(<ReaderCanvas ref={ref} doc={pdf()} onText={onText} />);
    await screen.findByText('Night reading is calm.');
    expect(onText).toHaveBeenLastCalledWith('Night reading is calm.\n\nThe lamp is warm.');
    act(() => ref.current?.setPdfMode('pages'));
    await screen.findByTestId('pdf-viewer-stub');
    expect(onText).toHaveBeenLastCalledWith('');
  });

  describe('positions', () => {
    let rects: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      // Page sections sit 1000px apart; the scroller's own scroll offset moves them.
      rects = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const page = Number(this.dataset.page);
        if (!page) return { top: 0 } as DOMRect;
        const scroller = this.closest('[data-testid="reader-scroll"]') as HTMLElement;
        return { top: (page - 1) * 1000 - scroller.scrollTop } as DOMRect;
      });
    });
    afterEach(() => rects.mockRestore());

    it('reports the page under the top edge and saves the reflow position', async () => {
      progress.initial = { docId: 'p', page: 1, scrollTop: 0, pdfMode: 'reflow', reflowScrollTop: 0 };
      reflowHook.state = { status: 'ready', doc: readyDoc };
      const onPosition = vi.fn();
      render(<ReaderCanvas doc={pdf()} onPosition={onPosition} />);
      const scroller = await screen.findByTestId('reader-scroll');
      scroller.scrollTop = 980;
      fireEvent.scroll(scroller);
      expect(onPosition).toHaveBeenLastCalledWith({ page: 2, numPages: 2 });
      expect(progress.update).toHaveBeenLastCalledWith({ page: 2, reflowScrollTop: 980 });
    });

    it('restores the saved reflow position', async () => {
      progress.initial = { docId: 'p', page: 2, scrollTop: 0, pdfMode: 'reflow', reflowScrollTop: 640 };
      reflowHook.state = { status: 'ready', doc: readyDoc };
      render(<ReaderCanvas doc={pdf()} />);
      const scroller = await screen.findByTestId('reader-scroll');
      await waitFor(() => expect(scroller.scrollTop).toBe(640));
    });

    it('keeps the page when switching from Pages to Reflow', async () => {
      const ref = createRef<ReaderHandle>();
      render(<ReaderCanvas ref={ref} doc={pdf()} />);
      await screen.findByTestId('pdf-viewer-stub');
      act(() => pdfProps().onProgress({ page: 2, numPages: 2, scrollTop: 900 }));
      reflowHook.state = { status: 'ready', doc: readyDoc };
      act(() => ref.current?.setPdfMode('reflow'));
      const scroller = await screen.findByTestId('reader-scroll');
      await waitFor(() => expect(scroller.scrollTop).toBe(1000 - 40));
    });

    it('keeps the page when switching from Reflow back to Pages', async () => {
      progress.initial = { docId: 'p', page: 1, scrollTop: 500, pdfMode: 'reflow', reflowScrollTop: 0 };
      reflowHook.state = { status: 'ready', doc: readyDoc };
      const ref = createRef<ReaderHandle>();
      render(<ReaderCanvas ref={ref} doc={pdf()} />);
      const scroller = await screen.findByTestId('reader-scroll');
      scroller.scrollTop = 980;
      fireEvent.scroll(scroller);
      act(() => ref.current?.setPdfMode('pages'));
      await screen.findByTestId('pdf-viewer-stub');
      expect(pdfProps().initialPage).toBe(2);
      expect(pdfProps().initialScrollTop).toBe(0);
    });
  });

  it('falls back to Pages when the PDF has no text, and says Reflow is unavailable', async () => {
    progress.initial = { docId: 'p', page: 1, scrollTop: 0, pdfMode: 'reflow' };
    reflowHook.state = { status: 'empty' };
    const onPdfView = vi.fn();
    render(<ReaderCanvas doc={pdf()} onPdfView={onPdfView} />);
    expect(await screen.findByTestId('pdf-viewer-stub')).toBeInTheDocument();
    await waitFor(() => expect(progress.update).toHaveBeenCalledWith({ pdfMode: 'pages' }));
    expect(onPdfView).toHaveBeenLastCalledWith({ mode: 'pages', reflow: 'empty' });
  });

  it('tells the reader on screen why a scanned PDF cannot be reflowed, and lets them dismiss it', async () => {
    progress.initial = { docId: 'p', page: 1, scrollTop: 0, pdfMode: 'reflow' };
    reflowHook.state = { status: 'empty' };
    render(<ReaderCanvas doc={pdf()} />);
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('This PDF has no selectable text (it looks scanned), so it cannot be reflowed.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains a failed text extraction the same way', async () => {
    progress.initial = { docId: 'p', page: 1, scrollTop: 0, pdfMode: 'reflow' };
    reflowHook.state = { status: 'error', message: "This PDF's text could not be read." };
    render(<ReaderCanvas doc={pdf()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent("This PDF's text could not be read.");
  });

  it('shows no notice when Reflow works', async () => {
    progress.initial = { docId: 'p', page: 1, scrollTop: 0, pdfMode: 'reflow' };
    reflowHook.state = { status: 'ready', doc: readyDoc };
    render(<ReaderCanvas doc={pdf()} />);
    await screen.findByText('Night reading is calm.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not offer a view switch for text documents', async () => {
    const onPdfView = vi.fn();
    render(<ReaderCanvas doc={textDoc('t', 't.txt', 'hello')} onPdfView={onPdfView} />);
    await screen.findByRole('article');
    expect(onPdfView).toHaveBeenLastCalledWith(null);
  });
});
