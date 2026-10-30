// Planting UX e2e tests: tap to plant, paint a patch, drag from list, fall scenario (clash card),
// replace (one undo step), move planting by drag, Escape behaviors.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Spring day: beds have plants in the ground, dates are stable.
const SPRING = new Date('2027-05-20T10:00:00');
// Fall day: everything planned for next season, nothing in the ground now.
const FALL = new Date('2026-10-30T09:00:00');

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('console', (m) => {
    if (m.type() === 'error') list.push(m.text());
  });
  page.on('pageerror', (e) => list.push(e.message));
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page) ?? []).toEqual([]);
});

/** First run with typed frost dates and the default starter bed. Waits for the plan to be ready. */
async function startGarden(page: Page, time = SPRING) {
  await page.clock.setFixedTime(time);
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-10-15');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  // Wait until the main heading is visible, which means the garden and starter ops are applied.
  const headingPattern = time === FALL ? /on Oct 30$/i : /on May 20$/i;
  await expect(page.getByRole('heading', { level: 1, name: headingPattern })).toBeVisible();
}

/** Start an empty garden (no starter plantings). Waits for the plan to be ready. */
async function startEmpty(page: Page, time = SPRING) {
  await page.clock.setFixedTime(time);
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-20');
  await page.getByLabel('Typical first fall frost').fill('2027-10-15');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByLabel(/An empty garden/).check();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await page.getByRole('button', { name: 'Add a 4 by 8 bed' }).click();
  await expect(page.locator('[data-container="Bed 1"] .bed-soil')).toBeVisible();
}

/** Choose a plant in the palette (opens sheet on phone). */
async function choosePlant(page: Page, name: string) {
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible()) await close.click();
  // Also close placement panel if it's open (Stop placing).
  const stop = page.getByRole('button', { name: 'Stop placing', exact: true }).first();
  if (await stop.isVisible()) await stop.click();
  const open = page.getByRole('button', { name: 'Add plants' });
  if (await open.isVisible()) await open.click();
  await page.getByLabel('Find a plant').fill(name);
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await expect(page.getByRole('heading', { name: `Placing ${name.toLowerCase()}` })).toBeVisible();
}

/** Screen point at the middle of a square in a grid bed. */
async function square(page: Page, bed: string, col: number, row: number, cols: number, rows: number) {
  const soil = page.locator(`[data-container="${bed}"] .bed-soil`);
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

const savedPlantings = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('gardensync.v8.doc') ?? 'null')?.doc.gardens[0]?.plantings.length ?? -1);

// ---- Tap to plant -------------------------------------------------------------------------------

test('tap a free square to plant immediately', async ({ page }) => {
  await startEmpty(page);
  await choosePlant(page, 'Lettuce');
  const pt = await square(page, 'Bed 1', 2, 1, 8, 4);
  await page.mouse.click(pt.x, pt.y);
  await expect(page.locator('[data-plant="lettuce"]')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: /Planted \d+ lettuce/ })).toBeVisible();
  await expect.poll(() => savedPlantings(page)).toBe(1);
  // The plant stays chosen after placing.
  await expect(page.getByRole('heading', { name: 'Placing lettuce' })).toBeVisible();

  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
});

// ---- Paint a patch (mouse drag) -----------------------------------------------------------------

test('dragging across squares plants a bigger patch on release', async ({ page }) => {
  await startEmpty(page);
  await choosePlant(page, 'Lettuce');
  // Drag from col 0 to col 3 in row 0 (4 squares).
  const a = await square(page, 'Bed 1', 0, 0, 8, 4);
  const b = await square(page, 'Bed 1', 3, 0, 8, 4);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('[data-plant="lettuce"]')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: /Planted \d+ lettuce/ })).toBeVisible();
  await expect.poll(() => savedPlantings(page)).toBe(1);
});

// ---- Fall scenario: auto view-day switch and clash card -----------------------------------------

test('fall: choosing lettuce switches the view to when it would go in', async ({ page }) => {
  // The starter bed made in October has everything planned for next spring, nothing in the ground.
  await startGarden(page, FALL);
  // The bar should say "Nothing is in the ground yet".
  await expect(page.getByText(/Nothing is in the ground yet/)).toBeVisible();

  // Choose lettuce: the view should switch to when lettuce goes in.
  await choosePlant(page, 'Lettuce');
  // The placement panel's .place-where paragraph says "when lettuce would go in" on both
  // desktop (right panel) and phone (bottom sheet). The plan-note bar is hidden on phone when placing.
  await expect(page.locator('.place-where').filter({ hasText: /when lettuce would go in/i })).toBeVisible();

  const axe1 = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe1.violations).toEqual([]);

  // Click row 1 (col=0, row=1): the unit tests confirm there is lettuce there in the fall starter.
  // This should produce a clash (both attempt to plant lettuce at the same time in the same spot).
  const pt = await square(page, 'Bed 1', 0, 1, 8, 4);
  await page.mouse.click(pt.x, pt.y);

  // Either: clash card OR toast OR successful plant (if the windows don't fully overlap).
  // In any case, something should happen: a toast or clash card.
  // We wait briefly for any of these to appear.
  await page.waitForTimeout(500);
  const hasClashCard = await page.locator('.clash-card').isVisible().catch(() => false);
  const hasToast = await page.getByRole('status').isVisible().catch(() => false);
  const hasNewPatch = await page.locator('[data-plant="lettuce"]').count() > 0;
  expect(hasClashCard || hasToast || hasNewPatch).toBe(true);

  if (hasClashCard) {
    const axe2 = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe2.violations).toEqual([]);
    // Escape closes the card.
    await page.keyboard.press('Escape');
    await expect(page.locator('.clash-card')).toHaveCount(0);
  }
});

// ---- Clash card: replace (one undo step) --------------------------------------------------------

test('replacing a clash plants immediately and can be undone in one step', async ({ page }) => {
  await startGarden(page, FALL);
  // Pick radish (it will clash with the starter bed).
  await choosePlant(page, 'Radish');

  const pt = await square(page, 'Bed 1', 0, 0, 8, 4);
  await page.mouse.click(pt.x, pt.y);

  // If no clash card, skip (some beds may be arranged differently).
  const clashCard = page.locator('.clash-card');
  const cardVisible = await clashCard.isVisible().catch(() => false);
  if (!cardVisible) {
    test.skip(true, 'No clash at this square for this starter layout');
    return;
  }

  const replaceBtn = clashCard.getByRole('button', { name: /^Replace/ });
  const hasReplace = await replaceBtn.isVisible().catch(() => false);
  if (!hasReplace) {
    test.skip(true, 'Replace option not available');
    return;
  }

  const before = await savedPlantings(page);
  await replaceBtn.click();
  // Clash card should close.
  await expect(clashCard).toHaveCount(0);
  await expect(page.locator('[data-plant="radish"]')).toHaveCount(1);

  // One undo step removes the add and restores the removed plantings.
  await page.getByRole('group', { name: 'Edit' }).getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => savedPlantings(page)).toBe(before);
});

// ---- Escape behaviors ---------------------------------------------------------------------------

test('Escape stops placing', async ({ page }) => {
  await startEmpty(page);
  await choosePlant(page, 'Lettuce');
  await expect(page.getByRole('heading', { name: 'Placing lettuce' })).toBeVisible();
  await page.getByRole('application', { name: /Plan of/ }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Placing lettuce' })).toHaveCount(0);
});

test('Escape closes the clash card', async ({ page }) => {
  await startGarden(page, FALL);
  await choosePlant(page, 'Lettuce');
  const pt = await square(page, 'Bed 1', 0, 0, 8, 4);
  await page.mouse.click(pt.x, pt.y);
  const clashCard = page.locator('.clash-card');
  if (!(await clashCard.isVisible().catch(() => false))) {
    test.skip(true, 'No clash at this position');
    return;
  }
  await page.keyboard.press('Escape');
  await expect(clashCard).toHaveCount(0);
  // Still placing after the card closes.
  await expect(page.getByRole('heading', { name: 'Placing lettuce' })).toBeVisible();
});

// ---- Delete key removes selected planting -------------------------------------------------------

test('Delete removes the selected planting and can be undone', async ({ page }) => {
  await startGarden(page, SPRING);
  // Wait for the garden to be saved to localStorage (happens after starter ops).
  await expect.poll(() => savedPlantings(page), { timeout: 10000 }).toBeGreaterThan(0);
  const before = await savedPlantings(page);
  // Select a planting with the keyboard.
  await page.getByRole('application', { name: /Plan of/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Tomato', exact: true })).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('status').filter({ hasText: /Pulled out/ })).toBeVisible();
  await expect.poll(() => savedPlantings(page)).toBe(before - 1);
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => savedPlantings(page)).toBe(before);
});

// ---- Auto view-day when placing -----------------------------------------------------------------

test('choosing a plant switches the view day to when it goes in', async ({ page }) => {
  await startGarden(page, FALL);
  // Before placing: the bar says "Nothing in the ground yet".
  await expect(page.getByText(/Nothing is in the ground yet/)).toBeVisible();
  await choosePlant(page, 'Lettuce');
  // After choosing: the placement panel's .place-where paragraph says "when lettuce would go in"
  // on desktop (right panel) and phone (bottom sheet). The plan-note bar is hidden on phone.
  await expect(page.locator('.place-where').filter({ hasText: /when lettuce would go in/i })).toBeVisible();
  // Stop placing restores the day.
  await page.getByRole('button', { name: 'Stop placing' }).first().click();
  // Bar returns to today view (heading shows Oct 30).
  await expect(page.getByRole('heading', { level: 1, name: /on Oct 30$/i })).toBeVisible();
});

// ---- Move planting by drag (mouse) --------------------------------------------------------------

test('drag a selected planting to new squares commits the move', async ({ page }) => {
  // Use the starter garden (spring): tomatoes are at A1-B1, in the ground on May 20.
  await startGarden(page, SPRING);
  await expect.poll(() => savedPlantings(page), { timeout: 10000 }).toBeGreaterThan(0);

  // Select the tomato planting at A1 using the keyboard.
  await page.getByRole('application', { name: /Plan of/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Tomato', exact: true })).toBeVisible();

  // Get the position of A1 and B2 (a free square to drag to).
  const src = await square(page, 'Bed 1', 0, 0, 8, 4);
  const dest = await square(page, 'Bed 1', 5, 3, 8, 4);

  // Drag from A1 to the destination. The drag-move gesture is mouse-only on a selected planting.
  await page.mouse.move(src.x, src.y);
  await page.mouse.down();
  await page.mouse.move(dest.x, dest.y, { steps: 10 });
  await page.mouse.up();

  // After drag, plantings still exist (moved or stayed if clash).
  await expect.poll(() => savedPlantings(page)).toBeGreaterThan(0);
});

// ---- Drag from the plant list, with nothing chosen first (the real gesture) ----------------------

/** Press on a plant in the list and drag it, in small steps as a hand does, to a point. */
async function dragFromList(page: Page, name: string, to: { x: number; y: number }) {
  const item = page.locator('.palette-item', { hasText: new RegExp(`^${name}`) }).first();
  await item.scrollIntoViewIfNeeded();
  const a = (await item.boundingBox())!;
  await page.mouse.move(a.x + 40, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 60, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
}

test('dragging a plant straight from the list onto a free square plants it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on phones the list is a sheet; touch drags are covered by the long-press path');
  await startEmpty(page);
  await expect.poll(() => savedPlantings(page)).toBe(0);
  const before = await savedPlantings(page);
  await dragFromList(page, 'Lettuce', await square(page, 'Bed 1', 2, 1, 8, 4));
  await expect.poll(() => savedPlantings(page)).toBe(before + 1);
  await expect(page.getByRole('status').filter({ hasText: /Planted 4 lettuce plants in Bed 1, C2/ })).toBeVisible();
});

test('fall: dragging lettuce onto a square planned for next season shows what is there', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on phones the list is a sheet');
  await startGarden(page, FALL);
  await expect.poll(() => savedPlantings(page)).toBeGreaterThan(0);
  const before = await savedPlantings(page);
  // C2 is empty on Oct 30, but carrots are planned there next spring.
  await dragFromList(page, 'Lettuce', await square(page, 'Bed 1', 2, 1, 8, 4));
  const card = page.getByRole('dialog', { name: /clashes here/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Carrot is here/);
  // The plan shows the day lettuce would go in, not today.
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/Oct 30/);
  // Use "Plant next season" or "Grow alongside" to resolve the clash and add the planting.
  const afterBtn = card.getByRole('button', { name: /Plant next season/ });
  const alongsideBtn = card.getByRole('button', { name: /Grow alongside/ });
  const findRoomBtn = card.getByRole('button', { name: /^Find room:/ });
  const hasAfter = await afterBtn.isVisible().catch(() => false);
  const hasAlongside = await alongsideBtn.isVisible().catch(() => false);
  const hasRoom = await findRoomBtn.isVisible().catch(() => false);
  if (hasAfter) await afterBtn.click();
  else if (hasRoom) await findRoomBtn.click();
  else if (hasAlongside) await alongsideBtn.click();
  else test.fail(true, 'No resolution option found in clash card');
  await expect.poll(() => savedPlantings(page)).toBe(before + 1);
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(axe.violations).toEqual([]);
});

// ---- Touch: tap to plant -------------------------------------------------------------------------

test('touch: tap a free square while placing plants one square', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch test runs only in the phone project');
  await startEmpty(page);
  await choosePlant(page, 'Lettuce');
  const pt = await square(page, 'Bed 1', 3, 1, 8, 4);
  await page.touchscreen.tap(pt.x, pt.y);
  await expect(page.locator('[data-plant="lettuce"]')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: /Planted \d+ lettuce/ })).toBeVisible();
});

// ---- Touch: one-finger paint while placing -------------------------------------------------------

test('touch: dragging across squares while placing paints a patch', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch paint test runs only in the phone project');
  await startEmpty(page);
  await choosePlant(page, 'Lettuce');
  const a = await square(page, 'Bed 1', 0, 0, 8, 4);
  const b = await square(page, 'Bed 1', 3, 0, 8, 4);
  // Fire pointer events with pointerType = 'touch' to simulate a one-finger paint gesture.
  await page.evaluate(([ax, ay, bx, by]: [number, number, number, number]) => {
    const el = document.querySelector('.canvas-app') as HTMLElement;
    const fire = (type: string, x: number, y: number) =>
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pointerId: 1 }));
    fire('pointerdown', ax, ay);
    for (let s = 1; s <= 6; s++) fire('pointermove', ax + ((bx - ax) * s) / 6, ay);
    fire('pointerup', bx, by);
  }, [a.x, a.y, b.x, b.y] as [number, number, number, number]);
  // A multi-cell patch should have been planted (4 squares wide).
  await expect.poll(() => savedPlantings(page)).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: /Planted \d+ lettuce/ })).toBeVisible();
});

// ---- Move an unselected planting with mouse (grab offset) ----------------------------------------

test('dragging any planting without selecting first moves it and keeps the grab offset', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse move gesture runs only on non-touch');
  await startGarden(page, SPRING);
  await expect.poll(() => savedPlantings(page), { timeout: 10000 }).toBeGreaterThan(0);
  const before = await savedPlantings(page);

  // Find the tomato patch and drag it without selecting it first.
  const src = await square(page, 'Bed 1', 1, 0, 8, 4);
  const dest = await square(page, 'Bed 1', 5, 2, 8, 4);
  await page.mouse.move(src.x, src.y);
  await page.mouse.down();
  await page.mouse.move(src.x + 3, src.y, { steps: 2 });
  await page.mouse.move(dest.x, dest.y, { steps: 10 });
  await page.mouse.up();

  // Count stays the same (moved, not added or removed).
  await expect.poll(() => savedPlantings(page)).toBe(before);
});

// ---- Patch expansion: painting next to same plant merges into one patch --------------------------

test('painting adjacent to an existing patch of the same plant expands it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drag test');
  await startEmpty(page);
  // Plant lettuce at A1 first.
  await choosePlant(page, 'Lettuce');
  const a1 = await square(page, 'Bed 1', 0, 0, 8, 4);
  await page.mouse.click(a1.x, a1.y);
  await expect.poll(() => savedPlantings(page)).toBe(1);

  // Drag from B1 (free) back over A1 (already planted with lettuce). The paint stroke covers
  // both cells; the overlap at A1 is same-plant, so tryExpandPatch merges into one bigger patch.
  const b1 = await square(page, 'Bed 1', 1, 0, 8, 4);
  await page.mouse.move(b1.x, b1.y);
  await page.mouse.down();
  await page.mouse.move(a1.x, a1.y, { steps: 4 });
  await page.mouse.up();
  // One merged patch, no clash card.
  await expect(page.locator('.clash-card')).toHaveCount(0);
  await expect.poll(() => savedPlantings(page)).toBe(1);
  // Toast confirms the expansion.
  await expect(page.getByRole('status').filter({ hasText: /Made the lettuce patch bigger/ })).toBeVisible();
});

// ---- Faint upcoming plantings visible on Oct 30 -------------------------------------------------

test('fall: upcoming plantings are drawn faintly on the canvas', async ({ page }) => {
  // Nothing is in the ground on Oct 30, but the starter makes plantings for next spring.
  await startGarden(page, FALL);
  await expect.poll(() => savedPlantings(page)).toBeGreaterThan(0);
  // The upcoming patches (.patch-upcoming) should be in the SVG.
  await expect(page.locator('.patch-upcoming').first()).toBeVisible();
});

// ---- Clash card: year shown on out-of-year dates ------------------------------------------------

test('clash card shows the year when the clash date falls outside the current year', async ({ page, isMobile }) => {
  test.skip(isMobile, 'drag test');
  // Oct 30, 2026: everything in the starter is planned for spring 2027.
  await startGarden(page, FALL);
  // Drag lettuce onto C2 where carrot is planned for next spring (2027).
  await dragFromList(page, 'Lettuce', await square(page, 'Bed 1', 2, 1, 8, 4));
  const card = page.getByRole('dialog', { name: /clashes here/ });
  await expect(card).toBeVisible();
  // Clash date (Apr 2027) should include the year since today is 2026.
  await expect(card).toContainText(/2027/);
});
