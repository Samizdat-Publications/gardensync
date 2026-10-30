import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('logging a harvest shows it in the list and against the crop, and it is saved', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-06-01T09:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-16');
  await page.getByLabel('Typical first fall frost').fill('2027-11-04');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await page.goto('/#/harvest');
  // Nothing is chosen for the gardener: logging before choosing asks what was picked.
  await expect(page.getByLabel('What did you pick?')).toHaveValue('');
  await page.getByLabel('Weight').fill('1.5 lb');
  await page.getByRole('button', { name: 'Log harvest' }).click();
  await expect(page.getByText('Choose what you picked.')).toBeVisible();
  // Counted crops say what they count.
  await expect(page.locator('.crop-plan-row', { hasText: 'French marigold' })).toContainText(/about \d+ flowers/);
  await page.getByLabel('What did you pick?').selectOption({ label: 'Lettuce, Bed 1' });
  await page.getByLabel('Weight').fill('1.5 lb');
  await page.getByRole('button', { name: 'Log harvest' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Logged lettuce' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Lettuce/ })).toContainText('1 lb 8 oz');
  await expect(page.getByText('Picked so far: 1 lb 8 oz.')).toBeVisible();
  await expect(page.getByRole('img', { name: /Lettuce: 1 lb 8 oz of/ })).toBeVisible();
  await page.getByLabel('Weight').fill('lots');
  await page.getByRole('button', { name: 'Log harvest' }).click();
  await expect(page.getByText(/Type the weight like/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations).toEqual([]);
});
