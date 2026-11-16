// @vitest-environment node
import { fingerprintBlob } from './fingerprint';

const KB = 1024;

/** Deterministic non-trivial bytes. */
const bytes = (length: number, seed = 7) => Uint8Array.from({ length }, (_, i) => (i * 31 + seed) % 251);
const blobOf = (data: Uint8Array) => new Blob([data as BlobPart]);

describe('fingerprintBlob', () => {
  it('is 16 lowercase hex characters, the same for the same bytes', async () => {
    const data = bytes(300 * KB);
    const a = await fingerprintBlob(blobOf(data));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await fingerprintBlob(blobOf(data.slice()))).toBe(a);
  });

  it('changes when a byte changes in the first, middle or last 64 KB', async () => {
    const data = bytes(300 * KB);
    const base = await fingerprintBlob(blobOf(data));
    for (const index of [100, Math.floor(data.length / 2), data.length - 100]) {
      const changed = data.slice();
      changed[index] ^= 0xff;
      expect(await fingerprintBlob(blobOf(changed))).not.toBe(base);
    }
  });

  it('changes with the size even when every sampled byte is the same', async () => {
    const head = bytes(64 * KB, 1);
    const tail = bytes(64 * KB, 2);
    const withMiddle = (zeros: number) => blobOf(new Uint8Array([...head, ...new Uint8Array(zeros), ...tail]));
    expect(await fingerprintBlob(withMiddle(400 * KB))).not.toBe(await fingerprintBlob(withMiddle(400 * KB + 1)));
  });

  it('copes with an empty file and a tiny one', async () => {
    expect(await fingerprintBlob(new Blob([]))).toMatch(/^[0-9a-f]{16}$/);
    expect(await fingerprintBlob(blobOf(bytes(10)))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('reads only three small slices of a large file', async () => {
    const big = blobOf(new Uint8Array(5 * 1024 * KB));
    const slice = vi.spyOn(big, 'slice');
    await fingerprintBlob(big);
    expect(slice).toHaveBeenCalledTimes(3);
    for (const result of slice.mock.results) expect((result.value as Blob).size).toBeLessThanOrEqual(64 * KB);
  });
});
