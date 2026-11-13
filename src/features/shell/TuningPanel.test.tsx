import { act, fireEvent, render, screen } from '@testing-library/react';
import { setMedia } from '../../test/media';
import { TuningPanel } from './TuningPanel';
import { useUi } from './ui';

const panel = () => screen.getByRole('complementary', { name: 'Tuning' });

beforeEach(() => {
  act(() => useUi.getState().reset());
});

describe('TuningPanel placement', () => {
  it('slides off the right edge when closed on a wide screen', () => {
    render(<TuningPanel />);
    expect(panel().style.transform).toBe('translateX(100%)');
  });

  it('slides down off the bottom when closed on a phone', () => {
    setMedia({ narrow: true });
    render(<TuningPanel />);
    expect(panel().style.transform).toBe('translateY(100%)');
  });

  it('sits in place when open on either screen', () => {
    act(() => useUi.getState().set('tuningOpen', true));
    render(<TuningPanel />);
    expect(panel().style.transform).toBe('none');
    act(() => setMedia({ narrow: true }));
    expect(panel().style.transform).toBe('none');
  });

  it('is not left on screen when the window widens while it is closed (phone rotated to landscape)', () => {
    setMedia({ narrow: true });
    render(<TuningPanel />);
    expect(panel().style.transform).toBe('translateY(100%)');
    act(() => setMedia({ narrow: false }));
    expect(panel().style.transform).toBe('translateX(100%)');
  });

  it('becomes a bottom sheet below sm: full width, at most 75% of the screen, above the 56px dock', () => {
    render(<TuningPanel />);
    const classes = panel().className;
    for (const cls of ['max-sm:left-0', 'max-sm:right-0', 'max-sm:bottom-14', 'max-sm:top-auto', 'max-sm:max-h-[75dvh]', 'max-sm:w-auto']) {
      expect(classes).toContain(cls);
    }
  });

  it('is still a 288px side drawer from sm up', () => {
    render(<TuningPanel />);
    expect(panel().className).toContain('w-72');
    expect(panel().className).toContain('right-0');
  });

  it('closes from the sheet handle', () => {
    act(() => useUi.getState().set('tuningOpen', true));
    render(<TuningPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(useUi.getState().tuningOpen).toBe(false);
  });
});
