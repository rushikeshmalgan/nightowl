import { fireEvent, render, screen } from '@testing-library/react';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../shell/ui';
import { ZoomControl } from './ZoomControl';

function setup(zoom: number) {
  const onChange = vi.fn();
  render(<ZoomControl zoom={zoom} onChange={onChange} />);
  return onChange;
}

const zoomIn = () => screen.getByRole('button', { name: 'Zoom in' });
const zoomOut = () => screen.getByRole('button', { name: 'Zoom out' });

describe('ZoomControl', () => {
  it('uses the 60-180% range in 10% steps', () => {
    expect([ZOOM_MIN, ZOOM_MAX, ZOOM_STEP]).toEqual([60, 180, 10]);
  });

  it('is a labelled group', () => {
    setup(100);
    expect(screen.getByRole('group', { name: 'Zoom' })).toBeInTheDocument();
  });

  it('zooms in and out by one step', () => {
    const onChange = setup(100);
    fireEvent.click(zoomIn());
    expect(onChange).toHaveBeenLastCalledWith(110);
    fireEvent.click(zoomOut());
    expect(onChange).toHaveBeenLastCalledWith(90);
  });

  it('stops at 180% and never goes past it', () => {
    const onChange = setup(180);
    expect(zoomIn()).toBeDisabled();
    fireEvent.click(zoomIn());
    expect(onChange).not.toHaveBeenCalled();
    expect(zoomOut()).toBeEnabled();
  });

  it('stops at 60% and never goes below it', () => {
    const onChange = setup(60);
    expect(zoomOut()).toBeDisabled();
    fireEvent.click(zoomOut());
    expect(onChange).not.toHaveBeenCalled();
    expect(zoomIn()).toBeEnabled();
  });

  it('clamps a step that would overshoot a limit', () => {
    const high = setup(175);
    fireEvent.click(zoomIn());
    expect(high).toHaveBeenLastCalledWith(180);
  });

  it('clamps at the low end too', () => {
    const onChange = setup(65);
    fireEvent.click(zoomOut());
    expect(onChange).toHaveBeenLastCalledWith(60);
  });

  it('steps from a value that is off the 10% grid', () => {
    const onChange = setup(85);
    fireEvent.click(zoomIn());
    expect(onChange).toHaveBeenLastCalledWith(95);
  });

  it('shows the zoom and resets to 100% on tap', () => {
    const onChange = setup(150);
    const reset = screen.getByRole('button', { name: 'Reset zoom, now 150%' });
    expect(reset).toHaveTextContent('150%');
    fireEvent.click(reset);
    expect(onChange).toHaveBeenLastCalledWith(100);
  });

  it('has 44px touch targets on a phone', () => {
    setup(100);
    for (const button of [zoomIn(), zoomOut()]) {
      expect(button).toHaveClass('h-11');
      expect(button).toHaveClass('w-11');
    }
  });
});
