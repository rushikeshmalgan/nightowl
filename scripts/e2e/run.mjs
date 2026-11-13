// End-to-end checks against the real app in a real browser.
//
//   node scripts/e2e/run.mjs            run every check
//   node scripts/e2e/run.mjs pdf psd    run only the named groups
//
// Starts its own Vite dev server and drives the Edge or Chrome already
// installed on this machine (no browser download). Exits non-zero on failure.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer, loadEnv, preview } from 'vite';
import { makePdf, makePsd, makeToneWav } from './fixtures.mjs';

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

/** A phone (375x667 unless told otherwise): touch input, mobile viewport, no hover. Fresh storage, so the seed library is present. */
async function openMobile(env, size = { width: 375, height: 667 }) {
  const context = await env.browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  watch(page);
  await page.goto(env.url, { timeout: 45000 });
  await page.waitForSelector('[data-testid="status-title"]');
  await page.waitForSelector('article');
  return { context, page };
}

const SHOTS = join(root, '.e2e-shots');
async function shot(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png` ) });
}

const groups = {
  async shell(page) {
    await check('shell', 'app loads with the seeded document', async () => {
      await page.waitForSelector('article');
      const title = await page.getByTestId('status-title').innerText();
      expect(title.includes('Sleep & Night Ergonomics'), `status title was "${title}"`);
    });
    const env = loadEnv(useBuild ? 'production' : 'development', root, 'VITE_');
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
      await check('shell', 'the reader count shows local mode without Supabase settings', async () => {
        const text = await page.getByTestId('presence').innerText();
        expect(text.includes('Local mode'), `badge said "${text}"`);
      });
    }
    await check('shell', 'the feedback form addresses the owner', async () => {
      await wake(page);
      await page.getByRole('button', { name: 'Send feedback' }).click();
      const panel = page.getByRole('region', { name: 'Feedback' });
      await panel.getByLabel('Your message').fill('The night pages toggle is great');
      const hasKey = Boolean(loadEnv(useBuild ? 'production' : 'development', root, 'VITE_').VITE_FEEDBACK_KEY);
      if (!hasKey) {
        const href = await panel.getByRole('link', { name: 'Open in your email app' }).getAttribute('href');
        expect(href?.startsWith('mailto:rushikeshmalgan0090@gmail.com?') && href.includes('night%20pages'), `link was ${href}`);
      } else {
        expect(await panel.getByRole('button', { name: 'Send' }).isVisible(), 'no Send button');
      }
      await panel.getByRole('button', { name: 'Close feedback' }).click();
      return hasKey ? 'send mode' : 'email-app mode';
    });
    await check('shell', 'on desktop the library is still a 288px side drawer with no backdrop', async () => {
      await wake(page);
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      const library = page.getByRole('region', { name: 'Library', exact: true });
      const box = await library.boundingBox();
      expect(box && Math.round(box.width) === 288 && Math.round(box.x) === 48, `library box was ${JSON.stringify(box)}`);
      expect((await page.getByTestId('sheet-backdrop').isVisible()) === false, 'the phone backdrop shows on desktop');
      expect((await library.getByTestId('sheet-header').isVisible()) === false, 'the phone handle shows on desktop');
      await page.getByRole('button', { name: 'Library', exact: true }).click();
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

  async presence(page) {
    // Only meaningful with the owner's Supabase settings, in a production build.
    const env = loadEnv('production', root, 'VITE_');
    if (!useBuild || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return;
    const badge = (p) => p.getByTestId('presence');
    await check('presence', 'one tab connects and counts itself', async () => {
      await page.waitForFunction(() => document.querySelector('[data-testid="presence"]')?.dataset.status === 'online', undefined, {
        timeout: 20000,
      });
      return await badge(page).innerText();
    });
    await check('presence', 'a second tab adds one reader in both tabs', async () => {
      // Other readers (for example the owner's own open tab) may already be counted.
      const count = (text) => Number(/^([\d,]+) online/.exec(text.trim())?.[1].replace(/,/g, '') ?? NaN);
      const before = count(await badge(page).innerText());
      const second = await page.context().newPage();
      await second.goto(page.url());
      const raised = (p) =>
        p.waitForFunction(
          (expected) => {
            const match = /^([\d,]+) online/.exec(document.querySelector('[data-testid="presence"]')?.textContent?.trim() ?? '');
            return match !== null && Number(match[1].replace(/,/g, '')) === expected;
          },
          before + 1,
          { timeout: 25000 },
        );
      await Promise.all([raised(page), raised(second)]);
      const text = await badge(second).innerText();
      await second.close();
      return `${before} -> ${count(text)}`;
    });
  },

  async offline(page) {
    const dock = page.getByRole('region', { name: 'Music', exact: true });
    await check('offline', 'the palette runs a command (theme switch)', async () => {
      await wake(page);
      await page.keyboard.press('Control+k');
      await page.getByRole('combobox').fill('theme: sepia');
      await page.keyboard.press('Enter');
      const theme = await page.evaluate(() => document.documentElement.dataset.theme);
      expect(theme === 'sepia', `theme was ${theme}`);
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.keyboard.press('Control+k');
      await page.getByRole('combobox').fill('theme: night');
      await page.keyboard.press('Enter');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    });
    await check('offline', 'an uploaded track is added to My Tracks', async () => {
      await wake(page);
      await dock.getByRole('button', { name: 'Browse music' }).click();
      await page.getByRole('tab', { name: 'My Tracks' }).click();
      await page.getByLabel('Upload tracks').setInputFiles({ name: 'tone.mp3', mimeType: 'audio/mpeg', buffer: makeToneWav() });
      await page.getByRole('region', { name: 'Browse music' }).getByRole('button', { name: /tone/ }).waitFor();
      await dock.getByRole('button', { name: 'Browse music' }).click();
    });
    if (!useBuild) return;
    await check('offline', 'with the network off, the app reloads and opens a document', async () => {
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
        }
      });
      await page.context().setOffline(true);
      await page.reload();
      // The library loads from IndexedDB after the shell appears.
      await page
        .waitForFunction(() => {
          const title = document.querySelector('[data-testid="status-title"]')?.textContent ?? '';
          return title !== '' && title !== 'No document';
        }, undefined, { timeout: 15000 })
        .catch(() => {});
      const title = await page.getByTestId('status-title').innerText();
      expect(title.length > 0 && title !== 'No document', `status title was "${title}"`);
      return title;
    });
    await check('offline', 'the uploaded track plays with the network off', async () => {
      await wake(page);
      await dock.getByRole('button', { name: 'Browse music' }).click();
      await page.getByRole('tab', { name: 'My Tracks' }).click();
      await page.getByRole('region', { name: 'Browse music' }).getByRole('button', { name: /tone/ }).click();
      await dock.getByRole('button', { name: 'Browse music' }).click();
      await wake(page);
      await dock.getByRole('button', { name: 'Play' }).click();
      await dock.getByRole('button', { name: 'Pause' }).waitFor();
      await page.waitForTimeout(600);
      const errors = await dock.getByRole('alert').count();
      expect(errors === 0, 'the dock showed an error');
      await dock.getByRole('button', { name: 'Pause' }).click();
    });
    await page.context().setOffline(false);
  },

  async mobile(_desktop, env) {
    const { context, page } = await openMobile(env);
    try {
      const tuning = page.getByRole('complementary', { name: 'Tuning' });
      /** Touch has no hover: tap empty reading space to wake the faded chrome. */
      const awake = async () => {
        await page.touchscreen.tap(200, 300);
        await page.waitForFunction(() => document.querySelector('[data-testid="chrome"]')?.dataset.idle === 'false');
      };
      await check('mobile', 'nothing scrolls sideways at 375px', async () => {
        const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: innerWidth }));
        expect(widths.doc <= widths.view, `document is ${widths.doc}px wide in a ${widths.view}px window`);
        await shot(page, 'mobile-closed');
      });
      await check('mobile', 'the emulated phone has no mouse hover', async () => {
        const hover = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
        expect(hover === false, 'the phone reports a hovering fine pointer');
      });
      await check('mobile', 'a touch on the right edge does not open the tuning panel', async () => {
        await page.touchscreen.tap(372, 300);
        await page.waitForTimeout(300);
        expect((await tuning.getAttribute('data-open')) === 'false', 'the tuning panel opened');
        expect((await page.getByTestId('tuning-hover-strip').count()) === 0, 'the hover strip exists on touch');
      });

      const sheets = [
        { label: 'Tuning', panel: tuning, closed: async () => (await tuning.getAttribute('data-open')) === 'false' },
        { label: 'Library', panel: page.getByRole('region', { name: 'Library', exact: true }), closed: async () => (await page.getByRole('region', { name: 'Library', exact: true }).count()) === 0 },
        { label: 'Ambient sound', panel: page.getByRole('region', { name: 'Ambient sound' }), closed: async () => (await page.getByRole('region', { name: 'Ambient sound' }).count()) === 0 },
      ];
      for (const sheet of sheets) {
        const open = async () => {
          await awake();
          await page.getByRole('button', { name: sheet.label, exact: true }).tap();
          await page.waitForTimeout(350);
        };
        await check('mobile', `${sheet.label} opens as a bottom sheet above the dock, leaving the document visible`, async () => {
          await open();
          const box = await sheet.panel.boundingBox();
          expect(box !== null, 'the sheet has no box');
          expect(Math.round(box.width) === 375, `width was ${box.width}`);
          expect(box.height <= 0.75 * 667 + 1, `height ${box.height} is more than 75% of the screen`);
          expect(box.y + box.height <= 667 - 56 + 1, `bottom edge ${box.y + box.height} overlaps the 56px dock`);
          expect(box.y >= 100, `top edge ${box.y} leaves under 100px of the document visible`);
          await shot(page, `mobile-sheet-${sheet.label.replace(/\W+/g, '-').toLowerCase()}`);
        });
        await check('mobile', `a tap outside dismisses the ${sheet.label} sheet`, async () => {
          await page.touchscreen.tap(187, 30);
          await page.waitForTimeout(350);
          expect(await sheet.closed(), 'the sheet is still open');
        });
        await check('mobile', `swiping the ${sheet.label} handle down dismisses it`, async () => {
          await open();
          const handle = await sheet.panel.getByTestId('sheet-handle').boundingBox();
          const x = handle.x + handle.width / 2;
          const y = handle.y + handle.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x, y + 90, { steps: 6 });
          await page.mouse.up();
          await page.waitForTimeout(350);
          expect(await sheet.closed(), 'the sheet is still open after the swipe');
        });
      }
      await check('mobile', 'the close button dismisses the sheet', async () => {
        await awake();
        await page.getByRole('button', { name: 'Library', exact: true }).tap();
        await page.getByRole('region', { name: 'Library', exact: true }).getByRole('button', { name: 'Close panel' }).tap();
        await page.waitForTimeout(350);
        expect((await page.getByRole('region', { name: 'Library', exact: true }).count()) === 0, 'still open');
      });
      await check('mobile', 'rotating to landscape does not leave the closed tuning panel on screen', async () => {
        await page.setViewportSize({ width: 800, height: 375 });
        await page.waitForTimeout(400);
        const box = await tuning.boundingBox();
        expect(box === null || box.x >= 800 || box.y >= 375, `the closed panel sits at ${JSON.stringify(box)}`);
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(300);
      });
      await check('mobile', 'zoom is one tap away over the reading area, with a 44px target', async () => {
        await awake();
        const zoomIn = page.getByRole('button', { name: 'Zoom in' });
        const box = await zoomIn.boundingBox();
        expect(box !== null, 'no zoom button');
        expect(box.width >= 44 && box.height >= 44, `target is ${box.width}x${box.height}`);
        expect(box.x + box.width <= 375 && box.y + box.height <= 667 - 56 + 1, `zoom button box ${JSON.stringify(box)} is off screen or over the dock`);
        const before = await page.locator('article').evaluate((el) => getComputedStyle(el).fontSize);
        await zoomIn.tap();
        await page.waitForTimeout(200);
        const after = await page.locator('article').evaluate((el) => getComputedStyle(el).fontSize);
        expect(before === '18px' && after === '20px', `font size went ${before} -> ${after}`);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(wide <= 375, `the page is ${wide}px wide after zooming`);
        await shot(page, 'mobile-zoom');
      });
      await check('mobile', 'zoom works on a PDF without making the page scroll sideways', async () => {
        await awake();
        await page.getByRole('button', { name: 'Library', exact: true }).tap();
        const library = page.getByRole('region', { name: 'Library', exact: true });
        await library.getByLabel('Add documents').setInputFiles({ name: 'phone.pdf', mimeType: 'application/pdf', buffer: makePdf(3) });
        await page.waitForSelector('[data-testid="pdf-page"]', { timeout: 15000 });
        await library.getByRole('button', { name: 'Close panel' }).tap();
        await awake();
        const before = await page.getByTestId('pdf-page').first().evaluate((el) => el.getBoundingClientRect().width);
        await page.getByRole('button', { name: 'Zoom in' }).tap();
        await page.waitForTimeout(600);
        const after = await page.getByTestId('pdf-page').first().evaluate((el) => el.getBoundingClientRect().width);
        expect(after > before, `page width went ${before} -> ${after}`);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(wide <= 375, `the page body is ${wide}px wide`);
        await shot(page, 'mobile-pdf-zoom');
      });
      // phone.pdf is still open from the check above.
      await check('mobile', 'on a PDF the Bionic button is disabled and says why', async () => {
        await awake();
        const bionic = page.getByRole('button', { name: 'Bionic reading', exact: true });
        expect(await bionic.isDisabled(), 'the Bionic button is still enabled on a PDF');
        const title = await bionic.getAttribute('title');
        expect(title === 'Bionic reading is not available for PDF pages.', `title was ${title}`);
        await page.keyboard.press('Control+b');
        await page.waitForTimeout(150);
        const flagged = (await page.getByTestId('status-title').locator('xpath=..').innerText()).includes('Bionic');
        expect(!flagged, 'the status line shows a Bionic flag on a PDF');
      });
      await check('mobile', 'on a PDF the dyslexia font is disabled in the sheet, with the reason on screen', async () => {
        await awake();
        await page.getByRole('button', { name: 'Tuning', exact: true }).tap();
        const sheet = page.getByRole('complementary', { name: 'Tuning' });
        await page.waitForFunction(() => document.querySelector('aside[aria-label="Tuning"]')?.dataset.open === 'true');
        await page.waitForTimeout(400);
        const toggle = sheet.getByRole('button', { name: /Dyslexia-friendly font/ });
        await toggle.scrollIntoViewIfNeeded();
        expect(await toggle.isDisabled(), 'the dyslexia toggle is still enabled on a PDF');
        const reason = sheet.getByText('The dyslexia-friendly font is not available for PDF pages.');
        await reason.scrollIntoViewIfNeeded();
        const box = await reason.boundingBox();
        expect(box !== null, 'the reason is not rendered');
        expect(box.x >= 0 && box.x + box.width <= 375 && box.y >= 0 && box.y + box.height <= 667 - 56 + 1, `reason box ${JSON.stringify(box)} is off screen or under the dock`);
        await shot(page, 'mobile-pdf-dyslexic-blocked');
        await sheet.getByRole('button', { name: 'Close panel' }).tap();
      });
      await check('mobile', 'returning to a text document turns both controls back on', async () => {
        await awake();
        await page.getByRole('button', { name: 'Library', exact: true }).tap();
        const library = page.getByRole('region', { name: 'Library', exact: true });
        await library.getByRole('button', { name: /^Open Sleep/ }).tap();
        await page.waitForSelector('article');
        await awake();
        expect(await page.getByRole('button', { name: 'Bionic reading', exact: true }).isEnabled(), 'Bionic still disabled on a text document');
        await page.getByRole('button', { name: 'Tuning', exact: true }).tap();
        await page.waitForTimeout(400);
        const toggle = page.getByRole('complementary', { name: 'Tuning' }).getByRole('button', { name: /Dyslexia-friendly font/ });
        await toggle.scrollIntoViewIfNeeded();
        expect(await toggle.isEnabled(), 'the dyslexia toggle is still disabled on a text document');
        await shot(page, 'mobile-text-dyslexic-enabled');
      });
    } finally {
      await context.close();
    }
  },

  /** The reporter's own device: a 360x800 Samsung with a real letter-size PDF open. */
  async phone(_desktop, env) {
    const { context, page } = await openMobile(env, { width: 360, height: 800 });
    const DOC = 'Must-Do Questions Sem 7 Exams.pdf';
    try {
      const awake = async () => {
        await page.touchscreen.tap(200, 300);
        await page.waitForFunction(() => document.querySelector('[data-testid="chrome"]')?.dataset.idle === 'false');
      };
      await check('phone', 'a PDF page fits the screen at 100% zoom, with no sideways scroll', async () => {
        await awake();
        await page.getByRole('button', { name: 'Library', exact: true }).tap();
        const library = page.getByRole('region', { name: 'Library', exact: true });
        await library.getByLabel('Add documents').setInputFiles({ name: DOC, mimeType: 'application/pdf', buffer: makePdf(5) });
        await page.waitForSelector('[data-testid="pdf-page"]', { timeout: 15000 });
        await library.getByRole('button', { name: 'Close panel' }).tap();
        await awake();
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => {
          const scroller = document.querySelector('[data-testid="pdf-scroll"]');
          const box = document.querySelector('[data-testid="pdf-page"]').getBoundingClientRect();
          return { left: box.left, right: box.right, scrollW: scroller.scrollWidth, clientW: scroller.clientWidth };
        });
        expect(m.left >= 48 && m.right <= 360, `the page spans ${Math.round(m.left)}-${Math.round(m.right)} on a 360px screen`);
        expect(m.scrollW <= m.clientW + 1, `the page scrolls sideways (${m.scrollW} wide in ${m.clientW})`);
        await shot(page, 'phone-pdf-fit');
      });
    } finally {
      await context.close();
    }
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
// Never hang: give up if the whole run takes too long.
const watchdog = setTimeout(() => {
  console.log('FAIL  watchdog: the run exceeded 8 minutes');
  process.exit(2);
}, 480000);
const pageErrors = [];
const consoleErrors = [];
/** Collects uncaught errors, console errors and CSP violations from a page. */
function watch(target) {
  target.setDefaultTimeout(8000);
  target.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 200)));
  target.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) cspViolations.push(message.text().slice(0, 240));
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
  });
}
watch(page);
const env = { browser, url: `http://localhost:${PORT}/` };

try {
  await page.goto(env.url, { timeout: 45000 });
  for (const [name, run] of Object.entries(groups)) {
    if (wanted.length > 0 && !wanted.includes(name)) continue;
    await run(page, env);
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
