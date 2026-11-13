/** Where readers' feedback goes. Public: it ships in the app. */
export const FEEDBACK_EMAIL = 'rushikeshmalgan0090@gmail.com';
export const FEEDBACK_SUBJECT = 'NightOwl Reader feedback';
const ENDPOINT = 'https://api.web3forms.com/submit';
const MAX_LENGTH = 4000;
export const SEND_ERROR = 'Your message could not be sent.';

export interface Feedback {
  message: string;
  /** The reader's own address, if they want a reply. May be empty. */
  email: string;
}

/** Returns a sentence describing what to fix, or null when the feedback can be sent. */
export function validateFeedback({ message, email }: Feedback): string | null {
  if (message.trim() === '') return 'Please write a message.';
  if (message.length > MAX_LENGTH) return `Please keep it under ${MAX_LENGTH} characters.`;
  if (email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'That email address does not look right.';
  return null;
}

/** A pre-filled email to the owner, for when the message cannot be sent from the app. */
export function feedbackMailto({ message, email }: Feedback): string {
  const body = email.trim() ? `${message}\n\nReply to: ${email.trim()}` : message;
  const params = new URLSearchParams({ subject: FEEDBACK_SUBJECT, body });
  // mailto expects %20 for spaces, not +.
  return `mailto:${FEEDBACK_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
}

/**
 * Sends the message by email through Web3Forms, whose free plan allows 250
 * messages a month. The access key is tied to the owner's address.
 */
export async function sendFeedback(feedback: Feedback, accessKey: string, fetchFn: typeof fetch = fetch): Promise<void> {
  const replyTo = feedback.email.trim();
  const payload = {
    access_key: accessKey,
    subject: FEEDBACK_SUBJECT,
    from_name: 'NightOwl Reader',
    message: feedback.message.trim(),
    ...(replyTo ? { email: replyTo } : {}),
    // An empty honeypot field: bots that fill it in are dropped by the service.
    botcheck: '',
  };

  let response: Response;
  try {
    response = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(SEND_ERROR);
  }
  const result = (await response.json().catch(() => ({}))) as { success?: boolean };
  if (!response.ok || result.success !== true) throw new Error(SEND_ERROR);
}
