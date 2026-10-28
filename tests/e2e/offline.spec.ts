import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('after one visit the app opens offline, with the garden', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'service worker control in Playwright is reliable in Chromium');
  await page.goto('/');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-16');
  await page.getByLabel('Typical first fall frost').fill('2027-11-04');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await page.waitForTimeout(800);
  // The service worker must be controlling the page before going offline.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
  await page.goto('/#/calendar');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('at a glance');
  await context.setOffline(false);
});

test('the app can be installed: a manifest with icons', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toBe('GardenSync');
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
});
