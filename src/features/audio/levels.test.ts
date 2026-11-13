import { rmsLevel } from './levels';

describe('rmsLevel', () => {
  it('is zero for silence', () => {
    expect(rmsLevel(new Uint8Array(128).fill(128))).toBe(0);
  });

  it('is close to one for a full-scale signal', () => {
    const buf = new Uint8Array(128);
    for (let i = 0; i < buf.length; i++) buf[i] = i % 2 === 0 ? 0 : 255;
    expect(rmsLevel(buf)).toBeGreaterThan(0.9);
    expect(rmsLevel(buf)).toBeLessThanOrEqual(1);
  });

  it('grows with the signal', () => {
    const quiet = new Uint8Array(128);
    const loud = new Uint8Array(128);
    for (let i = 0; i < 128; i++) {
      quiet[i] = i % 2 === 0 ? 120 : 136;
      loud[i] = i % 2 === 0 ? 64 : 192;
    }
    expect(rmsLevel(loud)).toBeGreaterThan(rmsLevel(quiet));
  });

  it('is zero for an empty buffer', () => {
    expect(rmsLevel(new Uint8Array(0))).toBe(0);
  });
});
