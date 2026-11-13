// @vitest-environment node
import { readText } from './text';

describe('readText', () => {
  it('decodes UTF-8 Devanagari text exactly', async () => {
    const original = 'नमस्ते दुनिया';
    const blob = new Blob([new TextEncoder().encode(original)]);
    expect(await readText(blob)).toBe(original);
  });

  it('strips a UTF-8 byte order mark', async () => {
    const body = new TextEncoder().encode('रात का पाठ');
    const withBom = new Uint8Array(body.length + 3);
    withBom.set([0xef, 0xbb, 0xbf], 0);
    withBom.set(body, 3);
    const text = await readText(new Blob([withBom]));
    expect(text).toBe('रात का पाठ');
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('returns an empty string for an empty blob', async () => {
    expect(await readText(new Blob([]))).toBe('');
  });
});
