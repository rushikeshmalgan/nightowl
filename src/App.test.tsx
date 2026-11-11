import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useUi } from './store/ui';

function press(init: KeyboardEventInit) {
  fireEvent.keyDown(document.body, init);
}

describe('App shell', () => {
  beforeEach(() => {
    act(() => useUi.getState().reset());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the application root', () => {
    render(<App />);
    expect(screen.getByRole('application', { name: 'Nocturne Reader' })).toBeInTheDocument();
  });

  it('has a 48px tool rail', () => {
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'Tools' })).toHaveClass('w-12');
  });

  it('shows the first seed document in the status line and the reader', () => {
    render(<App />);
    expect(screen.getByTestId('status-title')).toHaveTextContent('Sleep & Night Ergonomics.md');
    expect(screen.getByRole('article')).toHaveTextContent('NIGHT READING & OCULAR ERGONOMICS');
  });

  it('tints the page with the 5000K warmth overlay by default', () => {
    render(<App />);
    const overlay = screen.getByTestId('warmth-overlay');
    expect(parseFloat(overlay.style.opacity)).toBeCloseTo(0.1221, 3);
    expect(overlay.style.pointerEvents).toBe('none');
  });

  it('opens the command palette with Ctrl+K', () => {
    render(<App />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    press({ key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('switches theme from the palette', async () => {
    const user = userEvent.setup();
    render(<App />);
    press({ key: 'k', ctrlKey: true });
    await user.type(screen.getByRole('combobox'), 'sepia');
    await user.keyboard('{Enter}');
    expect(document.documentElement.dataset.theme).toBe('sepia');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles the tuning panel with backslash', () => {
    render(<App />);
    const panel = screen.getByRole('complementary', { name: 'Tuning' });
    expect(panel).toHaveAttribute('data-open', 'false');
    press({ key: '\\' });
    expect(panel).toHaveAttribute('data-open', 'true');
    press({ key: '\\' });
    expect(panel).toHaveAttribute('data-open', 'false');
  });

  it('toggles bionic reading with Ctrl+B', () => {
    render(<App />);
    expect(screen.getByRole('article').querySelector('strong')).toBeNull();
    press({ key: 'b', ctrlKey: true });
    expect(screen.getByRole('article').querySelector('strong')).not.toBeNull();
  });

  it('toggles the focus ruler with F', () => {
    render(<App />);
    expect(screen.queryByTestId('focus-ruler')).not.toBeInTheDocument();
    press({ key: 'f' });
    expect(screen.getByTestId('focus-ruler')).toBeInTheDocument();
  });

  it('changes the warmth overlay when the warmth scrubber moves', () => {
    render(<App />);
    press({ key: '\\' });
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Warmth' }), { key: 'Home' });
    expect(parseFloat(screen.getByTestId('warmth-overlay').style.opacity)).toBeCloseTo(0.35, 5);
  });

  it('fades the chrome after 3 seconds and wakes on pointer movement', () => {
    vi.useFakeTimers();
    render(<App />);
    const chrome = screen.getByTestId('chrome');
    expect(chrome.style.opacity).toBe('1');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(chrome.style.opacity).toBe('0');
    act(() => {
      window.dispatchEvent(new Event('pointermove'));
    });
    expect(chrome.style.opacity).toBe('1');
  });

  it('keeps the chrome visible while the palette is open', () => {
    vi.useFakeTimers();
    render(<App />);
    press({ key: 'k', ctrlKey: true });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('chrome').style.opacity).toBe('1');
  });
});
