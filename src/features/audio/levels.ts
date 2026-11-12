/**
 * Loudness of an analyser's time-domain bytes, from 0 (silence) to 1.
 * The bytes are unsigned with 128 as the zero line.
 */
export function rmsLevel(buf: Uint8Array): number {
  if (buf.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const sample = (buf[i] - 128) / 128;
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(sum / buf.length));
}
