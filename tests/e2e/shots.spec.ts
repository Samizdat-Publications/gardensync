import { test, type Page } from '@playwright/test';

// `npm run shots`: every screen x size x theme into review/shots/, for visual review. Not a pass/fail
// check. Gardens are made through first run with typed frost dates, so no network is needed.
const sizes = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;
const themes = ['light', 'dark'] as const;

async function startGarden(page: Page, starter?: RegExp) {
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-16');
  await page.getByLabel('Typical first fall frost').fill('2027-11-04');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  if (starter) await page.getByLabel(starter).check();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await page.waitForTimeout(600);
}

/** The garden the week and calendar shots show (made Apr 14), seen again on Jun 1, so every shot agrees. */
async function laterInSameGarden(page: Page) {
  await page.clock.install({ time: new Date('2027-04-14T09:00:00') });
  await startGarden(page);
  await page.clock.setSystemTime(new Date('2027-06-01T09:00:00'));
  await page.reload();
  await page.waitForTimeout(600);
}

const screens: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: 'first-run', go: async (page) => page.goto('/').then(() => undefined) },
  { name: 'garden', go: (page) => startGarden(page) },
  { name: 'garden-empty', go: (page) => startGarden(page, /An empty garden/) },
  {
    name: 'garden-selected',
    go: async (page) => {
      await startGarden(page);
      // Pick the first planting with the pointer, the way most people will.
      const patch = page.locator('.patch-upcoming, .patch').first();
      const box = await patch.boundingBox();
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    },
  },
  {
    name: 'garden-placing',
    go: async (page) => {
      await startGarden(page);
      const add = page.getByRole('button', { name: 'Add plants' });
      if (await add.isVisible()) await add.click();
      await page.getByRole('button', { name: /^Bush bean/ }).first().click();
    },
  },
  { name: 'print-poster', go: async (page) => { await laterInSameGarden(page); await page.emulateMedia({ media: 'print' }); } },
  { name: 'assistant', go: async (page) => { await startGarden(page); await page.getByRole('button', { name: 'Ask the assistant' }).click(); } },
  { name: 'plants', go: async (page) => { await startGarden(page); await page.goto('/#/plants'); } },
  { name: 'plant-tomato', go: async (page) => { await startGarden(page); await page.goto('/#/plants/tomato'); } },
  { name: 'week', go: async (page) => { await page.clock.install({ time: new Date('2027-04-14T09:00:00') }); await startGarden(page); await page.goto('/#/week'); } },
  { name: 'calendar', go: async (page) => { await page.clock.install({ time: new Date('2027-04-14T09:00:00') }); await startGarden(page); await page.goto('/#/calendar'); } },
  { name: 'harvest', go: async (page) => { await laterInSameGarden(page); await page.goto('/#/harvest'); } },
  { name: 'settings', go: async (page) => { await startGarden(page); await page.goto('/#/settings'); } },
];

for (const screen of screens) {
  for (const size of sizes) {
    for (const theme of themes) {
      test(`${screen.name} ${size.name} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await screen.go(page);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(300);
        // No hover state left over from the last click, and the phone's fixed bottom bar at the
        // bottom of a full-page capture rather than floating over the middle of it.
        await page.mouse.move(0, 0);
        // The plan on a phone is one screen with sheets fixed to its bottom: capture what is on screen.
        const fullPage = !(size.name === 'phone' && screen.name.startsWith('garden'));
        if (fullPage) await page.addStyleTag({ content: '.bottom-nav { position: static !important; }' });
        await page.screenshot({ path: `review/shots/${screen.name}-${size.name}-${theme}.png`, fullPage });
      });
    }
  }
}
