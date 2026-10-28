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

async function session(record) {
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
    ...(record ? { recordVideo: { dir: TMP, size: SIZE } } : {}),
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

/** Records one shot, then cuts it to an mp4 loop and a poster. */
async function shot(name, script, { trimStart = 0.6 } = {}) {
  const { context, page } = await session(true);
  await script(page);
  const video = page.video();
  await context.close();
  const raw = await video.path();
  const mp4 = join(OUT, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(trimStart), '-i', raw, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-vf', 'fps=30', mp4]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-0.5', '-i', mp4, '-frames:v', '1', '-q:v', '3', join(OUT, `${name}.jpg`)]);
  console.log('shot', name);
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

// 1. Hero: first run to a planted bed.
await shot('hero', async (page) => {
  await page.goto(BASE);
  await pause(page, 900);
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await pause(page, 500);
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-10-20');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await pause(page, 1600);
  await page.getByLabel(/Name your garden/).fill('Back garden');
  await page.getByRole('button', { name: 'Start planning' }).click();
  await pause(page, 2600);
});

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
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(OUT, 'shot-garden.jpg'), '-vf', 'scale=1200:-1,crop=1200:630:0:0', '-q:v', '3', join(OUT, 'og.jpg')]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(OUT, 'plan.mp4'), '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer', join(DOCS, 'hero.gif')]);
console.log('done:', readdirSync(OUT).join(', '));
