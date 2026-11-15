import { render, screen } from '@testing-library/react';
import { setMedia } from '../../test/media';
import { PresenceBadge } from './PresenceBadge';

describe('PresenceBadge', () => {
  it('shows only the count on a phone', () => {
    setMedia({ narrow: true });
    render(<PresenceBadge status="online" total={23} byRoom={{ pdf: 12, psd: 3, text: 8 }} />);
    expect(screen.getByTestId('presence')).toHaveTextContent(/^23$/);
  });

  it('shows the live count, with the breakdown in the tooltip', () => {
    render(<PresenceBadge status="online" total={23} byRoom={{ pdf: 12, psd: 3, text: 8 }} />);
    expect(screen.getByTestId('presence')).toHaveTextContent('23 reading now');
    expect(screen.getByTestId('presence')).toHaveAttribute('title', '12 reading PDFs, 3 reading PSDs, 8 reading text');
  });

  it('formats large counts', () => {
    render(<PresenceBadge status="online" total={1428} byRoom={{ pdf: 1000, psd: 28, text: 400 }} />);
    expect(screen.getByTestId('presence')).toHaveTextContent('1,428 reading now');
  });

  it('says local mode when not connected', () => {
    render(<PresenceBadge status="offline" total={null} byRoom={null} />);
    expect(screen.getByTestId('presence')).toHaveTextContent('Local mode');
  });

  it('says it is connecting', () => {
    render(<PresenceBadge status="connecting" total={null} byRoom={null} />);
    expect(screen.getByTestId('presence')).toHaveTextContent('Connecting…');
  });
});
