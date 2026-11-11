import { formatBytes } from './format';

describe('formatBytes', () => {
  it('formats zero and small byte counts', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes with one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes with one decimal', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(500 * 1024 * 1024)).toBe('500.0 MB');
  });

  it('formats gigabytes with two decimals', () => {
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB');
  });

  it('treats negative or invalid input as zero', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
