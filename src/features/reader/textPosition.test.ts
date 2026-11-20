import { TEXT_TOP_MARGIN, rangeAtOffset, rectAtOffset, selectText, topOffset } from './textPosition';

/** A reading column of the given text, split like TextView does (plain spans, a Bionic <strong>, a highlight <mark>). */
function article(length = 11) {
  const root = document.createElement('article');
  if (length === 11) {
    root.innerHTML = '<span data-start="0">hel<strong>lo</strong> </span><mark data-start="6">wor</mark><span data-start="9">ld</span>';
  } else {
    root.innerHTML = `<span data-start="0">${'x'.repeat(length)}</span>`;
  }
  document.body.append(root);
  return root;
}

/** Gives every Range a box, as a layout engine would: lines of 5 characters, 20px tall, the first at `base`. */
function layOut(root: HTMLElement, base: number) {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Range) {
      const before = document.createRange();
      before.selectNodeContents(root);
      before.setEnd(this.startContainer, this.startOffset);
      const top = base + Math.floor(before.toString().length / 5) * 20;
      return { top, bottom: top + 20, height: 20, left: 0, right: 10, width: 10 };
    },
  });
}

afterEach(() => {
  delete (Range.prototype as unknown as { getBoundingClientRect?: unknown }).getBoundingClientRect;
  delete (document as unknown as { caretRangeFromPoint?: unknown }).caretRangeFromPoint;
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

describe('rectAtOffset', () => {
  it('is the box of the character, and null for an offset outside the text', () => {
    const root = article();
    layOut(root, 0);
    expect(rectAtOffset(root, 7)).toMatchObject({ top: 20, bottom: 40 });
    expect(rectAtOffset(root, 99)).toBeNull();
  });

  it('looks at the next character when a line break has no box of its own', () => {
    const root = article();
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value(this: Range) {
        const empty = this.toString() === 'l' && this.startOffset === 2;
        return empty ? { top: 0, bottom: 0, height: 0, width: 0 } : { top: 20, bottom: 40, height: 20, width: 10 };
      },
    });
    expect(rectAtOffset(root, 2)).toMatchObject({ top: 20 });
  });
});

describe('topOffset', () => {
  /** The scroller's top edge is at y=100, so the reading cut-off (the status line plus a little) is y=140. */
  function scrollerOver(root: HTMLElement) {
    const scroller = document.createElement('div');
    scroller.getBoundingClientRect = () => ({ top: 100, left: 0 }) as DOMRect;
    scroller.append(root);
    document.body.append(scroller);
    return scroller;
  }

  it('is the first character of the first line that reaches below the cut-off', () => {
    const root = article(100);
    const scroller = scrollerOver(root);
    layOut(root, 40); // scrolled so the text starts 60px above the scroller's top
    // Lines end at 60, 80, 100, 120, 140 (not below 140), then 160: the sixth line, offset 25.
    expect(topOffset(scroller, root, TEXT_TOP_MARGIN)).toBe(25);
  });

  it('is 0 while the text still starts below the cut-off', () => {
    const root = article(100);
    const scroller = scrollerOver(root);
    layOut(root, 160);
    expect(topOffset(scroller, root, TEXT_TOP_MARGIN)).toBe(0);
  });

  it('is the last character once everything has scrolled above the cut-off', () => {
    const root = article(100);
    const scroller = scrollerOver(root);
    layOut(root, -5000);
    expect(topOffset(scroller, root, TEXT_TOP_MARGIN)).toBe(99);
  });

  it('measures the text itself, so a panel drawn over the reading area cannot throw it off', () => {
    const root = article(100);
    const scroller = scrollerOver(root);
    layOut(root, 40);
    // A browser's hit test would find the overlay; measuring must not ask it.
    const hitTest = vi.fn();
    (document as unknown as { caretRangeFromPoint: unknown }).caretRangeFromPoint = hitTest;
    expect(topOffset(scroller, root)).toBe(25);
    expect(hitTest).not.toHaveBeenCalled();
  });

  it('falls back to the first segment still on screen when boxes cannot be measured', () => {
    const root = article();
    const scroller = scrollerOver(root);
    const [first, second, third] = [...root.querySelectorAll<HTMLElement>('[data-start]')];
    first.getBoundingClientRect = () => ({ bottom: 120 }) as DOMRect;
    second.getBoundingClientRect = () => ({ bottom: 300 }) as DOMRect;
    third.getBoundingClientRect = () => ({ bottom: 500 }) as DOMRect;
    expect(topOffset(scroller, root)).toBe(6);
  });

  it('is null when nothing can be measured at all', () => {
    const root = article();
    const scroller = scrollerOver(root);
    root.querySelectorAll<HTMLElement>('[data-start]').forEach((segment) => {
      segment.getBoundingClientRect = () => ({ bottom: 0 }) as DOMRect;
    });
    expect(topOffset(scroller, root)).toBeNull();
  });
});

describe('selectText', () => {
  afterEach(() => window.getSelection()?.removeAllRanges());

  it('selects exactly those characters, across Bionic and highlight markup', () => {
    const root = article();
    expect(selectText(root, 2, 7)).toBe(true);
    expect(window.getSelection()?.toString()).toBe('llo wor');
  });

  it('can select up to the very end of the text', () => {
    const root = article();
    expect(selectText(root, 6, 5)).toBe(true);
    expect(window.getSelection()?.toString()).toBe('world');
  });

  it('replaces an earlier selection', () => {
    const root = article();
    selectText(root, 0, 3);
    selectText(root, 6, 3);
    expect(window.getSelection()?.rangeCount).toBe(1);
    expect(window.getSelection()?.toString()).toBe('wor');
  });

  it('refuses a range outside the text and leaves the selection as it was', () => {
    const root = article();
    selectText(root, 0, 3);
    expect(selectText(root, 9, 5)).toBe(false);
    expect(selectText(root, -1, 3)).toBe(false);
    expect(selectText(root, 3, 0)).toBe(false);
    expect(selectText(root, Number.NaN, 3)).toBe(false);
    expect(window.getSelection()?.toString()).toBe('hel');
  });
});
