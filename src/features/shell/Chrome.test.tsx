import { fireEvent, render, screen } from '@testing-library/react';
import { Chrome } from './Chrome';

function mockScroll(el: HTMLElement, { scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
}

describe('Chrome wheel handling', () => {
  let reader: HTMLDivElement;

  beforeEach(() => {
    reader = document.createElement('div');
    reader.setAttribute('data-testid', 'reader-scroll');
    reader.scrollTop = 0;
    document.body.appendChild(reader);
  });

  afterEach(() => {
    reader.remove();
  });

  it('scrolls the reader when the wheel is over a panel that has nothing to scroll', () => {
    render(
      <Chrome idle={false}>
        <aside aria-label="Tuning">
          <button>Theme</button>
        </aside>
      </Chrome>,
    );
    fireEvent.wheel(screen.getByRole('button', { name: 'Theme' }), { deltaY: 120 });
    expect(reader.scrollTop).toBe(120);
  });

  it('leaves the wheel to a panel that can still scroll in that direction', () => {
    render(
      <Chrome idle={false}>
        <aside aria-label="Tuning" style={{ overflowY: 'auto' }}>
          <button>Theme</button>
        </aside>
      </Chrome>,
    );
    const panel = screen.getByRole('complementary', { name: 'Tuning' });
    mockScroll(panel, { scrollHeight: 900, clientHeight: 400 });
    fireEvent.wheel(screen.getByRole('button', { name: 'Theme' }), { deltaY: 120 });
    expect(reader.scrollTop).toBe(0);
  });

  it('does nothing while the chrome is idle', () => {
    render(
      <Chrome idle>
        <button>Theme</button>
      </Chrome>,
    );
    fireEvent.wheel(screen.getByText('Theme', { selector: 'button' }), { deltaY: 120 });
    expect(reader.scrollTop).toBe(0);
  });
});
