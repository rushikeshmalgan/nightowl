// Builds the small real files the end-to-end checks import: PDFs and a PSD.
import { initializeCanvas, writePsd } from 'ag-psd';

/**
 * A minimal but valid PDF with one line of Helvetica text per page.
 * With `locked`, the trailer declares standard encryption whose password
 * entries match nothing, so a viewer must ask for a password.
 */
export function makePdf(pageCount, { locked = false, streams = null } = {}) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // 2: the page tree, filled in below
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const kids = [];
  for (let i = 1; i <= pageCount; i++) {
    const stream =
      streams?.[i - 1] ?? `BT /F1 28 Tf 72 700 Td (Page ${i} of ${pageCount}) Tj ET\nBT /F1 14 Tf 72 660 Td (NightOwl end-to-end fixture) Tj ET`;
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${pageCount} >>`;

  let encrypt = 0;
  if (locked) {
    const junk = 'a1'.repeat(32);
    encrypt = add(`<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${junk}> /U <${'b2'.repeat(32)}> /P -44 >>`);
  }

  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  const id = '<0123456789abcdef0123456789abcdef>';
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R${
    locked ? ` /Encrypt ${encrypt} 0 R /ID [${id} ${id}]` : ''
  } >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** One text run: `size`pt Helvetica at (x, y). Parentheses must not appear in `text`. */
const run = (text, y, size = 11, x = 72) => `BT /F1 ${size} Tf ${x} ${y} Td (${text}) Tj ET`;

/**
 * An article-like PDF: a repeated header and a "Page N of M" footer, two
 * paragraphs per page that wrap over several lines, and a word hyphenated
 * across a line break. Reflow should drop the header and footer and join the word.
 */
export function makeArticlePdf(pageCount = 3) {
  const streams = [];
  for (let p = 1; p <= pageCount; p++) {
    const first = [
      'Revenue grew steadily across every region this year, driven mostly by',
      'demand for night reading tools and a growing community of readers who',
      'prefer calm, warm screens. Pattern recog-',
      'nition in the survey data was clear.',
    ];
    const second = [
      `Section ${p} outlook: costs fell while attention stayed high, and the team`,
      'expects the same quiet trend to continue through the next quarter.',
    ];
    const lines = [
      run('Annual Report 2026', 760, 9),
      ...first.map((line, i) => run(line, 700 - i * 14)),
      ...second.map((line, i) => run(line, 700 - first.length * 14 - 18 - i * 14)),
      run(`Page ${p} of ${pageCount}`, 40, 9),
    ];
    streams.push(lines.join('\n'));
  }
  return makePdf(pageCount, { streams });
}

/** A PDF whose pages are only a filled rectangle: no text at all, like a scan. */
export function makeScannedPdf(pageCount = 2) {
  const streams = Array.from({ length: pageCount }, () => '0.85 g 72 72 468 648 re f');
  return makePdf(pageCount, { streams });
}

/**
 * Two seconds of a 440 Hz tone as a WAV file. Browsers sniff audio by its
 * content, so it plays when uploaded under an .mp3 name, which is enough to
 * test the upload and offline playback path without an MP3 encoder.
 */
export function makeToneWav(seconds = 2, rate = 22050) {
  const samples = seconds * rate;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), 44 + i * 2);
  return buffer;
}

function solid(width, height, [r, g, b, a]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { width, height, data, colorSpace: 'srgb' };
}

/**
 * A 64x64 PSD. From the bottom up: a red background, a green square in the
 * top-left, then a group holding a blue square that overlaps the green one.
 * The overlap tells us whether layers are painted in the right order.
 */
export function makePsd() {
  initializeCanvas(
    () => {
      throw new Error('No canvas in Node');
    },
    (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: 'srgb' }),
  );
  const psd = {
    width: 64,
    height: 64,
    imageData: solid(64, 64, [0, 0, 0, 255]),
    children: [
      { name: 'red background', left: 0, top: 0, right: 64, bottom: 64, imageData: solid(64, 64, [255, 0, 0, 255]) },
      { name: 'green square', left: 0, top: 0, right: 32, bottom: 32, imageData: solid(32, 32, [0, 255, 0, 255]) },
      {
        name: 'top group',
        opened: true,
        children: [
          { name: 'blue square', left: 16, top: 16, right: 48, bottom: 48, imageData: solid(32, 32, [0, 0, 255, 255]) },
        ],
      },
    ],
  };
  return Buffer.from(writePsd(psd, { generateThumbnail: false, noBackground: true }));
}

/** Deterministic running text for the report fixture. */
const SENTENCES = [
  'Revenue grew steadily across every region this year, driven mostly by demand for night reading tools.',
  'The team expects the same quiet trend to continue through the next quarter, with costs staying flat.',
  'A growing community of readers prefers calm, warm screens and long, uninterrupted sessions after dark.',
  'Support requests fell by a third once the reading settings were saved on the device between visits.',
  'Most readers open a document more than once, so remembering the page matters more than any feature.',
  'Fewer tabs and fewer notifications meant that sessions lasted longer than in the previous quarter.',
];

/**
 * A multi-page report as a browser would print it: real embedded fonts, a running header, a "Page N of M"
 * footer, naturally wrapped paragraphs, and one word hyphenated across a line break per section
 * (those two lines are separate blocks, so the break is exactly where the fixture says it is).
 */
export function makeReportHtml(sections = 9) {
  const paragraph = (n, k) => Array.from({ length: 5 }, (_, i) => SENTENCES[(n + k + i) % SENTENCES.length]).join(' ');
  const body = Array.from({ length: sections }, (_, i) => {
    const n = i + 1;
    return `
      <h2>Section ${n}: Quarterly outlook</h2>
      <p>${paragraph(n, 0)}</p>
      <div class="wrapped"><div>The survey data for section ${n} shows a pattern that is easy to miss, and the pattern recog-</div><div>nition work behind it took the whole team a month.</div></div>
      <p>${paragraph(n, 2)}</p>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    @page { size: Letter; margin: 1in; }
    body { font: 11pt/14pt Georgia, 'Times New Roman', serif; color: #111; }
    h1 { font: bold 20pt/26pt Georgia, serif; margin: 0 0 14pt; }
    h2 { font: bold 13pt/18pt Georgia, serif; margin: 14pt 0 6pt; }
    p { margin: 0 0 8pt; hyphens: manual; }
    .wrapped { margin: 0 0 8pt; }
    .wrapped div { white-space: nowrap; }
  </style></head><body><h1>Quarterly Review: Reading Habits</h1>${body}</body></html>`;
}

/** Prints the report to a real PDF with the given Chromium-based browser. */
export async function printReportPdf(browser, sections = 9) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent(makeReportHtml(sections));
    return await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '1in', bottom: '1in', left: '1in', right: '1in' },
      headerTemplate: '<div style="font-size:9px;width:100%;text-align:center;font-family:Georgia,serif">Annual Report 2026</div>',
      footerTemplate:
        '<div style="font-size:9px;width:100%;text-align:center;font-family:Georgia,serif">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });
  } finally {
    await context.close();
  }
}
