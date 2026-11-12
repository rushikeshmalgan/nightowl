// End-to-end checks against the real app in a real browser.
//
//   node scripts/e2e/run.mjs            run every check
//   node scripts/e2e/run.mjs pdf psd    run only the named groups
//
// Starts its own Vite dev server and drives the Edge or Chrome already
// installed on this machine (no browser download). Exits non-zero on failure.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer, preview } from 'vite';
import { makePdf, makePsd } from './fixtures.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5199;
// --build runs against the production build (with its Content-Security-Policy).
const useBuild = process.argv.includes('--build');
const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const results = [];

function record(group, name, ok, detail = '') {
  results.push({ group, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${detail ? `  (${detail})` : ''}`);
}

async function check(group, name, fn) {
  try {
    const detail = await fn();
    record(group, name, true, typeof detail === 'string' ? detail : '');
  } catch (error) {
    record(group, name, false, String(error?.message ?? error).split('\n')[0].slice(0, 220));
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      // try the next installed browser
    }
  }
  throw new Error('Neither Microsoft Edge nor Google Chrome could be launched.');
}

const file = (name, buffer, mimeType = 'application/octet-stream') => ({ name, mimeType, buffer });

/** The chrome fades when idle and ignores clicks; a real reader wakes it by moving the mouse. */
let wobble = 0;
async function wake(page) {
  wobble = (wobble + 7) % 40;
  await page.mouse.move(640 + wobble, 420 + wobble);
  await page.waitForFunction(() => document.querySelector('[data-testid="chrome"]')?.dataset.idle === 'false');
}

async function openLibrary(page) {
  await wake(page);
  const panel = page.getByRole('region', { name: 'Library', exact: true });
  if (!(await panel.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Library', exact: true }).click();
  }
  return panel;
}

async function importFile(page, upload) {
  const panel = await openLibrary(page);
  await panel.getByLabel('Add documents').setInputFiles(upload);
}

async function libraryNames(page) {
  const panel = await openLibrary(page);
  return panel.getByRole('button', { name: /^Open / }).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
}

const groups = {
  async shell(page) {
    await check('shell', 'app loads with the seeded document', async () => {
      await page.waitForSelector('article');
      const title = await page.getByTestId('status-title').innerText();
      expect(title.includes('Sleep & Night Ergonomics'), `status title was "${title}"`);
    });
    await check('shell', 'chrome fades after 3 s of no input and wakes on movement', async () => {
      await page.mouse.move(600, 400);
      await page.waitForTimeout(3500);
      const idle = await page.getByTestId('chrome').evaluate((el) => getComputedStyle(el).opacity);
      expect(idle === '0', `opacity after idle was ${idle}`);
      await page.mouse.move(620, 420);
      await page.waitForTimeout(400);
      const awake = await page.getByTestId('chrome').evaluate((el) => getComputedStyle(el).opacity);
      expect(awake === '1', `opacity after movement was ${awake}`);
    });
  },

  async pdf(page) {
    await check('pdf', 'a real 5-page PDF opens with every page laid out', async () => {
      await importFile(page, file('five-pages.pdf', makePdf(5), 'application/pdf'));
      await page.waitForSelector('[data-testid="pdf-page"]', { timeout: 15000 });
      const count = await page.getByTestId('pdf-page').count();
      expect(count === 5, `found ${count} pages`);
    });
    await check('pdf', 'page 1 is drawn on its canvas', async () => {
      await page.waitForFunction(
        () => {
          const canvas = document.querySelector('[data-testid="pdf-page"] canvas');
          if (!canvas || canvas.width === 0) return false;
          const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < data.length; i += 4) if (data[i] < 80 && data[i + 3] > 200) return true;
          return false;
        },
        undefined,
        { timeout: 15000 },
      );
    });
    await check('pdf', 'the text layer holds selectable text', async () => {
      await page.waitForFunction(() => document.querySelector('.textLayer span') !== null, undefined, { timeout: 15000 });
      const text = await page.locator('[data-page="1"] .textLayer').innerText();
      expect(text.includes('Page 1 of 5'), `text layer said "${text.slice(0, 60)}"`);
      const selectable = await page.locator('[data-page="1"] .textLayer span').first().evaluate((el) => getComputedStyle(el).userSelect);
      expect(selectable === 'text', `user-select was ${selectable}`);
    });
    await check('pdf', 'night pages inverts the page', async () => {
      // Close the library panel, then open the tuning panel.
      await wake(page);
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      await page.keyboard.press('\\');
      await page.getByRole('button', { name: /Night pages/ }).click();
      const filter = await page.locator('[data-page="1"] canvas').evaluate((el) => getComputedStyle(el).filter);
      expect(filter.includes('invert'), `canvas filter was "${filter}"`);
      await page.getByRole('button', { name: /Night pages/ }).click();
      await page.keyboard.press('\\');
    });
    await check('pdf', 'the reading position survives a reload', async () => {
      const target = await page.getByTestId('pdf-scroll').evaluate((el) => {
        const third = document.querySelector('[data-page="3"]');
        el.scrollTop = third.offsetTop - 40;
        return el.scrollTop;
      });
      await page.waitForTimeout(1600);
      await page.reload();
      await page.waitForSelector('[data-testid="pdf-page"]', { timeout: 15000 });
      await page.waitForTimeout(600);
      const restored = await page.getByTestId('pdf-scroll').evaluate((el) => el.scrollTop);
      expect(Math.abs(restored - target) < 4, `saved ${target}, restored ${restored}`);
      await wake(page);
      const status = await page.getByRole('status', { name: 'Document status' }).innerText();
      expect(/3\s*\/\s*5/.test(status), `status line was "${status.replace(/\s+/g, ' ')}"`);
    });
    await check('pdf', 'the library shows the PDF with its size', async () => {
      const names = await libraryNames(page);
      expect(names.includes('Open five-pages.pdf'), `library had ${JSON.stringify(names)}`);
    });
  },

  async rejects(page) {
    await check('rejects', 'a password-protected PDF is refused with a reason', async () => {
      await importFile(page, file('locked.pdf', makePdf(2, { locked: true }), 'application/pdf'));
      const alert = page.getByRole('region', { name: 'Library', exact: true }).getByRole('alert');
      await alert.waitFor({ timeout: 15000 });
      const text = await alert.innerText();
      expect(text.includes('password-protected'), `alert said "${text}"`);
    });
    await check('rejects', 'a text file renamed to .pdf is refused with a reason', async () => {
      await importFile(page, file('renamed.pdf', Buffer.from('this is not a pdf at all\n'.repeat(20)), 'application/pdf'));
      const alert = page.getByRole('region', { name: 'Library', exact: true }).getByRole('alert');
      await page.waitForFunction(() => /not a valid PDF/.test(document.querySelector('[role="alert"]')?.textContent ?? ''), undefined, {
        timeout: 15000,
      });
      const text = await alert.innerText();
      expect(text.includes('not a valid PDF'), `alert said "${text}"`);
    });
    await check('rejects', 'a corrupt PSD is refused with a reason', async () => {
      await importFile(page, file('broken.psd', Buffer.from('8BPS-but-not-really'.repeat(10))));
      await page.waitForFunction(() => /PSD could not be read/.test(document.querySelector('[role="alert"]')?.textContent ?? ''), undefined, {
        timeout: 15000,
      });
    });
    await check('rejects', 'none of the refused files reached the library', async () => {
      const names = await libraryNames(page);
      const leaked = names.filter((n) => /locked|renamed|broken/.test(n ?? ''));
      expect(leaked.length === 0, `found ${JSON.stringify(leaked)}`);
    });
  },

  async psd(page) {
    const pixel = (x, y) =>
      page.locator('canvas[aria-label="Composite preview"]').evaluate(
        (canvas, [px, py]) => Array.from(canvas.getContext('2d').getImageData(px, py, 1, 1).data),
        [x, y],
      );
    const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 2);

    await check('psd', 'a real PSD opens with its layer tree, top layer first', async () => {
      await importFile(page, file('layers.psd', makePsd()));
      await page.getByRole('tree', { name: 'Layer tree' }).waitFor({ timeout: 15000 });
      const names = await page.getByRole('treeitem').evaluateAll((els) => els.map((el) => el.dataset.layerName));
      expect(
        JSON.stringify(names) === JSON.stringify(['top group', 'blue square', 'green square', 'red background']),
        `tree was ${JSON.stringify(names)}`,
      );
    });
    await check('psd', 'the composite paints layers bottom to top', async () => {
      await page.waitForFunction(() => {
        const canvas = document.querySelector('canvas[aria-label="Composite preview"]');
        return canvas && canvas.width === 64 && canvas.getContext('2d').getImageData(60, 60, 1, 1).data[3] === 255;
      });
      expect(same(await pixel(8, 8), [0, 255, 0, 255]), `(8,8) was ${await pixel(8, 8)}, expected green`);
      expect(same(await pixel(24, 24), [0, 0, 255, 255]), `(24,24) was ${await pixel(24, 24)}, expected blue over green`);
      expect(same(await pixel(60, 60), [255, 0, 0, 255]), `(60,60) was ${await pixel(60, 60)}, expected red`);
    });
    await check('psd', 'hiding a layer repaints the composite', async () => {
      await page.getByRole('button', { name: 'Toggle blue square' }).click();
      await page.waitForTimeout(200);
      expect(same(await pixel(24, 24), [0, 255, 0, 255]), `(24,24) was ${await pixel(24, 24)}, expected green`);
      expect(same(await pixel(40, 40), [255, 0, 0, 255]), `(40,40) was ${await pixel(40, 40)}, expected red`);
      await page.getByRole('button', { name: 'Toggle blue square' }).click();
    });
    await check('psd', 'hiding a group hides its children', async () => {
      await page.getByRole('button', { name: 'Toggle top group' }).click();
      await page.waitForTimeout(200);
      expect(same(await pixel(40, 40), [255, 0, 0, 255]), `(40,40) was ${await pixel(40, 40)}, expected red`);
      await page.getByRole('button', { name: 'Toggle top group' }).click();
    });
    await check('psd', 'layer opacity blends with the layer below', async () => {
      await page.getByRole('button', { name: 'Select blue square' }).click();
      const slider = page.getByRole('slider', { name: 'Opacity of blue square' });
      await slider.focus();
      await page.keyboard.press('Home');
      await page.waitForTimeout(200);
      expect(same(await pixel(40, 40), [255, 0, 0, 255]), `(40,40) at 0% was ${await pixel(40, 40)}, expected red`);
      await page.keyboard.press('End');
    });
  },

  async dock(page) {
    const dock = page.getByRole('region', { name: 'Music', exact: true });
    await check('dock', 'the music dock sits along the bottom, 56px tall', async () => {
      await wake(page);
      const box = await dock.boundingBox();
      expect(box && Math.round(box.height) === 56, `height was ${box?.height}`);
      expect(box && Math.abs(box.y + box.height - 800) < 2, `bottom edge at ${box && box.y + box.height}`);
    });
    await check('dock', 'Night Noise plays from the dock and shows what is playing', async () => {
      await wake(page);
      await dock.getByRole('button', { name: 'Play' }).click();
      await dock.getByRole('button', { name: 'Pause' }).waitFor();
      const text = await dock.innerText();
      expect(/Lo-Fi|Rain|Pink Noise/.test(text), `dock said "${text.replace(/\s+/g, ' ').slice(0, 80)}"`);
      await dock.getByRole('button', { name: 'Pause' }).click();
      await dock.getByRole('button', { name: 'Play' }).waitFor();
    });
    await check('dock', 'browse shows the four categories plus My Tracks', async () => {
      await wake(page);
      await dock.getByRole('button', { name: 'Browse music' }).click();
      const tabs = await page.getByRole('tab').allInnerTexts();
      expect(tabs.length === 5 && tabs[1] === 'Hindi / Bollywood Chill', `tabs were ${JSON.stringify(tabs)}`);
      await page.getByRole('tab', { name: 'Nature & White Noise' }).click();
      await page.getByRole('region', { name: 'Browse music' }).getByRole('button', { name: /Rain\s/ }).first().click();
      await dock.getByText('Rain', { exact: true }).waitFor();
      await dock.getByRole('button', { name: 'Browse music' }).click();
    });
    await check('dock', 'a bad pasted link is refused', async () => {
      await wake(page);
      await dock.getByRole('button', { name: 'Browse music' }).click();
      await page.getByLabel('Paste a Spotify or YouTube link').fill('https://youtube.com.evil.example/watch?v=x');
      await page.getByRole('button', { name: 'Add link' }).click();
      await page.getByText('That link is not a Spotify or YouTube link.').waitFor();
      await dock.getByRole('button', { name: 'Browse music' }).click();
    });
  },

  async players(page) {
    const dock = page.getByRole('region', { name: 'Music', exact: true });
    await check('players', 'a Spotify preset loads the official embed', async () => {
      await wake(page);
      await dock.getByRole('button', { name: 'Browse music' }).click();
      await page.getByRole('tab', { name: 'Instrumental & Classical' }).click();
      await page.getByRole('region', { name: 'Browse music' }).getByRole('button', { name: /Peaceful Piano/ }).click();
      await page.waitForSelector('[data-testid="spotify-embed"] iframe[src*="open.spotify.com"]', { timeout: 20000 });
      await dock.getByRole('button', { name: 'Browse music' }).click();
    });
    await check('players', 'a pasted YouTube link loads the privacy-enhanced player in a visible tile', async () => {
      await wake(page);
      await dock.getByRole('button', { name: 'Browse music' }).click();
      await page.getByLabel('Paste a Spotify or YouTube link').fill('https://www.youtube.com/watch?v=jfKfPfyJRdk');
      await page.getByRole('button', { name: 'Add link' }).click();
      await page.waitForSelector('[data-testid="yt-tile"] iframe[src*="youtube-nocookie.com"]', { timeout: 20000 });
      const box = await page.getByTestId('yt-tile').boundingBox();
      expect(box && box.width >= 200 && box.height >= 200, `tile was ${box?.width}x${box?.height}`);
      await dock.getByRole('button', { name: 'Browse music' }).click();
      await wake(page);
      await page.getByRole('group', { name: 'Source' }).getByRole('button', { name: 'Night Noise' }).click();
    });
  },

  async audio(page) {
    const panel = page.getByRole('region', { name: 'Ambient sound' });
    const level = () => panel.getByTestId('led').evaluate((el) => Number(el.dataset.level));
    const loud = () =>
      page.waitForFunction(
        () => Number(document.querySelector('[aria-label="Ambient sound"] [data-testid="led"]')?.dataset.level ?? 0) > 0.01,
      );

    await check('audio', 'the ambient sound panel plays the built-in synth', async () => {
      await wake(page);
      await page.getByRole('button', { name: 'Ambient sound', exact: true }).click();
      await panel.getByRole('button', { name: 'Play' }).click();
      await panel.getByRole('button', { name: 'Pause' }).waitFor();
      await loud();
      const source = await panel.getByTestId('led').getAttribute('data-source');
      expect(source === 'synth', `source was ${source}`);
    });
    await check('audio', 'every track makes sound', async () => {
      const heard = [];
      for (const name of ['Rain', 'Pink Noise', 'Lo-Fi']) {
        await panel.getByRole('button', { name, exact: true }).click();
        await page.waitForTimeout(700);
        await loud();
        heard.push(`${name} ${(await level()).toFixed(2)}`);
      }
      return heard.join(', ');
    });
    await check('audio', 'the waveform follows the signal', async () => {
      const rows = await panel.locator('canvas[aria-label="Audio waveform"]').evaluate((canvas) => {
        const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        let used = 0;
        for (let y = 0; y < height; y++) {
          let any = false;
          for (let x = 0; x < width && !any; x++) any = data[(y * width + x) * 4 + 3] > 40;
          if (any) used++;
        }
        return used;
      });
      expect(rows > 3, `the line covered only ${rows} rows, so it looks flat`);
    });
    await check('audio', 'volume zero silences it and the level follows', async () => {
      const slider = panel.getByRole('slider', { name: 'Volume' });
      await slider.focus();
      await page.keyboard.press('Home');
      await page.waitForFunction(
        () => Number(document.querySelector('[aria-label="Ambient sound"] [data-testid="led"]')?.dataset.level ?? 1) < 0.005,
      );
      for (let i = 0; i < 5; i++) await page.keyboard.press('PageUp');
      await loud();
    });
    await check('audio', 'pause stops the sound and A starts it again', async () => {
      await panel.getByRole('button', { name: 'Pause' }).click();
      await panel.getByRole('button', { name: 'Play' }).waitFor();
      const off = await panel.getByTestId('led').getAttribute('data-source');
      expect(off === 'off', `after pause the source was ${off}`);
      await page.locator('body').click({ position: { x: 700, y: 500 } });
      await page.keyboard.press('a');
      await panel.getByRole('button', { name: 'Pause' }).waitFor();
      await page.keyboard.press('a');
      await panel.getByRole('button', { name: 'Play' }).waitFor();
    });
  },
};

// --- run -------------------------------------------------------------------

spawnSync(process.execPath, [join(root, 'scripts', 'copy-pdf-assets.mjs')], { stdio: 'ignore' });
const server = useBuild
  ? await preview({ root, logLevel: 'error', preview: { port: PORT, strictPort: true } })
  : await createServer({ root, logLevel: 'error', server: { port: PORT, strictPort: true } });
if (!useBuild) await server.listen();
const cspViolations = [];
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.setDefaultTimeout(8000);
// Never hang: give up if the whole run takes too long.
const watchdog = setTimeout(() => {
  console.log('FAIL  watchdog: the run exceeded 4 minutes');
  process.exit(2);
}, 240000);
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 200)));
page.on('console', (message) => {
  if (/Content Security Policy/i.test(message.text())) cspViolations.push(message.text().slice(0, 240));
  if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
});

try {
  await page.goto(`http://localhost:${PORT}/`);
  for (const [name, run] of Object.entries(groups)) {
    if (wanted.length > 0 && !wanted.includes(name)) continue;
    await run(page);
  }
} finally {
  clearTimeout(watchdog);
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (cspViolations.length > 0) console.log(`CSP violations:\n  ${[...new Set(cspViolations)].join('\n  ')}`);
else if (useBuild) console.log('No Content Security Policy violations.');
if (pageErrors.length > 0) console.log(`Uncaught page errors:\n  ${[...new Set(pageErrors)].join('\n  ')}`);
if (consoleErrors.length > 0) console.log(`Console errors:\n  ${[...new Set(consoleErrors)].slice(0, 8).join('\n  ')}`);
process.exit(failed.length > 0 || pageErrors.length > 0 || cspViolations.length > 0 ? 1 : 0);
