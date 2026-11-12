import type { DocType } from '../types';
import type { NocturneDB } from './db';
import { detectDocType } from './fileTypes';
import { EMPTY_FILE_ERROR, importDocument, UNSUPPORTED_TYPE_ERROR } from './library';
import type { ImportResult } from './library';
import { renderFirstPageThumbnail } from './pdf';
import { describePdfError } from './pdfUtil';
import { describePsdError, validatePsd } from './psd';

export type PreparedImport = { ok: true; type: DocType; thumbnail?: Blob } | { ok: false; error: string };

/**
 * Checks a file before it is stored: a PDF must open (its first page becomes
 * the thumbnail) and a PSD's structure must read cleanly. A file that fails
 * comes back with a sentence explaining why.
 */
export async function prepareImport(file: File): Promise<PreparedImport> {
  const type = detectDocType(file.name);
  if (!type) return { ok: false, error: UNSUPPORTED_TYPE_ERROR };
  if (file.size === 0) return { ok: false, error: EMPTY_FILE_ERROR };
  if (type === 'text') return { ok: true, type };

  const data = await file.arrayBuffer();

  if (type === 'pdf') {
    try {
      return { ok: true, type, thumbnail: await renderFirstPageThumbnail(data) };
    } catch (error) {
      return { ok: false, error: describePdfError(error) };
    }
  }

  try {
    validatePsd(data);
    return { ok: true, type };
  } catch (error) {
    return { ok: false, error: describePsdError(error) };
  }
}

/** Validates a file and, only if it is sound, adds it to the library. */
export async function importFileToLibrary(db: NocturneDB, file: File): Promise<ImportResult> {
  const prepared = await prepareImport(file);
  if (!prepared.ok) return prepared;
  return importDocument(db, file, { thumbnail: prepared.thumbnail });
}
