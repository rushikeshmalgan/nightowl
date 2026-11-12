import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorPanel } from './ErrorPanel';

describe('ErrorPanel', () => {
  it('announces the message', () => {
    render(<ErrorPanel message="This file is not a valid PDF." />);
    expect(screen.getByRole('alert')).toHaveTextContent('This file is not a valid PDF.');
  });

  it('offers a way out when one is given', () => {
    const onClear = vi.fn();
    render(<ErrorPanel message="Broken." onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the library' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows no button without a handler', () => {
    render(<ErrorPanel message="Broken." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
