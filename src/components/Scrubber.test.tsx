import { fireEvent, render, screen } from '@testing-library/react';
import { Scrubber } from './Scrubber';

function setup(overrides: Partial<React.ComponentProps<typeof Scrubber>> = {}) {
  const onChange = vi.fn();
  render(
    <Scrubber label="Warmth" value={5000} min={2200} max={6500} step={100} onChange={onChange} {...overrides} />,
  );
  const slider = screen.getByRole('slider', { name: 'Warmth' });
  return { onChange, slider };
}

describe('Scrubber', () => {
  it('exposes slider semantics', () => {
    const { slider } = setup();
    expect(slider).toHaveAttribute('aria-valuenow', '5000');
    expect(slider).toHaveAttribute('aria-valuemin', '2200');
    expect(slider).toHaveAttribute('aria-valuemax', '6500');
    expect(slider).toHaveAttribute('tabindex', '0');
  });

  it('steps up with ArrowRight and ArrowUp', () => {
    const { slider, onChange } = setup();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenNthCalledWith(1, 5100);
    expect(onChange).toHaveBeenNthCalledWith(2, 5100);
  });

  it('steps down with ArrowLeft and ArrowDown', () => {
    const { slider, onChange } = setup();
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenNthCalledWith(1, 4900);
    expect(onChange).toHaveBeenNthCalledWith(2, 4900);
  });

  it('jumps to the ends with Home and End', () => {
    const { slider, onChange } = setup();
    fireEvent.keyDown(slider, { key: 'Home' });
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenNthCalledWith(1, 2200);
    expect(onChange).toHaveBeenNthCalledWith(2, 6500);
  });

  it('moves ten steps with PageUp and PageDown, clamped to the range', () => {
    const { slider, onChange } = setup({ value: 6000 });
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(6500);
    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(onChange).toHaveBeenLastCalledWith(5000);
  });

  it('rounds to the decimals of the step', () => {
    const { slider, onChange } = setup({ value: 1.8, min: 1.2, max: 2.5, step: 0.1 });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(1.9);
  });

  it('shows the formatted readout', () => {
    setup({ format: (v) => `${v}K` });
    expect(screen.getByText('5000K')).toBeInTheDocument();
  });

  it('sets the value from a pointer press on the track, snapped to the step', () => {
    const { slider, onChange } = setup();
    slider.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 16, right: 200, bottom: 16, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1 });
    // midpoint of 2200..6500 is 4350, snapped to the 100 grid from min: 4400
    expect(onChange).toHaveBeenCalledWith(4400);
  });

  it('does nothing when disabled', () => {
    const { slider, onChange } = setup({ disabled: true, title: 'Spotify controls its own volume.' });
    slider.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 16, right: 200, bottom: 16, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    expect(slider).toHaveAttribute('aria-disabled', 'true');
    expect(slider).toHaveAttribute('title', 'Spotify controls its own volume.');
  });
});
