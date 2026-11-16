import { render, screen, within } from '@testing-library/react';
import type { ReflowDoc } from '../pdf/reflowText';
import { REFLOW_TOP_MARGIN, ReflowView, reflowPageAt, scrollToReflowPage } from './ReflowView';

const doc: ReflowDoc = {
  hasText: true,
  pages: [
    { page: 1, paragraphs: ['Night reading is calm.', 'The lamp is warm.'] },
    { page: 2, paragraphs: [] },
    { page: 3, paragraphs: ['Last words here.'] },
  ],
};

const view = (props: Partial<React.ComponentProps<typeof ReflowView>> = {}) =>
  render(<ReflowView doc={doc} bionic={false} dyslexic={false} fontSize={18} lineHeight={1.8} {...props} />);

describe('ReflowView', () => {
  it('shows each page under a "Page N" divider that is not part of the text', () => {
    view();
    expect(screen.getAllByRole('separator').map((el) => el.getAttribute('aria-label'))).toEqual(['Page 1', 'Page 2', 'Page 3']);
    for (const article of screen.getAllByRole('article')) expect(article).not.toHaveTextContent(/Page \d/);
  });

  it('keeps the paragraphs of a page apart, in reading order', () => {
    view();
    const first = within(screen.getByRole('region', { name: 'Page 1' })).getByRole('article');
    expect(first.textContent).toBe('Night reading is calm.\n\nThe lamp is warm.');
  });

  it('says so when a page has no text', () => {
    view();
    expect(within(screen.getByRole('region', { name: 'Page 2' })).getByText('No text on this page.')).toBeInTheDocument();
  });

  it('applies the reading settings: size, spacing, Bionic and the dyslexia font', () => {
    view({ bionic: true, dyslexic: true, fontSize: 22, lineHeight: 2 });
    const article = within(screen.getByRole('region', { name: 'Page 3' })).getByRole('article');
    expect(article.style.fontSize).toBe('22px');
    expect(article.style.lineHeight).toBe('2');
    expect(article.className).toContain('font-dyslexic');
    expect(article.querySelector('strong')).not.toBeNull();
  });
});

describe('reflow scroll helpers', () => {
  /** A scroll container whose page sections sit at the given tops (relative to the container). */
  function layout(tops: number[], scrollTop = 0) {
    const { container } = view();
    const scroller = container.firstElementChild?.parentElement as HTMLElement;
    scroller.scrollTop = scrollTop;
    scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    scroller.querySelectorAll<HTMLElement>('section[data-page]').forEach((section, index) => {
      section.getBoundingClientRect = () => ({ top: tops[index] }) as DOMRect;
    });
    return scroller;
  }

  it('reports the page whose section is under the top edge', () => {
    expect(reflowPageAt(layout([-500, -50, 300]))).toBe(2);
    expect(reflowPageAt(layout([-900, -400, REFLOW_TOP_MARGIN]))).toBe(3);
  });

  it('counts a page whose divider sits a few pixels below the cut-off as the current one', () => {
    expect(reflowPageAt(layout([-900, REFLOW_TOP_MARGIN + 8, 700]))).toBe(2);
    expect(reflowPageAt(layout([-900, REFLOW_TOP_MARGIN + 40, 700]))).toBe(1);
  });

  it('reports page 1 before the first divider reaches the top', () => {
    expect(reflowPageAt(layout([200, 900, 1600]))).toBe(1);
  });

  it('reports the last page once scrolled to the end, even if its divider cannot reach the top', () => {
    const scroller = layout([-1200, -600, 300], 900);
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 700 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1600 });
    expect(reflowPageAt(scroller)).toBe(3);
  });

  it('does not jump to the last page before the end', () => {
    const scroller = layout([-1200, -600, 300], 500);
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 700 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1600 });
    expect(reflowPageAt(scroller)).toBe(2);
  });

  it('scrolls a page to just below the status line', () => {
    const scroller = layout([-300, 400, 900], 100);
    scrollToReflowPage(scroller, 3);
    expect(scroller.scrollTop).toBe(100 + 900 - REFLOW_TOP_MARGIN);
  });
});
