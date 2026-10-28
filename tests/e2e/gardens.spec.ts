import { expect, test } from '@playwright/test';

test('a second garden can be added, named, switched to and deleted', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2027-03-01T09:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'I know my frost dates' }).click();
  await page.getByLabel('Typical last spring frost').fill('2027-04-16');
  await page.getByLabel('Typical first fall frost').fill('2027-11-04');
  await page.getByRole('button', { name: 'Use these dates' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();

  await page.goto('/#/settings/data');
  await page.getByRole('button', { name: 'Add another garden' }).click();
  await page.getByLabel('Garden name').fill('Front porch');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const list = page.locator('.gardens-list');
  await expect(list.getByText('Front porch')).toBeVisible();
  await expect(list.locator('li.is-active')).toContainText('Front porch');

  if (!isMobile) {
    const sw = page.getByLabel('Garden', { exact: true });
    await expect(sw.locator('option')).toHaveCount(2);
    await sw.selectOption({ index: 0 });
    await expect(list.locator('li.is-active')).not.toContainText('Front porch');
  }

  await list.locator('li', { hasText: 'Front porch' }).getByRole('button', { name: 'Delete' }).click();
  await expect(list.getByText('and everything in it?')).toBeVisible();
  await list.locator('.btn-danger').click();
  await expect(list.locator('li')).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('gardensync.v8.doc') ?? 'null')?.doc.gardens.map((g: { name: string }) => g.name)))
    .not.toContain('Front porch');
});
