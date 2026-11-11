const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** A short human-readable size: `512 B`, `1.5 KB`, `5.0 MB`, `1.50 GB`. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < KB) return `${Math.round(n)} B`;
  if (n < MB) return `${(n / KB).toFixed(1)} KB`;
  if (n < GB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / GB).toFixed(2)} GB`;
}
