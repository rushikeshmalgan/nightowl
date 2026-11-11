import { render, screen } from '@testing-library/react';
import { FocusRuler } from './FocusRuler';

describe('FocusRuler', () => {
  it('renders a 60px band centred on y that ignores the pointer', () => {
    render(<FocusRuler y={250} />);
    const band = screen.getByTestId('focus-ruler-band');
    expect(band.style.top).toBe('220px');
    expect(band.style.height).toBe('60px');
    expect(screen.getByTestId('focus-ruler').style.pointerEvents).toBe('none');
  });

  it('dims everything above and below the band', () => {
    render(<FocusRuler y={250} />);
    expect(screen.getByTestId('focus-ruler-above').style.height).toBe('220px');
    expect(screen.getByTestId('focus-ruler-below').style.top).toBe('280px');
  });

  it('never positions the band above the top edge', () => {
    render(<FocusRuler y={10} />);
    expect(screen.getByTestId('focus-ruler-band').style.top).toBe('0px');
    expect(screen.getByTestId('focus-ruler-above').style.height).toBe('0px');
  });
});
