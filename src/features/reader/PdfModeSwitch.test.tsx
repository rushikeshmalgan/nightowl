import { fireEvent, render, screen } from '@testing-library/react';
import { setMedia } from '../../test/media';
import { PdfModeSwitch, REFLOW_EMPTY_REASON } from './PdfModeSwitch';

const setup = (props: Partial<React.ComponentProps<typeof PdfModeSwitch>> = {}) => {
  const onChange = vi.fn();
  render(<PdfModeSwitch mode="pages" reflow="idle" onChange={onChange} {...props} />);
  return { onChange };
};

describe('PdfModeSwitch', () => {
  it('offers Reflow while reading Pages, and switches on a click', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Reflow' }));
    expect(onChange).toHaveBeenCalledWith('reflow');
  });

  it('offers Pages while reading in Reflow', () => {
    const { onChange } = setup({ mode: 'reflow', reflow: 'ready' });
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Pages' }));
    expect(onChange).toHaveBeenCalledWith('pages');
  });

  it('shows the target mode as text on a wide screen and only an icon on a phone', () => {
    const view = render(<PdfModeSwitch mode="pages" reflow="idle" onChange={() => {}} />);
    expect(view.container.textContent).toContain('Reflow');
    view.unmount();
    setMedia({ narrow: true });
    const phone = render(<PdfModeSwitch mode="pages" reflow="idle" onChange={() => {}} />);
    expect(phone.container.textContent).toBe('');
    expect(screen.getAllByRole('button', { name: 'Switch to Reflow' }).length).toBeGreaterThan(0);
    phone.unmount();
  });

  it('is disabled with the reason when the PDF has no text to reflow', () => {
    const { onChange } = setup({ reflow: 'empty' });
    const button = screen.getByRole('button', { name: 'Switch to Reflow' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', REFLOW_EMPTY_REASON);
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is disabled with the reason when the text could not be read', () => {
    setup({ reflow: 'error' });
    const button = screen.getByRole('button', { name: 'Switch to Reflow' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', "This PDF's text could not be read.");
  });

  it('says it is preparing the text while Reflow loads', () => {
    setup({ mode: 'reflow', reflow: 'loading' });
    expect(screen.getByRole('button', { name: 'Switch to Pages' })).toHaveAttribute('aria-busy', 'true');
  });
});
