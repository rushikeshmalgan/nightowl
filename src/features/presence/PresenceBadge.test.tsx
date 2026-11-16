import { fireEvent, render, screen } from '@testing-library/react';
import { setMedia } from '../../test/media';
import { PresenceBadge } from './PresenceBadge';

const rooms = { pdf: 12, psd: 3, text: 8 };
const breakdown = () => screen.queryByRole('group', { name: 'Readers by document type' });

describe('PresenceBadge breakdown', () => {
  it('opens a breakdown of who is reading what when the count is tapped, and closes on a second tap', () => {
    render(<PresenceBadge status="online" total={23} byRoom={rooms} />);
    const button = screen.getByRole('button', { name: /23 reading now/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(breakdown()).toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(breakdown()).toHaveTextContent('12 reading PDFs');
    expect(breakdown()).toHaveTextContent('3 reading PSDs');
    expect(breakdown()).toHaveTextContent('8 reading text');
    fireEvent.click(button);
    expect(breakdown()).toBeNull();
  });

  it('works on a phone too, where the count alone is shown', () => {
    setMedia({ narrow: true });
    render(<PresenceBadge status="online" total={23} byRoom={rooms} />);
    fireEvent.click(screen.getByRole('button', { name: /23 reading now/ }));
    expect(breakdown()).toHaveTextContent('12 reading PDFs');
  });

  it('closes on Escape and on a press outside', () => {
    render(
      <div>
        <PresenceBadge status="online" total={23} byRoom={rooms} />
        <p>elsewhere</p>
      </div>,
    );
    const button = screen.getByRole('button', { name: /23 reading now/ });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(breakdown()).toBeNull();
    fireEvent.click(button);
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    expect(breakdown()).toBeNull();
  });

  it('stays open when the breakdown itself is pressed', () => {
    render(<PresenceBadge status="online" total={23} byRoom={rooms} />);
    fireEvent.click(screen.getByRole('button', { name: /23 reading now/ }));
    fireEvent.pointerDown(breakdown() as HTMLElement);
    expect(breakdown()).not.toBeNull();
  });

  it('is not a button without a live connection, since there is nothing to break down', () => {
    render(<PresenceBadge status="offline" total={null} byRoom={null} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

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
