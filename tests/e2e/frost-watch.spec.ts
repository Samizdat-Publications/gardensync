import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('a frost night in the forecast warns about the tender crops in the ground', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-05-10T09:00:00') });
  await page.route('https://api.open-meteo.com/v1/forecast**', (route) =>
    route.fulfill({
      json: {
        daily: {
          time: ['2027-05-10', '2027-05-11', '2027-05-12', '2027-05-13', '2027-05-14', '2027-05-15', '2027-05-16'],
          temperature_2m_min: [6, 3, -1, 1.5, 7, 8, 9],
          precipitation_sum: [0, 0, 0, 2, 0, 0, 0],
        },
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-16');
  await page.getByLabel('Typical first fall frost').fill('2027-11-04');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await page.clock.runFor(1000);
  // Give the typed-in climate a place, as a town search would, so the forecast can be fetched.
  await page.evaluate(() => {
    const env = JSON.parse(localStorage.getItem('gardensync.v8.doc')!);
    env.doc.gardens[0].climate.place = { name: 'Testville', lat: 40.8, lon: -81.38 };
    localStorage.setItem('gardensync.v8.doc', JSON.stringify(env));
  });
  await page.goto('/#/week');
  await page.reload();
  await expect(page.getByRole('heading', { name: /Frost likely on the night of May 12/ })).toBeVisible();
  await expect(page.getByText(/Cover or bring in what frost would kill: .*tomato/)).toBeVisible();
  await expect(page.locator('.nights-list li[data-frost="yes"]')).toHaveCount(1);
  await expect(page.locator('.nights-list li[data-frost="near"]')).toHaveCount(1);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations).toEqual([]);
});
