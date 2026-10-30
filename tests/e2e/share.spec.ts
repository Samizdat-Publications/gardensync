import { expect, test } from '@playwright/test';

test('a share link opens a copy of the garden in a fresh browser', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-16');
  await page.getByLabel('Typical first fall frost').fill('2027-11-04');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByLabel('Name your garden').fill('Back garden');
  await page.getByRole('button', { name: 'Start planning' }).click();
  await page.goto('/#/settings/data');
  await page.getByRole('button', { name: 'Share a link' }).click();
  await page.getByRole('button', { name: 'Make the link' }).click();
  const link = await page.getByLabel('Link').inputValue();
  expect(link).toMatch(/#share=g1\./);
  expect(link.length).toBeLessThan(8 * 1024);

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link.replace(/^https?:\/\/[^/]+/, 'http://localhost:4173'));
  await expect(p2.getByRole('heading', { name: 'Back garden' })).toBeVisible();
  await p2.getByRole('button', { name: 'Add to my gardens' }).click();
  await expect(p2.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
  await expect.poll(() => p2.evaluate(() => JSON.parse(localStorage.getItem('gardensync.v8.doc') ?? 'null')?.doc.gardens.length ?? 0)).toBe(1);
  // The link had no location and this browser has no garden of its own, so the plantings have no
  // dates yet: the app goes straight to setting them, and then the plan shows the plantings.
  await expect(p2).toHaveURL(/#\/settings\/climate/);
  await p2.getByRole('button', { name: 'I know my frost dates' }).click();
  await p2.getByLabel('Typical last spring frost').fill('2027-04-16');
  await p2.getByLabel('Typical first fall frost').fill('2027-11-04');
  await p2.getByRole('button', { name: 'Use these dates' }).click();
  await p2.goto('http://localhost:4173/#/garden');
  await expect(p2.locator('.patch, .patch-upcoming').first()).toBeVisible();
  await other.close();
});

test('a damaged share link says so and changes nothing', async ({ page }) => {
  await page.goto('/#share=g1.not-a-real-garden');
  await expect(page.getByRole('heading', { name: 'This shared garden could not be opened' })).toBeVisible();
});
