import { TEXT_TOP_MARGIN, rangeAtOffset, topOffset } from './textPosition';

/** A reading column: text split like TextView does (plain spans, a Bionic <strong>, a highlight <mark>). */
function article() {
  const root = document.createElement('article');
  root.innerHTML = '<span data-start="0">hel<strong>lo</strong> </span><mark data-start="6">wor</mark><span data-start="9">ld</span>';
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('rangeAtOffset', () => {
  it('finds the character at an offset, across Bionic and highlight markup', () => {
    const root = article();
    expect(rangeAtOffset(root, 0)?.toString()).toBe('h');
    expect(rangeAtOffset(root, 3)?.toString()).toBe('l');
    expect(rangeAtOffset(root, 5)?.toString()).toBe(' ');
    expect(rangeAtOffset(root, 8)?.toString()).toBe('r');
    expect(rangeAtOffset(root, 10)?.toString()).toBe('d');
  });

  it('puts the range at the very end for an offset equal to the length', () => {
    const range = rangeAtOffset(article(), 11);
    expect(range).not.toBeNull();
    expect(range?.toString()).toBe('');
  });

  it('refuses an offset past the end or one that makes no sense', () => {
    const root = article();
    expect(rangeAtOffset(root, 12)).toBeNull();
    expect(rangeAtOffset(root, -1)).toBeNull();
    expect(rangeAtOffset(root, Number.NaN)).toBeNull();
  });
});

describe('topOffset', () => {
  /** Rectangles: the scroller starts at y=100; the article's left edge is x=60. */
  function laidOut() {
    const root = article();
    const scroller = document.createElement('div');
    scroller.getBoundingClientRect = () => ({ top: 100, left: 0 }) as DOMRect;
    root.getBoundingClientRect = () => ({ top: 100, left: 60 }) as DOMRect;
    scroller.append(root);
    document.body.append(scroller);
    return { scroller, root };
  }

  it('is the character the browser puts at the top left of the reading area', () => {
    const { scroller, root } = laidOut();
    const caret = vi.fn((_x: number, _y: number) => {
      const range = document.createRange();
      range.setStart(root.querySelector('mark')!.firstChild!, 2);
      return range;
    });
    expect(topOffset(scroller, root, TEXT_TOP_MARGIN, caret)).toBe(8);
    expect(caret).toHaveBeenCalledWith(64, 100 + TEXT_TOP_MARGIN);
  });

  it('falls back to the first segment still on screen when the browser cannot say', () => {
    const { scroller, root } = laidOut();
    const [first, second, third] = [...root.querySelectorAll<HTMLElement>('[data-start]')];
    first.getBoundingClientRect = () => ({ bottom: 120 }) as DOMRect;
    second.getBoundingClientRect = () => ({ bottom: 300 }) as DOMRect;
    third.getBoundingClientRect = () => ({ bottom: 500 }) as DOMRect;
    expect(topOffset(scroller, root, TEXT_TOP_MARGIN, () => null)).toBe(6);
  });

  it('ignores a caret that lands outside the reading column', () => {
    const { scroller, root } = laidOut();
    const outside = document.createElement('p');
    outside.textContent = 'elsewhere';
    document.body.append(outside);
    root.querySelectorAll<HTMLElement>('[data-start]').forEach((segment) => {
      segment.getBoundingClientRect = () => ({ bottom: 900 }) as DOMRect;
    });
    const caret = () => {
      const range = document.createRange();
      range.setStart(outside.firstChild!, 3);
      return range;
    };
    expect(topOffset(scroller, root, TEXT_TOP_MARGIN, caret)).toBe(0);
  });

  it('is null when nothing can be measured', () => {
    const { scroller, root } = laidOut();
    root.querySelectorAll<HTMLElement>('[data-start]').forEach((segment) => {
      segment.getBoundingClientRect = () => ({ bottom: 0 }) as DOMRect;
    });
    expect(topOffset(scroller, root, TEXT_TOP_MARGIN, () => null)).toBeNull();
  });
});
