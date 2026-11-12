import { fireEvent, render, screen } from '@testing-library/react';
import { TextView } from './TextView';

const base = { mono: false, bionic: false, dyslexic: false, fontSize: 18, lineHeight: 1.8 };

function select(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
});

describe('TextView', () => {
  it('renders the text unchanged, including line breaks', () => {
    render(<TextView {...base} text={'first line\nsecond line'} />);
    const article = screen.getByRole('article');
    expect(article.textContent).toBe('first line\nsecond line');
    expect(article.querySelector('strong')).toBeNull();
  });

  it('bolds the head of each word in bionic mode', () => {
    render(<TextView {...base} bionic text="hello world" />);
    const article = screen.getByRole('article');
    const heads = Array.from(article.querySelectorAll('strong'), (el) => el.textContent);
    expect(heads).toEqual(['hel', 'wor']);
    expect(article.textContent).toBe('hello world');
  });

  it('keeps whitespace intact in bionic mode', () => {
    render(<TextView {...base} bionic text={'one  two\n\nthree'} />);
    expect(screen.getByRole('article').textContent).toBe('one  two\n\nthree');
  });

  it('applies font size and line height', () => {
    render(<TextView {...base} fontSize={22} lineHeight={2.1} text="x" />);
    const article = screen.getByRole('article');
    expect(article.style.fontSize).toBe('22px');
    expect(article.style.lineHeight).toBe('2.1');
  });

  it('uses the serif face by default and mono for code-like files', () => {
    const { rerender } = render(<TextView {...base} text="x" />);
    expect(screen.getByRole('article')).toHaveClass('font-serif');
    rerender(<TextView {...base} mono text="x" />);
    expect(screen.getByRole('article')).toHaveClass('font-mono');
    expect(screen.getByRole('article')).not.toHaveClass('font-serif');
  });

  it('switches to the dyslexic face when asked', () => {
    render(<TextView {...base} dyslexic text="x" />);
    expect(screen.getByRole('article')).toHaveClass('font-dyslexic');
    expect(screen.getByRole('article')).not.toHaveClass('font-serif');
  });
});

describe('TextView highlights', () => {
  it('marks highlighted ranges', () => {
    render(<TextView {...base} text="the quick brown fox" highlights={[{ start: 4, end: 9 }]} />);
    const article = screen.getByRole('article');
    const marks = Array.from(article.querySelectorAll('mark'), (el) => el.textContent);
    expect(marks).toEqual(['quick']);
    expect(article.textContent).toBe('the quick brown fox');
  });

  it('does not duplicate text when highlights overlap', () => {
    render(
      <TextView
        {...base}
        text="the quick brown fox"
        highlights={[
          { start: 4, end: 9 },
          { start: 6, end: 15 },
        ]}
      />,
    );
    const article = screen.getByRole('article');
    expect(article.textContent).toBe('the quick brown fox');
    expect(Array.from(article.querySelectorAll('mark'), (el) => el.textContent)).toEqual(['quick brown']);
  });

  it('keeps bionic bolding inside and outside highlights', () => {
    render(<TextView {...base} bionic text="hello world" highlights={[{ start: 6, end: 11 }]} />);
    const article = screen.getByRole('article');
    expect(article.textContent).toBe('hello world');
    expect(article.querySelector('mark')?.textContent).toBe('world');
    expect(article.querySelector('mark strong')?.textContent).toBe('wor');
  });

  it('offers to highlight a selection and reports its offsets', () => {
    const onHighlight = vi.fn();
    render(<TextView {...base} text="the quick brown fox" onHighlight={onHighlight} />);
    const article = screen.getByRole('article');
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument();

    const textNode = article.querySelector('[data-start]')?.firstChild as Text;
    select(textNode, 4, textNode, 9);
    fireEvent.mouseUp(article);

    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }));
    expect(onHighlight).toHaveBeenCalledWith({ start: 4, end: 9 });
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument();
  });

  it('reports correct offsets when selecting after an existing highlight', () => {
    const onHighlight = vi.fn();
    render(
      <TextView {...base} text="the quick brown fox" highlights={[{ start: 4, end: 9 }]} onHighlight={onHighlight} />,
    );
    const article = screen.getByRole('article');
    // Segments: "the " | mark "quick" | " brown fox" (starts at 9).
    const last = article.querySelector('[data-start="9"]')?.firstChild as Text;
    select(last, 1, last, 6);
    fireEvent.mouseUp(article);
    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }));
    expect(onHighlight).toHaveBeenCalledWith({ start: 10, end: 15 });
  });

  it('does not offer highlighting without a handler or without a selection', () => {
    render(<TextView {...base} text="the quick brown fox" />);
    const article = screen.getByRole('article');
    const textNode = article.querySelector('[data-start]')?.firstChild as Text;
    select(textNode, 4, textNode, 9);
    fireEvent.mouseUp(article);
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument();
  });

  it('withdraws the offer when the selection collapses', () => {
    render(<TextView {...base} text="the quick brown fox" onHighlight={() => {}} />);
    const article = screen.getByRole('article');
    const textNode = article.querySelector('[data-start]')?.firstChild as Text;
    select(textNode, 4, textNode, 9);
    fireEvent.mouseUp(article);
    expect(screen.getByRole('button', { name: 'Highlight' })).toBeInTheDocument();
    window.getSelection()?.removeAllRanges();
    fireEvent.mouseUp(article);
    expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument();
  });
});
