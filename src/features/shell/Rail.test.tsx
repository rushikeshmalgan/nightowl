import { fireEvent, render, screen } from '@testing-library/react';
import { Rail } from './Rail';

const items = [
  { id: 'library', label: 'Library', icon: null, onClick: vi.fn() },
  { id: 'tts', label: 'Read aloud', icon: null, disabled: true, disabledReason: 'Not supported here', onClick: vi.fn() },
];

describe('Rail', () => {
  it('runs a tool when tapped', () => {
    render(<Rail items={items} />);
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(items[0].onClick).toHaveBeenCalled();
  });

  it('gives every tool a 44px touch target on a phone and keeps 32px from sm up', () => {
    render(<Rail items={items} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('h-11 w-11');
      expect(button.className).toContain('sm:h-8 sm:w-8');
    }
  });

  it('pulses a tool that wants attention, calmly for anyone who prefers less motion', () => {
    render(<Rail items={[{ id: 'rooms', label: 'Rooms', icon: null, pulse: true, onClick: vi.fn() }, items[0]]} />);
    expect(screen.getByRole('button', { name: 'Rooms' }).className).toContain('motion-safe:animate-pulse');
    expect(screen.getByRole('button', { name: 'Library' }).className).not.toContain('animate-pulse');
  });

  it('scrolls instead of cutting tools off when the screen is short (a phone on its side)', () => {
    render(<Rail items={items} />);
    expect(screen.getByRole('navigation', { name: 'Tools' }).className).toContain('overflow-y-auto');
  });
});
