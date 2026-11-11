import { render, screen } from '@testing-library/react';
import { TextView } from './TextView';

const base = { mono: false, bionic: false, dyslexic: false, fontSize: 18, lineHeight: 1.8 };

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
