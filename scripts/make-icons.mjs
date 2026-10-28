// Renders the app icons (PNG) from public/icons/icon.svg with Playwright's Chromium. Run once when
// the logo changes: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const shots = [
  { file: 'icon-192.png', size: 192, pad: 0, bg: 'transparent' },
  { file: 'icon-512.png', size: 512, pad: 0, bg: 'transparent' },
  // Maskable icons keep the mark inside the 80% safe zone on a solid ground.
  { file: 'maskable-512.png', size: 512, pad: 0.14, bg: '#2e7d46' },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.08, bg: '#2e7d46' },
];
for (const s of shots) {
  const inner = Math.round(s.size * (1 - 2 * s.pad));
  await page.setViewportSize({ width: s.size, height: s.size });
  await page.setContent(
    `<html><body style="margin:0;background:${s.bg};display:flex;align-items:center;justify-content:center;width:${s.size}px;height:${s.size}px">` +
      svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `) +
      '</body></html>',
  );
  await page.screenshot({ path: `public/icons/${s.file}`, omitBackground: s.bg === 'transparent' });
}
await browser.close();
console.log('icons written');
