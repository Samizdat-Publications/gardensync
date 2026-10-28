import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** First run with typed frost dates and a starter bed, then the Plants screen. */
async function toPlants(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-10-15');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).first().getByRole('link', { name: 'Plants' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Plants' })).toBeVisible();
}

async function axe(page: Page): Promise<void> {
  const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(res.violations).toEqual([]);
}

test('search, open the tomato card, read its dates and sources, and add it to the garden', async ({ page }) => {
  const errors = watchErrors(page);
  await toPlants(page);
  await expect(page.getByText(/^63 plants, each checked against at least two growing guides/)).toBeVisible();

  // Filter chips are toggle buttons.
  const pots = page.getByRole('button', { name: 'Good in pots' });
  await expect(pots).toHaveAttribute('aria-pressed', 'false');
  await pots.click();
  await expect(pots).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: /^Pumpkin/ })).toHaveCount(0);
  await pots.click();

  await page.getByLabel('Find a plant').fill('tomato');
  const tiles = page.locator('.plants-grid').getByRole('link');
  await expect(tiles.first()).toContainText('Tomato');
  await expect(tiles.first()).toContainText(/Plant out (now|from)|Start indoors now/);
  await tiles.first().click();

  await expect(page).toHaveURL(/#\/plants\/tomato$/);
  const card = page.getByRole('article', { name: 'Tomato' });
  await expect(card.getByRole('heading', { level: 2, name: 'Tomato' })).toBeFocused();
  await expect(card.getByText('Solanum lycopersicum')).toBeVisible();
  await expect(card.getByText('Nightshade family, with peppers, eggplant and potatoes')).toBeVisible();
  await expect(card.getByText('Killed by frost')).toBeVisible();

  // The when section: real dates and a reason for them.
  const when = card.getByRole('region', { name: /^When/ });
  await expect(when.locator('[data-row="bed"] .pc-dates').first()).toHaveText(/^[A-Z][a-z]{2} \d{1,2} to [A-Z][a-z]{2} \d{1,2}/);
  await expect(when.locator('[data-row="bed"] .pc-why').first()).toContainText('your last frost');

  // Sources open in a new tab, safely.
  const sources = card.locator('.pc-sources a');
  expect(await sources.count()).toBeGreaterThanOrEqual(2);
  for (const a of await sources.all()) {
    await expect(a).toHaveAttribute('href', /^https:\/\//);
    await expect(a).toHaveAttribute('target', '_blank');
    await expect(a).toHaveAttribute('rel', /noopener/);
  }

  await card.getByRole('button', { name: 'Add to the garden' }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect(errors).toEqual([]);
});

test('no plants match: a plain message and a way back', async ({ page }) => {
  await toPlants(page);
  await page.getByLabel('Find a plant').fill('zzzz');
  await expect(page.getByRole('heading', { name: 'No plants match' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear the search and filters' }).click();
  await expect(page.locator('.plants-grid').getByRole('link')).toHaveCount(63);
});

for (const size of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`axe passes on the library and the card, ${size.name} ${scheme}`, async ({ page, browserName }) => {
      // axe over all 63 plant cards is slow in WebKit; the check itself is the same.
      test.slow(browserName === 'webkit');
      const errors = watchErrors(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: scheme });
      await toPlants(page);
      await axe(page);
      await page.locator('.plants-grid').getByRole('link', { name: /^Tomato/ }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Tomato' })).toBeFocused();
      if (size.name === 'phone') {
        // The card is its own view, with a way back.
        await expect(page.locator('.plants-grid')).toBeHidden();
        const back = page.getByRole('link', { name: 'All plants' });
        await expect(back).toBeVisible();
        await axe(page);
        await back.click();
        await expect(page.locator('[data-plant-link="tomato"]')).toBeFocused();
      } else {
        await expect(page.locator('.plants-grid')).toBeVisible();
        await axe(page);
      }
      expect(errors).toEqual([]);
    });
  }
}
