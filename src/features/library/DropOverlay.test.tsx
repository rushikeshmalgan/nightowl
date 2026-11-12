import { fireEvent, render, screen } from '@testing-library/react';
import { DropOverlay } from './DropOverlay';

const withFiles = (files: File[]) => ({ dataTransfer: { types: ['Files'], files } });

describe('DropOverlay', () => {
  it('is hidden until a file is dragged over the window', () => {
    render(<DropOverlay onFiles={() => {}} />);
    expect(screen.queryByText(/Drop to add/)).not.toBeInTheDocument();
    fireEvent.dragEnter(window, withFiles([]));
    expect(screen.getByText(/Drop to add/)).toBeInTheDocument();
  });

  it('ignores drags that carry no files', () => {
    render(<DropOverlay onFiles={() => {}} />);
    fireEvent.dragEnter(window, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(screen.queryByText(/Drop to add/)).not.toBeInTheDocument();
  });

  it('hands dropped files to onFiles and hides again', () => {
    const onFiles = vi.fn();
    render(<DropOverlay onFiles={onFiles} />);
    const file = new File(['x'], 'dropped.txt');
    fireEvent.dragEnter(window, withFiles([file]));
    const drop = fireEvent.drop(window, withFiles([file]));
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(screen.queryByText(/Drop to add/)).not.toBeInTheDocument();
    // The browser must not navigate to the dropped file.
    expect(drop).toBe(false);
  });

  it('hides when the drag leaves the window', () => {
    render(<DropOverlay onFiles={() => {}} />);
    fireEvent.dragEnter(window, withFiles([]));
    fireEvent.dragLeave(window, withFiles([]));
    expect(screen.queryByText(/Drop to add/)).not.toBeInTheDocument();
  });
});
