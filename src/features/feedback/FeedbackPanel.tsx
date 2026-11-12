import { X } from 'lucide-react';
import { useState } from 'react';
import { feedbackMailto, sendFeedback, validateFeedback } from './feedback';
import type { Feedback } from './feedback';

export interface FeedbackPanelProps {
  /** Web3Forms access key. Without it, the email app is offered instead. */
  accessKey: string | undefined;
  online: boolean;
  onClose(): void;
  send?: (feedback: Feedback, accessKey: string) => Promise<void>;
}

/** Lets a reader report a problem or make a suggestion, by email. */
export function FeedbackPanel({ accessKey, online, onClose, send = sendFeedback }: FeedbackPanelProps) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  const canSend = Boolean(accessKey) && online;
  const feedback = { message, email };

  const submit = async () => {
    const invalid = validateFeedback(feedback);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    if (!accessKey) return;
    setProblem(null);
    setState('sending');
    try {
      await send(feedback, accessKey);
      setState('sent');
      setMessage('');
    } catch (error) {
      setState('failed');
      setProblem(error instanceof Error ? error.message : 'Your message could not be sent.');
    }
  };

  const field =
    'w-full rounded border border-line bg-transparent px-2 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-accent';

  return (
    <section aria-label="Feedback" className="absolute bottom-14 left-12 top-8 flex w-80 flex-col gap-3 overflow-y-auto border-r border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted">Report a problem or suggest something</h2>
        <button
          type="button"
          aria-label="Close feedback"
          onClick={onClose}
          className="motion-color flex h-6 w-6 items-center justify-center rounded text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent"
        >
          <X size={12} strokeWidth={1.75} />
        </button>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="flex flex-col gap-1 text-[11px] text-muted">
          Your message
          <textarea
            aria-label="Your message"
            rows={7}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (state === 'sent') setState('idle');
            }}
            placeholder="What went wrong, or what would make this better?"
            className={`${field} resize-y`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted">
          Your email (optional, so I can reply)
          <input
            aria-label="Your email (optional, so I can reply)"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={field}
          />
        </label>

        {canSend ? (
          <button
            type="submit"
            disabled={state === 'sending'}
            className="motion-color rounded border border-line px-3 py-1.5 text-xs text-ink outline-none hover:bg-active focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            {state === 'sending' ? 'Sending…' : 'Send'}
          </button>
        ) : null}
      </form>

      {state === 'sent' ? (
        <p role="status" className="text-xs text-emerald-400">
          Thanks, your message was sent.
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-xs text-red-400">
          {problem}
        </p>
      ) : null}

      {!canSend || state === 'failed' ? (
        <div className="flex flex-col gap-1 text-[11px] text-muted">
          {!canSend ? <p>{online ? 'Your email app will open with the message filled in.' : 'You are offline. Your email app can send it when you reconnect.'}</p> : null}
          <a href={feedbackMailto(feedback)} className="text-accent underline">
            Open in your email app
          </a>
        </div>
      ) : null}
    </section>
  );
}
