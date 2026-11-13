import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FeedbackPanel } from './FeedbackPanel';

function setup(props: Partial<React.ComponentProps<typeof FeedbackPanel>> = {}) {
  const send = vi.fn(async () => {});
  const onClose = vi.fn();
  render(<FeedbackPanel accessKey="key" online send={send} onClose={onClose} {...props} />);
  return { send, onClose };
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('FeedbackPanel', () => {
  it('never overhangs a narrow screen: it is capped to the space beside the rail', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Feedback' }).className).toContain('max-w-[calc(100%-3rem)]');
  });

  it('sends a typed message and thanks the reader', async () => {
    const { send } = setup();
    type('Your message', 'The focus ruler is great');
    type('Your email (optional, so I can reply)', 'reader@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith({ message: 'The focus ruler is great', email: 'reader@example.com' }, 'key'));
    expect(await screen.findByRole('status')).toHaveTextContent('Thanks, your message was sent.');
  });

  it('explains what is missing instead of sending', () => {
    const { send } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please write a message.');
    expect(send).not.toHaveBeenCalled();
  });

  it('offers the email app when sending fails', async () => {
    const send = vi.fn(async () => {
      throw new Error('Your message could not be sent.');
    });
    setup({ send });
    type('Your message', 'Bug report');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your message could not be sent.');
    expect(screen.getByRole('link', { name: 'Open in your email app' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:rushikeshmalgan0090@gmail.com'),
    );
  });

  it('uses the email app when no access key is set up', () => {
    const { send } = setup({ accessKey: undefined });
    type('Your message', 'Hello');
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open in your email app' });
    expect(link.getAttribute('href')).toContain('body=Hello');
    expect(send).not.toHaveBeenCalled();
  });

  it('uses the email app when offline', () => {
    setup({ online: false });
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in your email app' })).toBeInTheDocument();
  });

  it('closes', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close feedback' }));
    expect(onClose).toHaveBeenCalled();
  });
});
