// Fixtures for the in-document search checks.

const BODY =
  'Night had settled over the reading room, and the chairs stood empty beside the long windows. Nobody spoke; the clock ticked, and pages turned slowly in the dark.';

/**
 * A real PDF, printed by the browser itself (embedded fonts, one chapter per page): six pages. The word
 * "lantern" is on pages 2, 4 and 6 and nowhere else; "moth" only on page 5.
 */
export async function printNotesPdf(browser) {
  const page = await browser.newPage();
  try {
    const chapters = Array.from({ length: 6 }, (_, index) => {
      const n = index + 1;
      const lantern = n % 2 === 0 ? ' The lantern on the shelf was lit that evening and burned until morning.' : '';
      const moth = n === 5 ? ' A pale moth circled the glass.' : '';
      return `<section><h2>Chapter ${n}: the quiet hours</h2><p>${BODY}${lantern}${moth}</p><p>${BODY}</p></section>`;
    }).join('');
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>
        @page { size: Letter; margin: 1in; }
        body { font: 12pt/1.6 Georgia, serif; }
        h2 { font-size: 18pt; margin: 0 0 12pt; }
        section:not(:last-child) { break-after: page; }
      </style></head><body>${chapters}</body></html>`,
    );
    return Buffer.from(await page.pdf({ format: 'Letter', printBackground: false }));
  } finally {
    await page.close();
  }
}

/** A long text file: 300 numbered paragraphs, each using "the" many times; "Paragraph 250" appears once. */
export function makeLongText() {
  const paragraph = (n) =>
    `Paragraph ${n}: the owl read the whole of the book by the lamp, and the pages of the story turned one by one until the morning light touched the window and the room grew quiet.`;
  return Buffer.from(Array.from({ length: 300 }, (_, index) => paragraph(index + 1)).join('\n\n'));
}
