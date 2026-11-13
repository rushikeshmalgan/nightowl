import { fireEvent, render, screen } from '@testing-library/react';
import { SheetHandle, SWIPE_CLOSE_PX } from './SheetHandle';

function drag(from: number, to: number) {
  const handle = screen.getByTestId('sheet-handle');
  fireEvent.pointerDown(handle, { clientY: from, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientY: to, pointerId: 1 });
}

describe('SheetHandle', () => {
  it('needs a 60px downward swipe', () => {
    expect(SWIPE_CLOSE_PX).toBe(60);
  });

  it('closes on a long swipe down', () => {
    const onClose = vi.fn();
    render(<SheetHandle onClose={onClose} />);
    drag(100, 180);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes at exactly the threshold', () => {
    const onClose = vi.fn();
    render(<SheetHandle onClose={onClose} />);
    drag(100, 100 + SWIPE_CLOSE_PX);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a short drag', () => {
    const onClose = vi.fn();
    render(<SheetHandle onClose={onClose} />);
    drag(100, 130);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a swipe up', () => {
    const onClose = vi.fn();
    render(<SheetHandle onClose={onClose} />);
    drag(200, 100);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('forgets a drag that was cancelled', () => {
    const onClose = vi.fn();
    render(<SheetHandle onClose={onClose} />);
    const handle = screen.getByTestId('sheet-handle');
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 300, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has a close button for people who do not swipe', () => {
    const onClose = vi.fn();
    render(<SheetHandle onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('only shows below the sm breakpoint', () => {
    render(<SheetHandle onClose={() => {}} />);
    expect(screen.getByTestId('sheet-header')).toHaveClass('sm:hidden');
  });
});
