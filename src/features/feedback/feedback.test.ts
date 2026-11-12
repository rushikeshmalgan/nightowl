import { FEEDBACK_EMAIL, feedbackMailto, sendFeedback, validateFeedback } from './feedback';

describe('validateFeedback', () => {
  it('needs a message', () => {
    expect(validateFeedback({ message: '   ', email: '' })).toBe('Please write a message.');
  });

  it('caps the length', () => {
    expect(validateFeedback({ message: 'x'.repeat(4001), email: '' })).toBe('Please keep it under 4000 characters.');
  });

  it('checks a reply address only when one is given', () => {
    expect(validateFeedback({ message: 'Hi', email: '' })).toBeNull();
    expect(validateFeedback({ message: 'Hi', email: 'reader@example.com' })).toBeNull();
    expect(validateFeedback({ message: 'Hi', email: 'not an email' })).toBe('That email address does not look right.');
  });
});

describe('feedbackMailto', () => {
  it('opens a pre-filled email to the owner', () => {
    const url = feedbackMailto({ message: 'The PDF view & night pages?', email: 'reader@example.com' });
    expect(FEEDBACK_EMAIL).toBe('rushikeshmalgan0090@gmail.com');
    expect(url.startsWith('mailto:rushikeshmalgan0090@gmail.com?')).toBe(true);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('subject')).toBe('NightOwl Reader feedback');
    expect(params.get('body')).toContain('The PDF view & night pages?');
    expect(params.get('body')).toContain('Reply to: reader@example.com');
  });
});

describe('sendFeedback', () => {
  const ok = () => vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }) as Response);

  it('posts the message to the form service with the access key', async () => {
    const fetchFn = ok();
    await sendFeedback({ message: 'Love it', email: 'reader@example.com' }, 'key-123', fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('https://api.web3forms.com/submit', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({
      access_key: 'key-123',
      subject: 'NightOwl Reader feedback',
      from_name: 'NightOwl Reader',
      message: 'Love it',
      email: 'reader@example.com',
      botcheck: '',
    });
  });

  it('leaves out the reply address when none is given', async () => {
    const fetchFn = ok();
    await sendFeedback({ message: 'Love it', email: '' }, 'key-123', fetchFn);
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).not.toHaveProperty('email');
  });

  it('fails clearly when the service refuses', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, json: async () => ({ success: false, message: 'bad key' }) }) as Response);
    await expect(sendFeedback({ message: 'Hi', email: '' }, 'key', fetchFn)).rejects.toThrow('Your message could not be sent.');
  });

  it('fails clearly when there is no connection', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(sendFeedback({ message: 'Hi', email: '' }, 'key', fetchFn)).rejects.toThrow('Your message could not be sent.');
  });
});
