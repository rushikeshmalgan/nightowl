import { render, screen } from '@testing-library/react';
import { setMedia } from '../../test/media';
import { StatusLine } from './StatusLine';

describe('StatusLine', () => {
  it('shows the title and the state flags on a wide screen', () => {
    render(<StatusLine title="paper.pdf" flags={['Bionic', 'Ruler']} />);
    expect(screen.getByTestId('status-title')).toHaveTextContent('paper.pdf');
    expect(screen.getByRole('status', { name: 'Document status' })).toHaveTextContent('Bionic');
    expect(screen.getByRole('status', { name: 'Document status' })).toHaveTextContent('Ruler');
  });

  it('gives the title the room on a phone: the flags are left to the pressed rail buttons', () => {
    setMedia({ narrow: true });
    render(<StatusLine title="paper.pdf" flags={['Bionic', 'Ruler']} />);
    expect(screen.getByTestId('status-title')).toHaveTextContent('paper.pdf');
    expect(screen.getByRole('status', { name: 'Document status' })).not.toHaveTextContent('Bionic');
  });
});
