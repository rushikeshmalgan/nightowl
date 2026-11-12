import { fireEvent, render, screen, within } from '@testing-library/react';
import type { BookmarkRecord, DocMeta } from '../types';
import { LibraryPanel } from './LibraryPanel';

const docs: DocMeta[] = [
  { id: 'a', name: 'Alpha.pdf', type: 'pdf', size: 5 * 1024 * 1024, addedAt: 1, lastOpenedAt: 3 },
  { id: 'b', name: 'Beta.txt', type: 'text', size: 1536, addedAt: 1, lastOpenedAt: 2 },
];
const usage = { documentBytes: 5 * 1024 * 1024 + 1536, trackBytes: 2048, usedBytes: 6_000_000, quotaBytes: 600_000_000 };

function setup(overrides: Partial<React.ComponentProps<typeof LibraryPanel>> = {}) {
  const props = {
    documents: docs,
    currentId: 'a',
    usage,
    overLimit: false,
    bookmarks: [] as BookmarkRecord[],
    notice: null,
    onOpen: vi.fn(),
    onRemove: vi.fn(),
    onImport: vi.fn(),
    onClearAll: vi.fn(),
    onJumpToBookmark: vi.fn(),
    onRemoveBookmark: vi.fn(),
    ...overrides,
  };
  render(<LibraryPanel {...props} />);
  return props;
}

describe('LibraryPanel', () => {
  it('lists documents with their sizes and marks the open one', () => {
    setup();
    const alpha = screen.getByRole('button', { name: 'Open Alpha.pdf' });
    expect(alpha).toHaveAttribute('aria-current', 'true');
    // Sizes are checked inside each row; the storage summary repeats the total.
    expect(within(alpha).getByText('5.0 MB')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Open Beta.txt' })).getByText('1.5 KB')).toBeInTheDocument();
  });

  it('opens a document when clicked', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open Beta.txt' }));
    expect(props.onOpen).toHaveBeenCalledWith('b');
  });

  it('removes a document', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Beta.txt' }));
    expect(props.onRemove).toHaveBeenCalledWith('b');
  });

  it('shows the over-limit notice', () => {
    setup({ overLimit: true });
    expect(screen.getByRole('status')).toHaveTextContent('Over the 500 MB limit');
  });

  it('shows no over-limit notice normally', () => {
    setup();
    expect(screen.queryByText(/Over the 500 MB limit/)).not.toBeInTheDocument();
  });

  it('shows a notice such as a missing document', () => {
    setup({ notice: 'This document is no longer in the library.' });
    expect(screen.getByRole('alert')).toHaveTextContent('This document is no longer in the library.');
  });

  it('asks for confirmation before clearing everything', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Clear library' }));
    expect(props.onClearAll).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }));
    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });

  it('lets the reader back out of clearing', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Clear library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClearAll).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Clear library' })).toBeInTheDocument();
  });

  it('passes chosen files to onImport and limits the picker to supported types', () => {
    const props = setup();
    const input = screen.getByLabelText('Add documents') as HTMLInputElement;
    expect(input.accept).toBe('.pdf,.psd,.txt,.md,.json,.csv');
    const file = new File(['x'], 'new.txt');
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onImport).toHaveBeenCalledWith([file]);
  });

  it('shows storage figures for documents and music separately', () => {
    setup();
    const storage = screen.getByRole('region', { name: 'Storage' });
    expect(within(storage).getByText(/Documents/)).toBeInTheDocument();
    expect(within(storage).getByText('2.0 KB')).toBeInTheDocument();
  });

  it('lists bookmarks for the open document and jumps to one', () => {
    const bookmark: BookmarkRecord = { id: 'bm', docId: 'a', page: 4, label: 'Chapter 2', createdAt: 1 };
    const props = setup({ bookmarks: [bookmark] });
    fireEvent.click(screen.getByRole('button', { name: 'Go to bookmark Chapter 2, page 4' }));
    expect(props.onJumpToBookmark).toHaveBeenCalledWith(bookmark);
    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark Chapter 2' }));
    expect(props.onRemoveBookmark).toHaveBeenCalledWith('bm');
  });

  describe('highlights', () => {
    const highlight = { id: 'h1', docId: 'a', start: 4, end: 9, note: 'why', createdAt: 1, excerpt: 'quick' };

    it('lists the highlights of the open document with their text and note', () => {
      setup({ highlights: [highlight] });
      expect(screen.getByRole('button', { name: 'Go to highlight: quick' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Note for highlight: quick' })).toHaveValue('why');
    });

    it('jumps to a highlight', () => {
      const onJumpToHighlight = vi.fn();
      setup({ highlights: [highlight], onJumpToHighlight });
      fireEvent.click(screen.getByRole('button', { name: 'Go to highlight: quick' }));
      expect(onJumpToHighlight).toHaveBeenCalledWith(highlight);
    });

    it('saves an edited note when the field loses focus', () => {
      const onHighlightNote = vi.fn();
      setup({ highlights: [highlight], onHighlightNote });
      const field = screen.getByRole('textbox', { name: 'Note for highlight: quick' });
      fireEvent.change(field, { target: { value: 'a better note' } });
      expect(onHighlightNote).not.toHaveBeenCalled();
      fireEvent.blur(field);
      expect(onHighlightNote).toHaveBeenCalledWith('h1', 'a better note');
    });

    it('does not save an unchanged note', () => {
      const onHighlightNote = vi.fn();
      setup({ highlights: [highlight], onHighlightNote });
      fireEvent.blur(screen.getByRole('textbox', { name: 'Note for highlight: quick' }));
      expect(onHighlightNote).not.toHaveBeenCalled();
    });

    it('removes a highlight', () => {
      const onRemoveHighlight = vi.fn();
      setup({ highlights: [highlight], onRemoveHighlight });
      fireEvent.click(screen.getByRole('button', { name: 'Remove highlight: quick' }));
      expect(onRemoveHighlight).toHaveBeenCalledWith('h1');
    });
  });

  it('says so when the library is empty', () => {
    setup({ documents: [], currentId: null });
    expect(screen.getByText(/No documents yet/)).toBeInTheDocument();
  });
});
