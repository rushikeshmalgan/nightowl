import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useImperativeHandle } from 'react';
import { useUi } from '../store/ui';
import type { DocRecord, ProgressRecord } from '../types';
import type { PdfViewerProps } from './PdfViewer';
import type { PsdInspectorProps } from './PsdInspector';
import { ReaderCanvas } from './ReaderCanvas';
import type { ReaderHandle } from './ReaderCanvas';

const progress = vi.hoisted(() => ({
  initial: null as ProgressRecord | null | undefined,
  save: vi.fn(),
}));
const stubs = vi.hoisted(() => ({
  pdfProps: null as unknown,
  psdProps: null as unknown,
  goToPage: vi.fn(),
}));

vi.mock('../lib/text', () => ({
  readText: vi.fn(async (blob: Blob) => (blob as unknown as { __text: string }).__text),
}));
vi.mock('../hooks/useReadingProgress', () => ({
  useReadingProgress: () => ({ initial: progress.initial, save: progress.save }),
}));
// The real viewers need pdf.js and a canvas; routing is what is under test here.
vi.mock('./PdfViewer', () => ({
  PdfViewer: (props: PdfViewerProps) => {
    stubs.pdfProps = props;
    useImperativeHandle(props.ref, () => ({ goToPage: stubs.goToPage }));
    return <div data-testid="pdf-viewer-stub" />;
  },
}));
vi.mock('./PsdInspector', () => ({
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
