const CHUNK = 64 * 1024;

/**
 * A short fingerprint of a document, for telling two members that they have the same
 * file open without sharing its name or contents: SHA-256 over the file size and its
 * first, middle and last 64 KB, cut to 16 hex characters. Sampling keeps it fast for a
 * large PSD. It recognises identical copies only; an edited or re-saved copy differs.
 */
export async function fingerprintBlob(blob: Blob): Promise<string> {
  const size = blob.size;
  const mid = Math.floor(size / 2);
  const slices = [
    blob.slice(0, CHUNK),
    blob.slice(Math.max(0, mid - CHUNK / 2), mid + CHUNK / 2),
    blob.slice(Math.max(0, size - CHUNK), size),
  ];
  const buffers = await Promise.all(slices.map((slice) => slice.arrayBuffer()));
  const head = new TextEncoder().encode(`${size}:`);
  const sampled = new Uint8Array(head.length + buffers.reduce((total, buffer) => total + buffer.byteLength, 0));
  sampled.set(head, 0);
  let at = head.length;
  for (const buffer of buffers) {
    sampled.set(new Uint8Array(buffer), at);
    at += buffer.byteLength;
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', sampled));
  return [...digest.slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
