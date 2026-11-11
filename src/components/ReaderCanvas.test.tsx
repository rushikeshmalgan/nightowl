import { act, fireEvent, render, screen } from '@testing-library/react';
import { useUi } from '../store/ui';
import type { DocRecord, ProgressRecord } from '../types';
import { ReaderCanvas } from './ReaderCanvas';

const progress = vi.hoisted(() => ({
  initial: null as ProgressRecord | null | undefined,
  save: vi.fn(),
}));

vi.mock('../lib/text', () => ({
  readText: vi.fn(async (blob: Blob) => (blob as unknown as { __text: string }).__text),
}));
vi.mock('../hooks/useReadingProgress', () => ({
  useReadingProgress: () => ({ initial: progress.initial, save: progress.save }),
}));

function textDoc(id: string, name: string, text: string): DocRecord {
  const blob = { __text: text, size: text.length } as unknown as Blob;
  return { id, name, type: 'text', size: text.length, blob, addedAt: 1, lastOpenedAt: 1 };
}

beforeEach(() => {
  progress.initial = null;
  progress.save.mockReset();
  act(() => useUi.getState().reset());
});

describe('ReaderCanvas', () => {
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
    expect(screen.getByTestId('reader-scroll').scrollTop).toBe(300);
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
