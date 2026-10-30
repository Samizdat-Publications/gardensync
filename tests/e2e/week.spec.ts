import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function startGarden(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-16');
  await page.getByLabel('Typical first fall frost').fill('2027-11-04');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
}

test('This week lists spring jobs for the starter bed, and a tick survives a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-04-14T09:00:00') });
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await startGarden(page);
  await page.goto('/#/week');
  await expect(page.getByRole('heading', { name: 'This week', level: 1 })).toBeVisible();
  // A job due today or later this week (ticked overdue jobs leave the "still to do" list, by design).
  const jobs = page.locator('section[aria-labelledby="wk-today"] .task, section[aria-labelledby="wk-later"] .task');
  await expect(jobs.first()).toBeVisible();
  const first = jobs.first().getByRole('checkbox');
  const label = await jobs.first().locator('.task-title').innerText();
  await first.check();
  await page.clock.runFor(1000);
  await page.reload();
  await expect(page.locator('.task', { hasText: label }).first().getByRole('checkbox')).toBeChecked();
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('This week shows the year, and Coming up gives each day one heading', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-04-14T09:00:00') });
  await startGarden(page);
  await page.goto('/#/week');
  await expect(page.locator('.week-sub')).toContainText('Sunday, April 18, 2027.');
  const days = await page.locator('.week-coming .coming-day').allTextContents();
  expect(days.length).toBeGreaterThan(0);
  expect(new Set(days).size).toBe(days.length);
});

test('a gardener starting in the fall is told when the next job is, with its year', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T10:00:00') });
  await startGarden(page);
  await page.goto('/#/week');
  await expect(page.locator('.week-empty')).toContainText(/The next job is on [A-Z][a-z]{2} \d{1,2}, 2027:/);
});
