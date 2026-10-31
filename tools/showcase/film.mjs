// Films the landing page clips and stills from a running build of GardenSync 8.
//
//   npm run build; npm run preview            (in one terminal)
//   node tools/showcase/film.mjs [baseUrl]    (default http://localhost:4173)
//
// Every shot is a scripted Playwright session at 1280x720 with a fixed clock (May 20, spring), the
// light theme and a starter garden made through first run with typed frost dates, so the footage
// shows no real place and needs no network. Recordings are cut to H.264 mp4 loops with ffmpeg
// (no audio, +faststart) plus a JPG poster each; stills go to site/media and docs/media.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = 'site/media';
const DOCS = 'docs/media';
const TMP = '.film-tmp';
const SIZE = { width: 1280, height: 720 };
const DAY = new Date('2027-05-20T09:00:00');

mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });
rmSync(TMP, { recursive: true, force: true });

const browser = await chromium.launch();

async function session(record, size = SIZE, hint = false) {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
    ...(record ? { recordVideo: { dir: TMP, size } } : {}),
  });
  const page = await context.newPage();
  await page.clock.install({ time: DAY });
  // The first-time "drag a plant" tip shows only in the clip about placing.
  if (!hint) await page.addInitScript(() => localStorage.setItem('gardensync.palette-drag-hint-dismissed', '1'));
  return { context, page };
}

async function startGarden(page, starter) {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-10-20');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  if (starter) await page.getByLabel(starter).check();
  await page.getByLabel(/Name your garden/).fill('Back garden');
  await page.getByRole('button', { name: 'Start planning' }).click();
  await page.waitForTimeout(800);
}

const pause = (page, ms) => page.waitForTimeout(ms);

/**
 * Records one shot, then cuts it to an mp4 loop and a poster. The script calls mark() where the
 * footage should begin (setup before it is cut away) and may return a crop rectangle in page pixels,
 * which is cut out and scaled to 1280x720. The poster is the frame at `posterAt` seconds into the
 * cut, or its last frame.
 */
async function shot(name, script, { size = SIZE, posterAt, hint = false } = {}) {
  const { context, page } = await session(true, size, hint);
  const t0 = Date.now();
  let start = 0.6;
  const crop = await script(page, () => (start = (Date.now() - t0) / 1000));
  const video = page.video();
  await context.close();
  const raw = await video.path();
  const mp4 = join(OUT, `${name}.mp4`);
  const vf = crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=1280:720:flags=lanczos,fps=30` : 'fps=30';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', start.toFixed(2), '-i', raw, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-vf', vf, mp4]);
  const at = posterAt === undefined ? ['-sseof', '-0.5'] : ['-ss', String(posterAt)];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...at, '-i', mp4, '-frames:v', '1', '-q:v', '3', join(OUT, `${name}.jpg`)]);
  console.log('shot', name);
}

/** Moves the season slider from its current day by `days`, smoothly, over about `ms`. */
async function scrubSeason(page, days, ms) {
  const slider = page.locator('.season input[type="range"]').first();
  const from = Number(await slider.inputValue());
  const steps = Math.round(ms / 60);
  for (let i = 1; i <= steps; i++) {
    const v = Math.round(from + (days * i) / steps);
    await slider.evaluate((el, val) => {
      const input = el;
      input.value = String(val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
    await page.waitForTimeout(60);
  }
}

/** Screen point at the middle of a square of the first 8 by 4 bed. */
async function square(page, col, row) {
  const box = await page.locator('.bed-soil').first().boundingBox();
  return { x: box.x + ((col + 0.5) * box.width) / 8, y: box.y + ((row + 0.5) * box.height) / 4 };
}

/** Presses on a plant in the list and drags it, in small steps as a hand does, to a point. */
async function dragFromList(page, name, to) {
  const item = page.locator('.palette-item', { hasText: new RegExp(`^${name}`) }).first();
  await item.scrollIntoViewIfNeeded();
  const a = await item.boundingBox();
  await page.mouse.move(a.x + 40, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 60, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 45 });
  await pause(page, 250);
  await page.mouse.up();
}

/** A full-size still of the current screen. */
async function still(name, setup, dirs = [OUT, DOCS]) {
  const { context, page } = await session(false);
  await setup(page);
  await pause(page, 400);
  for (const d of dirs) await page.screenshot({ path: join(d, `${name}.jpg`), type: 'jpeg', quality: 86 });
  await context.close();
  console.log('still', name);
}

// 1. Hero: a planted bed from the first frame, then the season slider runs it from late May into
// fall, so the bed fills, changes and empties through the year. Also the hub's card clip (the hub
// shows its first 8 seconds).
await shot(
  'hero',
  async (page, mark) => {
    await startGarden(page);
    // Open on Jun 1, when the whole bed is planted.
    await scrubSeason(page, 12, 100);
    await pause(page, 600);
    mark();
    await pause(page, 1300);
    await scrubSeason(page, 120, 6200);
    await pause(page, 1400);
  },
  { posterAt: 0.4 },
);

// 1b. The hub's close-up: the same run cropped to the bed, so it reads at 640 px on a card.
await shot(
  'hub',
  async (page, mark) => {
    await startGarden(page);
    await pause(page, 600);
    const box = await page.getByRole('application', { name: /Plan of/ }).boundingBox();
    const bed = await page.locator('.bed-soil').first().boundingBox();
    // A 16:9 window around the bed, inside the plan.
    const h = Math.min(box.height, (box.width * 9) / 16, bed.height * 1.9);
    const w = (h * 16) / 9;
    const cx = Math.min(Math.max(bed.x + bed.width / 2, box.x + w / 2), box.x + box.width - w / 2);
    const cy = Math.min(Math.max(bed.y + bed.height / 2, box.y + h / 2), box.y + box.height - h / 2);
    await scrubSeason(page, 12, 100);
    await pause(page, 600);
    mark();
    await pause(page, 1000);
    await scrubSeason(page, 120, 6000);
    await pause(page, 1200);
    const even = (n) => Math.round(n / 2) * 2;
    return { w: even(w), h: even(h), x: even(cx - w / 2), y: even(cy - h / 2) };
  },
  { size: { width: 1920, height: 1080 }, posterAt: 0.4 },
);

// 2. Placing by hand: drag lettuce from the list onto a square, paint a row of carrots, drop bush
// beans, then pick the beans up and move them. Each toast says what went in and when.
await shot('plan', async (page, mark) => {
  await startGarden(page, /An empty garden/);
  await page.getByRole('button', { name: 'Add a 4 by 8 bed' }).click();
  await pause(page, 900);
  mark();
  await pause(page, 700);
  await dragFromList(page, 'Lettuce', await square(page, 1, 1));
  await pause(page, 1600);
  await page.locator('.palette-item', { hasText: /^Carrot/ }).first().click();
  await pause(page, 900);
  const a = await square(page, 0, 3);
  const b = await square(page, 3, 3);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 40 });
  await pause(page, 300);
  await page.mouse.up();
  await pause(page, 1600);
  await page.keyboard.press('Escape');
  await dragFromList(page, 'Bush bean', await square(page, 5, 1));
  await pause(page, 1600);
  await page.keyboard.press('Escape');
  const from = await square(page, 5, 1);
  const to = await square(page, 6, 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 40 });
  await page.mouse.up();
  await pause(page, 1800);
}, { hint: true });

// 3. A planting's dates and why; the season slider through the year.
await shot('schedule', async (page, mark) => {
  await startGarden(page);
  await page.getByRole('application', { name: /Plan of/ }).focus();
  await page.keyboard.press('Enter');
  await pause(page, 600);
  mark();
  await pause(page, 2000);
  // Through the summer to the first picks, keeping the plan on screen.
  await scrubSeason(page, 75, 4500);
  await pause(page, 1600);
});

// 4. This week and the year calendar.
await shot('week', async (page, mark) => {
  await startGarden(page);
  await page.goto(`${BASE}/#/week`);
  await pause(page, 500);
  mark();
  await pause(page, 3400);
  await page.goto(`${BASE}/#/calendar`);
  await pause(page, 2600);
});

// 5. The plant library and a card.
await shot('plants', async (page, mark) => {
  await startGarden(page);
  await page.goto(`${BASE}/#/plants`);
  await pause(page, 500);
  mark();
  await pause(page, 1200);
  await page.getByRole('searchbox').first().fill('tom');
  await pause(page, 900);
  await page.locator('.plants-grid').getByRole('link', { name: /^Tomato/ }).click();
  await pause(page, 3200);
});

// Stills for the README and the page.
await still('shot-garden', (p) => startGarden(p));
await still('shot-selected', async (p) => {
  await startGarden(p);
  await p.getByRole('application', { name: /Plan of/ }).focus();
  await p.keyboard.press('Enter');
});
await still('shot-week', async (p) => {
  await startGarden(p);
  await p.goto(`${BASE}/#/week`);
});
await still('shot-calendar', async (p) => {
  await startGarden(p);
  await p.goto(`${BASE}/#/calendar`);
});
await still('shot-plant', async (p) => {
  await startGarden(p);
  await p.goto(`${BASE}/#/plants/tomato`);
});
await still('shot-harvest', async (p) => {
  await startGarden(p);
  await p.goto(`${BASE}/#/harvest`);
});
await still('shot-first-run', (p) => p.goto(BASE).then(() => p.waitForTimeout(500)));

// Social card 1200x630: the name and line beside the planted bed, in the landing page's type.
{
  const bed = await session(false, { width: 1920, height: 1080 });
  await startGarden(bed.page);
  await pause(bed.page, 400);
  const box = await bed.page.locator('.bed-soil').first().boundingBox();
  const m = 46;
  await bed.page.screenshot({ path: join(TMP, 'og-bed.png'), clip: { x: box.x - m, y: box.y - m - 30, width: box.width + 2 * m, height: box.height + 2 * m + 30 } });
  await bed.context.close();
  const b64 = (path) => readFileSync(path).toString('base64');
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: D; src: url(data:font/woff2;base64,${b64('site/fonts/bricolage-grotesque-latin-opsz-normal.woff2')}) format('woff2'); font-weight: 200 800; }
    @font-face { font-family: B; src: url(data:font/woff2;base64,${b64('site/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2')}) format('woff2'); font-weight: 200 800; }
    html, body { margin: 0; width: 1200px; height: 630px; background: #f3f4ef; color: #1c231d; }
    body { display: grid; grid-template-columns: 430px 1fr; }
    .text { padding: 64px 40px 56px 64px; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
    .name { font: 800 64px/1 D, sans-serif; letter-spacing: -0.02em; color: #2e7d46; }
    .line { font: 700 38px/1.1 D, sans-serif; letter-spacing: -0.01em; }
    .sub { font: 400 21px/1.4 B, sans-serif; color: #4d584e; }
    .pic { margin: 90px 48px 90px 0; border-radius: 18px; background: #fff; overflow: hidden; border: 1px solid #d8ddd2; box-shadow: 0 16px 40px rgba(28, 35, 29, 0.14); }
    .pic img { width: 100%; height: 100%; object-fit: contain; display: block; }
  </style></head><body>
    <div class="text"><div class="name">GardenSync</div><div class="line">Plan the bed.<br>Know the dates.</div>
    <div class="sub">A free garden planner with sowing and harvest dates from 30 years of weather for your own town.</div></div>
    <div class="pic"><img src="data:image/png;base64,${b64(join(TMP, 'og-bed.png'))}"></div>
  </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, 'og.jpg'), type: 'jpeg', quality: 88 });
  await context.close();
}
await browser.close();
rmSync(TMP, { recursive: true, force: true });

// A README GIF from the hub clip.
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-t', '8', '-i', join(OUT, 'hub.mp4'), '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer', join(DOCS, 'hero.gif')]);
console.log('done:', readdirSync(OUT).join(', '));
