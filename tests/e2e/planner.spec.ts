import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// A fixed day in late spring, so the starter bed has plantings in the ground and dates are stable.
const TODAY = new Date('2027-05-20T10:00:00');

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('console', (m) => {
    if (m.type() === 'error') list.push(m.text());
  });
  page.on('pageerror', (e) => list.push(e.message));
  await page.clock.setFixedTime(TODAY);
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page) ?? []).toEqual([]);
});

/** First run with typed frost dates, then the chosen starter. */
async function startGarden(page: Page, starter: 'first-bed' | 'empty' = 'first-bed') {
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-10-15');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  if (starter === 'empty') await page.getByLabel(/An empty garden/).check();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /on May 20$/ })).toBeVisible();
}

const savedPlantings = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('gardensync.v8.doc') ?? 'null')?.doc.gardens[0]?.plantings.length ?? -1);

/** Choose a plant in the palette (on a phone, the palette is a sheet behind "Add plants"). */
async function choosePlant(page: Page, name: string) {
  // On a phone, bottom sheets (inspector or placement panel) cover "Add plants": dismiss them.
  // Dismiss placement panel first (may reveal a selection inspector underneath).
  const stop = page.getByRole('button', { name: 'Stop placing', exact: true }).first();
  if (await stop.isVisible()) await stop.click();
  // Then dismiss any selection inspector.
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible()) await close.click();
  const open = page.getByRole('button', { name: 'Add plants' });
  if (await open.isVisible()) await open.click();
  await page.getByLabel('Find a plant').fill(name);
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await expect(page.getByRole('heading', { name: `Placing ${name.toLowerCase()}` })).toBeVisible();
}

/** Screen point at the middle of a square of a bed drawn without rotation. */
async function square(page: Page, bed: string, col: number, row: number, cols: number, rows: number) {
  const soil = page.locator(`[data-container="${bed}"] .bed-soil`);
  // Wait for the view to settle (a phone refits the plan above the placement sheet).
  let box = await soil.boundingBox();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    const next = await soil.boundingBox();
    if (box && next && Math.abs(next.x - box.x) < 0.5 && Math.abs(next.y - box.y) < 0.5 && Math.abs(next.width - box.width) < 0.5) break;
    box = next;
  }
  if (!box) throw new Error(`no bed ${bed}`);
  return { x: box.x + ((col + 0.5) * box.width) / cols, y: box.y + ((row + 0.5) * box.height) / rows };
}

async function addFirstBed(page: Page) {
  await page.getByRole('button', { name: 'Add a 4 by 8 bed' }).click();
  await expect(page.locator('[data-container="Bed 1"] .bed-soil')).toBeVisible();
}

test('the starter bed shows its plantings, with no accessibility violations', async ({ page }) => {
  await startGarden(page);
  const bed = page.locator('[data-container="Bed 1"]');
  await expect(bed.locator('.bed-soil')).toBeVisible();
  expect(await bed.locator('.patch').count()).toBeGreaterThanOrEqual(8);
  await expect(page.locator('#plan-desc')).toContainText('Tomato, 2 in A1 to B1');
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
});

test('tapping a free square plants immediately, then undo and redo', async ({ page }) => {
  await startGarden(page, 'empty');
  await expect(page.getByRole('heading', { name: 'Add your first bed' })).toBeVisible();
  await addFirstBed(page);
  await choosePlant(page, 'Lettuce');
  // The plan switches to the next lettuce window; just tap a square to plant.
  const a = await square(page, 'Bed 1', 0, 0, 8, 4);
  await page.mouse.click(a.x, a.y);

  // A toast appears and the patch is visible.
  await expect(page.locator('[data-container="Bed 1"] [data-plant="lettuce"]')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: /Planted \d+ lettuce/ })).toBeVisible();
  await expect.poll(() => savedPlantings(page)).toBe(1);

  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);

  const edit = page.getByRole('group', { name: 'Edit' });
  await edit.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('[data-plant="lettuce"]')).toHaveCount(0);
  await expect.poll(() => savedPlantings(page)).toBe(0);
  await edit.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('[data-plant="lettuce"]')).toHaveCount(1);
  await expect.poll(() => savedPlantings(page)).toBe(1);

  // Ctrl+Z works too when focus is not in a text field.
  await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => undefined);
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-plant="lettuce"]')).toHaveCount(0);
});

test('placing with the keyboard alone', async ({ page }) => {
  await startGarden(page, 'empty');
  await addFirstBed(page);
  const open = page.getByRole('button', { name: 'Add plants' });
  if (await open.isVisible()) {
    await open.focus();
    await page.keyboard.press('Enter');
  }
  await page.getByLabel('Find a plant').focus();
  await page.keyboard.type('Lettuce');
  await page.keyboard.press('Tab');
  // Tab past the kind chips and the filter to the first plant in the list.
  for (let i = 0; i < 12; i++) {
    const name = await page.evaluate(() => document.activeElement?.textContent ?? '');
    if (name.startsWith('Lettuce')) break;
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Placing lettuce' })).toBeVisible();

  // Focus the canvas and press Enter to plant at the cursor square (immediate, no second click).
  await page.getByRole('application', { name: /Plan of/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-plant="lettuce"]')).toHaveCount(1);
  await expect.poll(() => savedPlantings(page)).toBe(1);

  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);

  // Escape stops placing.
  await choosePlant(page, 'Radish');
  await page.getByRole('application', { name: /Plan of/ }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Placing radish' })).toHaveCount(0);
});

test('adding a pot with the dialog', async ({ page }) => {
  await startGarden(page);
  await page.getByRole('button', { name: 'Add a bed or pot' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a bed or pot' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Kind').selectOption('pot');
  await dialog.getByLabel('Name').fill('Herb pot');
  await dialog.getByLabel('Width across').fill('14 in');
  await dialog.getByLabel(/Soil volume/).fill('3');
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Add pot' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-container="Herb pot"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2, name: 'Herb pot', exact: true })).toBeVisible();
  await expect(page.getByText(/Pot, 14 in across, 3 gal of soil/)).toBeVisible();
});

test('resizing a bed smaller than its plantings is refused with the reason', async ({ page }) => {
  await startGarden(page);
  await page.getByRole('button', { name: /^Bed 1/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Bed 1', exact: true })).toBeVisible();
  await page.getByLabel('Squares across').fill('2');
  await page.getByRole('button', { name: 'Resize' }).click();
  await expect(page.getByRole('alert')).toContainText('Making Bed 1 that size would leave the');
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
});

test('the season slider moves the day shown, and "Back to today" returns', async ({ page }) => {
  await startGarden(page);
  const slider = page.getByLabel('Day shown in the garden');
  await expect(slider).toHaveAttribute('aria-valuetext', 'May 20');
  await slider.focus();
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'June 19');
  await expect(page.getByRole('heading', { level: 1, name: /on Jun 19$/ })).toBeVisible();
  await expect(page.getByText('Looking ahead: today is May 20')).toBeVisible();
  await page.getByRole('button', { name: 'Back to today' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /on May 20$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to today' })).toHaveCount(0);
});

test('a selected planting shows its dates and reasons, and pulling it out can be undone', async ({ page }) => {
  await startGarden(page);
  await page.getByRole('application', { name: /Plan of/ }).focus();
  // The cursor starts on A1, the tomatoes.
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Tomato', exact: true })).toBeVisible();
  await expect(page.getByText(/^Plant out [A-Z][a-z]{2} \d+/)).toBeVisible();
  // The reason that set the date: the frost rule, or, for a planting going in after its window, saying so.
  await expect(page.getByText(/your last frost \(Apr 20\)|later than usual/i).first()).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
  const before = await savedPlantings(page);
  await page.getByRole('button', { name: 'Pull out' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Pulled out 2 tomato plants.' })).toBeVisible();
  await expect.poll(() => savedPlantings(page)).toBe(before - 1);
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => savedPlantings(page)).toBe(before);
});

test('a garden started in the fall says when its plantings go in, and shows that day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T09:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-10-15');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  const hint = page.getByText(/Nothing is in the ground yet; the first planting goes in on/);
  await expect(hint).toBeVisible();
  await page.getByRole('button', { name: /^Show the garden on [A-Z][a-z]{2} \d+$/ }).click();
  await expect(page.getByText(/Looking ahead: today is Oct 28/)).toBeVisible();
  await expect(hint).toHaveCount(0);
});

test('the plan prints as a poster and saves as a picture', async ({ page }) => {
  await startGarden(page);
  await page.locator('.bar-more > summary').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save a picture' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('my-garden.png');
  const bytes = await (await file.createReadStream()).toArray();
  const png = Buffer.concat(bytes as Buffer[]);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(10_000);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#plan-poster')).toBeVisible();
  await expect(page.locator('#plan-poster')).toContainText('Tomato');
  await expect(page.locator('.planner-main')).toBeHidden();
});
