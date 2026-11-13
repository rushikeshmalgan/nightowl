import { render, screen } from '@testing-library/react';
import { setMedia } from '../../test/media';
import { PresenceBadge } from './PresenceBadge';

describe('PresenceBadge', () => {
  it('shows only the count on a phone, leaving room for the title', () => {
    setMedia({ narrow: true });
    render(<PresenceBadge status="online" total={23} byRoom={{ pdf: 12, psd: 3, text: 8 }} />);
    expect(screen.getByTestId('presence')).toHaveTextContent('23 online');
    expect(screen.getByTestId('presence')).not.toHaveTextContent('PDF');
  });

  it('shows the live count and breakdown', () => {
    render(<PresenceBadge status="online" total={23} byRoom={{ pdf: 12, psd: 3, text: 8 }} />);
    expect(screen.getByTestId('presence')).toHaveTextContent('23 online · PDF 12 · PSD 3 · Text 8');
  });

  it('formats large counts', () => {
    render(<PresenceBadge status="online" total={1428} byRoom={{ pdf: 1000, psd: 28, text: 400 }} />);
    expect(screen.getByTestId('presence')).toHaveTextContent('1,428 online');
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
