// @vitest-environment node
import 'fake-indexeddb/auto';
import { createDb } from '../../shared/db';
import type { NightOwlDB } from '../../shared/db';
import { importFileToLibrary, prepareImport } from './importPipeline';
import * as pdf from '../pdf/pdf';
import * as psd from '../psd/psd';

vi.mock('../pdf/pdf', () => ({ renderFirstPageThumbnail: vi.fn() }));
vi.mock('../psd/psd', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../psd/psd')>()),
  validatePsd: vi.fn(),
}));

const renderFirstPageThumbnail = vi.mocked(pdf.renderFirstPageThumbnail);
const validatePsd = vi.mocked(psd.validatePsd);

const file = (name: string, bytes = 32) => new File([new Uint8Array(bytes)], name);

let counter = 0;
let db: NightOwlDB;

beforeEach(() => {
  vi.resetAllMocks();
  counter += 1;
  db = createDb(`pipeline-test-${counter}`);
});

afterEach(async () => {
  await db.delete();
});

describe('prepareImport', () => {
  it('accepts a text file without parsing it', async () => {
    expect(await prepareImport(file('notes.txt'))).toEqual({ ok: true, type: 'text' });
    expect(renderFirstPageThumbnail).not.toHaveBeenCalled();
    expect(validatePsd).not.toHaveBeenCalled();
  });

  it('accepts a valid PDF and returns its first-page thumbnail', async () => {
    const thumbnail = new Blob(['png']);
    renderFirstPageThumbnail.mockResolvedValue(thumbnail);
    expect(await prepareImport(file('paper.pdf'))).toEqual({ ok: true, type: 'pdf', thumbnail });
  });

  it('explains a password-protected PDF', async () => {
    renderFirstPageThumbnail.mockRejectedValue({ name: 'PasswordException' });
    expect(await prepareImport(file('locked.pdf'))).toEqual({
      ok: false,
      error: 'This PDF is password-protected and cannot be opened.',
    });
  });

  it('explains a file that only claims to be a PDF', async () => {
    renderFirstPageThumbnail.mockRejectedValue({ name: 'InvalidPDFException' });
    expect(await prepareImport(file('renamed.pdf'))).toEqual({ ok: false, error: 'This file is not a valid PDF.' });
  });

  it('accepts a PSD whose structure reads cleanly', async () => {
    expect(await prepareImport(file('art.psd'))).toEqual({ ok: true, type: 'psd' });
    expect(validatePsd).toHaveBeenCalledTimes(1);
  });

  it('explains a corrupt PSD', async () => {
    validatePsd.mockImplementation(() => {
      throw new Error('Invalid signature: 0x0');
    });
    expect(await prepareImport(file('broken.psd'))).toEqual({ ok: false, error: 'This PSD could not be read.' });
  });

  it('passes on the reason when a PSD is too large', async () => {
    validatePsd.mockImplementation(() => {
      throw new Error('This PSD is too large to open in a browser (30000 × 100 px).');
    });
    expect(await prepareImport(file('huge.psd'))).toEqual({
      ok: false,
      error: 'This PSD is too large to open in a browser (30000 × 100 px).',
    });
  });

  it('refuses unsupported and empty files before reading them', async () => {
    expect(await prepareImport(file('report.docx'))).toEqual({
      ok: false,
      error: 'Unsupported file type. Use .pdf, .psd, .txt, .md, .json or .csv.',
    });
    expect(await prepareImport(file('empty.pdf', 0))).toEqual({ ok: false, error: 'File is empty.' });
    expect(renderFirstPageThumbnail).not.toHaveBeenCalled();
  });
});

describe('importFileToLibrary', () => {
  it('saves nothing when validation fails', async () => {
    renderFirstPageThumbnail.mockRejectedValue({ name: 'PasswordException' });
    const result = await importFileToLibrary(db, file('locked.pdf'));
    expect(result).toEqual({ ok: false, error: 'This PDF is password-protected and cannot be opened.' });
    expect(await db.documents.count()).toBe(0);
    expect(await db.thumbnails.count()).toBe(0);
  });

  it('saves nothing for a corrupt PSD', async () => {
    validatePsd.mockImplementation(() => {
      throw new Error('bad');
    });
    await importFileToLibrary(db, file('broken.psd'));
    expect(await db.documents.count()).toBe(0);
  });

  it('stores a valid PDF with its page-1 thumbnail', async () => {
    renderFirstPageThumbnail.mockResolvedValue(new Blob(['thumb']));
    const result = await importFileToLibrary(db, file('paper.pdf'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.type).toBe('pdf');
    expect((await db.thumbnails.get([result.doc.id, 1]))?.blob.size).toBe(5);
  });

  it('stores a text file', async () => {
    const result = await importFileToLibrary(db, file('notes.md'));
    expect(result.ok).toBe(true);
    expect(await db.documents.count()).toBe(1);
  });
});
