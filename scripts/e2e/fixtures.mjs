// Builds the small real files the end-to-end checks import: PDFs and a PSD.
import { initializeCanvas, writePsd } from 'ag-psd';

/**
 * A minimal but valid PDF with one line of Helvetica text per page.
 * With `locked`, the trailer declares standard encryption whose password
 * entries match nothing, so a viewer must ask for a password.
 */
export function makePdf(pageCount, { locked = false } = {}) {
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
    const stream = `BT /F1 28 Tf 72 700 Td (Page ${i} of ${pageCount}) Tj ET\nBT /F1 14 Tf 72 660 Td (NightOwl end-to-end fixture) Tj ET`;
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
