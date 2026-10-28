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
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
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

async function session(record, size = SIZE) {
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
async function shot(name, script, { size = SIZE, posterAt } = {}) {
  const { context, page } = await session(true, size);
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

// 2. Placing: pick lettuce, tap two squares, see the dates it gets.
await shot('plan', async (page) => {
  await startGarden(page, /An empty garden/);
  await page.getByRole('button', { name: 'Add a bed or pot' }).first().click();
  await pause(page, 600);
  await page.getByRole('button', { name: /^Add (the )?bed$|^Add$/ }).first().click().catch(() => {});
  await pause(page, 900);
  for (const name of ['Lettuce', 'Carrot', 'Bush bean']) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
    await pause(page, 700);
    const plan = page.getByRole('application', { name: /Plan of/ });
    await plan.focus();
    await page.keyboard.press('Enter');
    await pause(page, 300);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await pause(page, 1200);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
  }
  await pause(page, 1500);
});

// 3. A planting's dates and why; the season slider through the year.
await shot('schedule', async (page) => {
  await startGarden(page);
  await page.getByRole('application', { name: /Plan of/ }).focus();
  await page.keyboard.press('Enter');
  await pause(page, 2200);
  const slider = page.getByRole('slider').first();
  await slider.focus();
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press('PageUp');
    await pause(page, 160);
  }
  await pause(page, 1200);
});

// 4. This week and the year calendar.
await shot('week', async (page) => {
  await startGarden(page);
  await page.goto(`${BASE}/#/week`);
  await pause(page, 2400);
  await page.mouse.wheel(0, 500);
  await pause(page, 1400);
  await page.goto(`${BASE}/#/calendar`);
  await pause(page, 2600);
});

// 5. The plant library and a card.
await shot('plants', async (page) => {
  await startGarden(page);
  await page.goto(`${BASE}/#/plants`);
  await pause(page, 1200);
  await page.getByRole('searchbox').first().fill('tom');
  await pause(page, 900);
  await page.locator('.plants-grid').getByRole('link', { name: /^Tomato/ }).click();
  await pause(page, 1800);
  await page.mouse.move(1000, 400);
  await page.mouse.wheel(0, 600);
  await pause(page, 1600);
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

await browser.close();
rmSync(TMP, { recursive: true, force: true });

// Social card 1200x630 and a README GIF from the hero clip.
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(OUT, 'hub.jpg'), '-vf', 'scale=1200:-1,crop=1200:630:0:(ih-630)/2', '-q:v', '3', join(OUT, 'og.jpg')]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-t', '8', '-i', join(OUT, 'hub.mp4'), '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer', join(DOCS, 'hero.gif')]);
console.log('done:', readdirSync(OUT).join(', '));
