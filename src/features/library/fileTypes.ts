import type { DocType } from '../../shared/types';

const DOC_TYPES: Record<string, DocType> = {
  pdf: 'pdf',
  psd: 'psd',
  txt: 'text',
  md: 'text',
  json: 'text',
  csv: 'text',
};

const AUDIO_EXTENSIONS = new Set(['mp3', 'aac']);

/** The `accept` attribute for the document file picker. */
export const ACCEPT_ATTR = '.pdf,.psd,.txt,.md,.json,.csv';

/** The `accept` attribute for the music upload picker. */
export const AUDIO_ACCEPT_ATTR = '.mp3,.aac';

function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

/** Which viewer can open this file, judged by its final extension. */
export function detectDocType(name: string): DocType | null {
  const ext = extensionOf(name);
  return ext ? (DOC_TYPES[ext] ?? null) : null;
}

export function isAudioFile(name: string): boolean {
  const ext = extensionOf(name);
  return ext !== null && AUDIO_EXTENSIONS.has(ext);
}

/** Code-like text reads better in a monospace face. */
export function isCodeLike(name: string): boolean {
  const ext = extensionOf(name);
  return ext === 'json' || ext === 'csv';
}
