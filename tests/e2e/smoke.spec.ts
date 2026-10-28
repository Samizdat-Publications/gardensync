import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test('a first visit opens on "Where do you garden?" with no console errors or accessibility violations', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Where do you garden?' })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('typed frost dates and a starter bed lead to the garden, and the garden is saved', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-10-15');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
  // Autosave runs 400 ms after the last change.
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('gardensync.v8.doc') ?? 'null')?.doc.gardens[0]?.plantings.length ?? 0))
    .toBeGreaterThan(10);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Where do you garden?' })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
});
