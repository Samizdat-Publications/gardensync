import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Fixed day in spring so the starter garden has plantings visible in the current season.
const TODAY = new Date('2027-04-14T09:00:00');

async function openCalendar(page: Page): Promise<void> {
  await page.clock.setFixedTime(TODAY);
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-11-04');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await page.goto('/#/calendar');
  await page.waitForLoadState('networkidle');
}

/** If the viewport is narrow the calendar defaults to list view; switch to chart for bar tests. */
async function ensureChartVisible(page: Page): Promise<void> {
  const chartBtn = page.getByRole('button', { name: 'Show as a chart' });
  if (await chartBtn.isVisible()) await chartBtn.click();
  await expect(page.locator('.cal-chart')).toBeVisible();
}

test('calendar: no horizontal page overflow', async ({ page }) => {
  await openCalendar(page);
  // The chart must fit the viewport without causing the page to scroll sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('calendar: growing bars carry a visible tinted fill', async ({ page }) => {
  await openCalendar(page);
  await ensureChartVisible(page);
  // Each .seg-grow has an inline background set by hexToRgba(color, 0.28).
  const bg = await page.evaluate((): string => {
    const el = document.querySelector('.seg-grow') as HTMLElement | null;
    return el ? el.style.background : '';
  });
  expect(bg).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.\d+\)/);
});

test('calendar: indoor phase bars render and have dashed borders', async ({ page }) => {
  await openCalendar(page);

  // The starter garden uses method "bought" for transplants (no indoor phase shown, since
  // the gardener buys the seedling rather than raising it). Inject one explicit indoor planting
  // via localStorage so we can verify the bar rendering.
  // Wait for the app's own autosave, so it cannot overwrite what is written next.
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('gardensync.v8.doc') ?? 'null')?.doc.gardens[0]?.plantings.length ?? 0))
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('gardensync.v8.doc')!);
    const garden = data.doc.gardens[0];
    // A pot of tomato raised from the gardener's own seed: it has an indoor phase.
    // Method "transplant" + plant.methods.indoor defined => plantingPhases gives indoor != null.
    garden.containers.push({ id: 'e2ePot', form: 'vessel', kind: 'pot', name: 'Tomato pot', x: 400, y: 40, diameterCm: 45, litres: 40 });
    garden.plantings.push({ id: 'e2eIndoor1', containerId: 'e2ePot', plantId: 'tomato', count: 1, method: 'transplant', anchor: { kind: 'pinned', bedIn: '2027-05-20' } });
    localStorage.setItem('gardensync.v8.doc', JSON.stringify(data));
  });

  await page.clock.setFixedTime(TODAY);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.goto('/#/calendar');
  await page.waitForLoadState('networkidle');

  await ensureChartVisible(page);

  // There must be at least one indoor phase bar.
  const count = await page.locator('.seg-indoor').count();
  expect(count).toBeGreaterThan(0);

  // The bar must have a dashed border (not solid, not none).
  const borderStyle = await page.evaluate(() => {
    const el = document.querySelector('.seg-indoor');
    return el ? getComputedStyle(el).borderTopStyle : '';
  });
  expect(borderStyle).toBe('dashed');
});

test('calendar: narrow viewport defaults to list view', async ({ page }) => {
  await openCalendar(page);
  const viewport = page.viewportSize();
  if (!viewport) return;
  if (viewport.width < 600) {
    // Narrow: list is the default; the toggle says "Show as a chart" since list is active.
    await expect(page.locator('.cal-list')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show as a chart' })).toBeVisible();
  } else {
    // Wide: chart is the default; the toggle says "Show as a list".
    await expect(page.locator('.cal-chart')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show as a list' })).toBeVisible();
  }
});

// P1: the calendar span must match the planner season strip (Jan-Dec for northern hemisphere).
test('calendar: chart starts in January and ends in December', async ({ page }) => {
  await openCalendar(page);
  await ensureChartVisible(page);
  const monthLabels = await page.locator('.cal-month .cal-month-long').allTextContents();
  expect(monthLabels).toHaveLength(12);
  expect(monthLabels[0]).toBe('Jan');
  expect(monthLabels[monthLabels.length - 1]).toBe('Dec');
});

// P2: list view uses stacked cards (no table), every row fits without sideways scrolling.
test('calendar list view: stacked cards, no table, legend hidden', async ({ page }) => {
  await openCalendar(page);
  // Switch to list view on any viewport width.
  const listBtn = page.getByRole('button', { name: 'Show as a list' });
  if (await listBtn.isVisible()) await listBtn.click();
  await expect(page.locator('.cal-list')).toBeVisible();
  // No table element in the new stacked layout.
  await expect(page.locator('.cal-list table')).toHaveCount(0);
  // Each planting appears as a list item with a name and a dates section.
  await expect(page.locator('.cal-list-item').first()).toBeVisible();
  await expect(page.locator('.cal-list-dates').first()).toBeVisible();
  // The chart legend is hidden in list view.
  await expect(page.locator('.cal-legend')).toHaveCount(0);
  // No horizontal page overflow.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

// P4: succession rows must use date labels, not "round N" which loses meaning without context.
test('calendar: succession rows labelled by date not by round number', async ({ page }) => {
  await openCalendar(page);
  await ensureChartVisible(page);
  const labels = await page.locator('.cal-label').allTextContents();
  for (const label of labels) {
    expect(label).not.toMatch(/, round \d/);
  }
});

test('calendar: no accessibility violations', async ({ page }) => {
  await openCalendar(page);
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
});

test('calendar: the key shows status by fill style and says bars take the crop color', async ({ page }) => {
  await openCalendar(page);
  await ensureChartVisible(page);
  const key = page.locator('.cal-key');
  await expect(key).toContainText('Outline: growing in the bed');
  await expect(key).toContainText('Solid: ready to pick');
  await expect(key).toContainText("Each bar takes its crop's color.");
  // The starter's transplants are bought in spring, so no seedlings are raised indoors and the key
  // does not list them.
  await expect(page.locator('.seg-indoor')).toHaveCount(0);
  await expect(key).not.toContainText('seedlings indoors');
});

test('calendar: in the fall it opens on next year, with seedlings indoors drawn dashed', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-10-15');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await page.goto('/#/calendar');
  await expect(page.getByRole('heading', { name: '2027 at a glance', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to 2026' })).toBeVisible();
  await ensureChartVisible(page);
  expect(await page.locator('.seg-indoor').count()).toBeGreaterThan(0);
  await expect(page.locator('.cal-key')).toContainText('Dashed outline: seedlings indoors');
});
