import { AlignLeft, FileText } from 'lucide-react';
import { NARROW_QUERY, useMediaQuery } from '../../shared/useMediaQuery';
import type { PdfMode } from '../../shared/types';
import { REFLOW_EMPTY_REASON, REFLOW_READ_ERROR } from './reflowMessages';
import type { ReflowState } from './useReflowText';

export { REFLOW_EMPTY_REASON };

export interface PdfModeSwitchProps {
  mode: PdfMode;
  reflow: ReflowState['status'];
  onChange(mode: PdfMode): void;
}

/** The Pages / Reflow switch in the status line: shows the view you would switch to. */
export function PdfModeSwitch({ mode, reflow, onChange }: PdfModeSwitchProps) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const target: PdfMode = mode === 'pages' ? 'reflow' : 'pages';
  const label = target === 'reflow' ? 'Reflow' : 'Pages';
  const blocked = target === 'reflow' && (reflow === 'empty' || reflow === 'error');
  const reason = reflow === 'error' ? REFLOW_READ_ERROR : REFLOW_EMPTY_REASON;
  const Icon = target === 'reflow' ? AlignLeft : FileText;
  return (
    <button
      type="button"
      aria-label={`Switch to ${label}`}
      aria-busy={mode === 'reflow' && reflow === 'loading'}
      disabled={blocked}
      title={blocked ? reason : `Switch to ${label}`}
      onClick={() => onChange(target)}
      className="motion-color flex h-6 items-center gap-1 rounded px-1 text-xs text-muted outline-none hover:text-ink focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon size={14} strokeWidth={1.75} />
      {narrow ? null : <span>{label}</span>}
    </button>
  );
}
