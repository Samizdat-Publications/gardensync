/* Records the landing page clips and stills (site/media) from the live planner.
 *
 *   npm install; npx playwright install chromium
 *   node tools/capture-landing.js [hero foes plan schedule stills]
 *
 * Writes raw clips to ./vid/ and metadata + stills to ./out/. The clips were then trimmed and
 * re-encoded with ffmpeg (1280x720, H.264, +faststart, no audio). Uses an empty bed and the built-in
 * demo gardens only, never a real garden. Nothing here ships with the app.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'https://gardensync-e4e.pages.dev/';
const W = 1440, H = 810;
const only = process.argv.slice(2);
const want = n => !only.length || only.includes(n);

const INIT = () => {
  document.addEventListener('DOMContentLoaded', () => {
    const g = document.createElement('div');
    g.id = '__ghost';
    g.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:46px;height:46px;border-radius:50%;background:#0a1612;border:2px solid #10b981;display:none;align-items:center;justify-content:center;font-size:24px;box-shadow:0 6px 18px rgba(0,0,0,.65);transform:translate(-50%,-50%)';
    document.body.appendChild(g);
    const mv = e => { g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; };
    document.addEventListener('dragstart', e => {
      const id = e.target && e.target.dataset && e.target.dataset.plantId;
      const pl = (typeof PLANT_LIBRARY !== 'undefined' ? PLANT_LIBRARY : []).find(p => p.id === id);
      g.textContent = pl ? pl.emoji : '';
      g.style.display = 'flex'; mv(e);
    }, true);
    document.addEventListener('dragover', mv, true);
    const off = () => { g.style.display = 'none'; };
    document.addEventListener('dragend', off, true);
    document.addEventListener('drop', off, true);
  });
};
const STYLE = '.ticker-banner,.toast-notification,#plant-hover-card{display:none!important}';

async function boot(p) {
  p.on('dialog', d => d.accept());
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: STYLE });
  await p.evaluate(() => { try { state.tweaks.pageTurn = false; } catch (e) {} });
  await p.waitForTimeout(900);
}
async function newBlankBed(p) {
  await p.click('#btn-file-menu'); await p.click('#btn-new-garden'); await p.waitForTimeout(400);
  await p.getByText('CLEAR WITHOUT SAVING').click(); await p.waitForTimeout(700);
  await p.getByText('+ ADD CONTAINER').click(); await p.getByRole('menuitem', { name: 'Raised Bed' }).click(); await p.waitForTimeout(500);
  await p.click('#btn-zoom-fit'); await p.waitForTimeout(500);
}
async function preTomato(p) {
  await drag(p, 'tomato', .34, .5);
  await p.click('#btn-toggle-tasks'); await p.waitForTimeout(500);
  await p.click('#btn-zoom-fit'); await p.waitForTimeout(500);
}
async function loadDemo(p, title) {
  await p.click('#btn-file-menu'); await p.click('#btn-load-demo'); await p.waitForTimeout(400);
  await p.locator('.demo-pick', { hasText: title }).click(); await p.waitForTimeout(1000);
  const t = p.locator('#btn-toggle-tasks');
  if (await t.isVisible()) { await t.click(); await p.waitForTimeout(400); }
  await p.click('#btn-zoom-fit'); await p.waitForTimeout(500);
}
async function drag(p, id, fx, fy) {
  const bed = await p.locator('.garden-bed').first().boundingBox();
  const search = p.locator('input[placeholder^="Search"]');
  await search.fill('');
  await search.pressSequentially(id, { delay: 30 });
  await p.waitForTimeout(160);
  const item = p.locator(`.plant-item[data-plant-id="${id}"]`).first();
  const ib = await item.boundingBox();
  await p.mouse.move(ib.x + 50, ib.y + 22);
  await p.waitForTimeout(120);
  await p.mouse.down();
  const tx = bed.x + bed.width * fx, ty = bed.y + bed.height * fy;
  const sx = ib.x + 50, sy = ib.y + 22;
  await p.mouse.move(sx + 12, sy + 6, { steps: 2 });
  const N = 18;
  for (let i = 1; i <= N; i++) {
    const t = i / N, e = t * t * (3 - 2 * t);
    await p.mouse.move(sx + (tx - sx) * e, sy + (ty - sy) * e);
    await p.waitForTimeout(10);
  }
  await p.waitForTimeout(100);
  await p.mouse.up();
  await p.waitForTimeout(450);
}
async function wheel(p, total, steps, ms) {
  for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, total / steps); await p.waitForTimeout(ms); }
}

async function clip(browser, name, setup, run) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: 'vid/' + name, size: { width: W, height: H } } });
  await ctx.addInitScript(INIT);
  const t0 = Date.now();
  const p = await ctx.newPage();
  await setup(p);
  const s = (Date.now() - t0) / 1000;
  await run(p);
  await p.waitForTimeout(300);
  const e = (Date.now() - t0) / 1000;
  const v = p.video();
  await ctx.close();
  const path = await v.path();
  fs.writeFileSync(`out/${name}.json`, JSON.stringify({ name, s, e, path }));
  console.log(name, 'start', s.toFixed(2), 'end', e.toFixed(2), path);
}

(async () => {
  fs.mkdirSync('out', { recursive: true });
  const browser = await chromium.launch();
  
  if (want('hero')) await clip(browser, 'hero',
    async p => { await boot(p); await newBlankBed(p); await preTomato(p); },
    async p => {
      await p.waitForTimeout(500);
      for (const [id, fx, fy] of [['basil', .52, .30], ['marigold', .52, .72], ['carrot', .70, .35], ['onion', .70, .72]]) await drag(p, id, fx, fy);
      await p.waitForTimeout(500);
      await p.click('.nav-btn[data-tab="schedule"]'); await p.waitForTimeout(1200);
      await wheel(p, 260, 26, 55);
      await p.waitForTimeout(500);
    });

  if (want('foes')) await clip(browser, 'foes',
    async p => { await boot(p); await newBlankBed(p); await preTomato(p); for (let i = 0; i < 2; i++) { await p.click('#btn-zoom-in'); await p.waitForTimeout(400); } },
    async p => {
      await p.waitForTimeout(600);
      await drag(p, 'carrot', .46, .66);
      await p.waitForTimeout(700);
      await drag(p, 'potato', .46, .34);
      await p.waitForTimeout(1400);
      await p.keyboard.press('Control+z'); await p.waitForTimeout(1100);
      await p.keyboard.press('Control+y'); await p.waitForTimeout(1200);
    });

  if (want('plan')) await clip(browser, 'plan',
    async p => { await boot(p); await loadDemo(p, 'Community Classic'); },
    async p => {
      await p.waitForTimeout(1100);
      for (let i = 0; i < 2; i++) { await p.click('#btn-zoom-in'); await p.waitForTimeout(550); }
      await p.waitForTimeout(500);
      await p.click('#btn-grid-toggle'); await p.waitForTimeout(1300);
      await p.click('#btn-companions-toggle'); await p.waitForTimeout(1100);
      await p.click('#btn-companions-toggle'); await p.waitForTimeout(1100);
      await p.click('#btn-grid-toggle'); await p.waitForTimeout(700);
      for (let i = 0; i < 2; i++) { await p.click('#btn-zoom-out'); await p.waitForTimeout(550); }
      await p.click('#btn-zoom-fit'); await p.waitForTimeout(1300);
    });

  if (want('schedule')) await clip(browser, 'schedule',
    async p => { await boot(p); await loadDemo(p, 'Community Classic'); await p.click('.nav-btn[data-tab="schedule"]'); await p.waitForTimeout(900); },
    async p => {
      await p.waitForTimeout(1200);
      await wheel(p, 900, 60, 55);
      await p.waitForTimeout(900);
      await wheel(p, -900, 40, 35);
      await p.waitForTimeout(500);
    });

  if (want('stills')) {
    const shot = async (name, prep) => {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
      await ctx.addInitScript(INIT);
      const p = await ctx.newPage();
      await boot(p); await prep(p); await p.waitForTimeout(700);
      await p.screenshot({ path: `out/still-${name}.png` });
      console.log('still', name);
      await ctx.close();
    };
    await shot('beds', async p => { await loadDemo(p, 'Community Classic'); });
    await shot('companions', async p => {
      await newBlankBed(p); await preTomato(p);
      for (let i = 0; i < 2; i++) { await p.click('#btn-zoom-in'); await p.waitForTimeout(400); }
      await drag(p, 'carrot', .46, .66); await drag(p, 'potato', .46, .34);
      await p.mouse.move(700, 60); await p.waitForTimeout(500);
    });
    await shot('schedule', async p => { await loadDemo(p, 'Community Classic'); await p.click('.nav-btn[data-tab="schedule"]'); await p.waitForTimeout(800); });
    await shot('harvest', async p => { await loadDemo(p, 'Community Classic'); await p.click('.nav-btn[data-tab="harvest"]'); await p.waitForTimeout(800); });
    await shot('climate', async p => { await loadDemo(p, 'Community Classic'); await p.click('.nav-btn[data-tab="climate"]'); await p.waitForTimeout(3500); });
    await shot('library', async p => {
      await loadDemo(p, 'Community Classic');
      const s = p.locator('input[placeholder^="Search"]'); await s.fill('tomato'); await p.waitForTimeout(300);
      await p.locator('.plant-item[data-plant-id="tomato"]').first().click(); await p.waitForTimeout(500);
      await p.mouse.move(700, 60); await p.waitForTimeout(300);
    });
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
