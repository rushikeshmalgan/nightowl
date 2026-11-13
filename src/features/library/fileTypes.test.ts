import { ACCEPT_ATTR, detectDocType, isAudioFile } from './fileTypes';

describe('detectDocType', () => {
  it('recognises PDFs and PSDs regardless of case', () => {
    expect(detectDocType('A.PDF')).toBe('pdf');
    expect(detectDocType('poster.Psd')).toBe('psd');
  });

  it('treats txt, md, json and csv as text', () => {
    expect(detectDocType('notes.txt')).toBe('text');
    expect(detectDocType('x.md')).toBe('text');
    expect(detectDocType('data.JSON')).toBe('text');
    expect(detectDocType('table.csv')).toBe('text');
  });

  it('rejects everything else', () => {
    expect(detectDocType('x.docx')).toBeNull();
    expect(detectDocType('photo.png')).toBeNull();
    expect(detectDocType('no-extension')).toBeNull();
    expect(detectDocType('')).toBeNull();
    expect(detectDocType('archive.pdf.exe')).toBeNull();
  });

  it('uses the last extension of a dotted name', () => {
    expect(detectDocType('report.final.v2.pdf')).toBe('pdf');
  });
});

describe('isAudioFile', () => {
  it('accepts mp3 and aac in any case', () => {
    expect(isAudioFile('a.MP3')).toBe(true);
    expect(isAudioFile('b.aac')).toBe(true);
  });

  it('rejects other formats', () => {
    expect(isAudioFile('c.wav')).toBe(false);
    expect(isAudioFile('d.pdf')).toBe(false);
  });
});

describe('ACCEPT_ATTR', () => {
  it('lists exactly the supported document extensions', () => {
    expect(ACCEPT_ATTR).toBe('.pdf,.psd,.txt,.md,.json,.csv');
  });
});
