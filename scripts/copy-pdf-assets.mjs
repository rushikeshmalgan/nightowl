// Copies the data files pdf.js loads on demand (character maps, the 14 standard
// fonts, and the JPEG 2000 / JBIG2 / colour decoders) into public/pdfjs, so the
// app serves them itself and never depends on a CDN.
// Runs automatically before `npm run dev` and `npm run build`.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'pdfjs-dist');
const target = join(root, 'public', 'pdfjs');

if (!existsSync(source)) {
  console.error('pdfjs-dist is not installed. Run `npm install` first.');
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

cpSync(join(source, 'cmaps'), join(target, 'cmaps'), { recursive: true });
cpSync(join(source, 'standard_fonts'), join(target, 'standard_fonts'), { recursive: true });
cpSync(join(source, 'wasm'), join(target, 'wasm'), {
  recursive: true,
  // The QuickJS sandbox runs scripts embedded in PDFs; this app never runs them.
  filter: (path) => !/quickjs/i.test(path),
});

console.log('pdf.js assets copied to public/pdfjs');
