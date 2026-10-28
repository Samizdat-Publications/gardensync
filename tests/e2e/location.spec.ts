import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

// The weather archive is answered from the committed Canton fixture (1995 to 2024), so no request
// leaves the machine.
function archiveBody(): string {
  const f = JSON.parse(gunzipSync(readFileSync('tests/fixtures/climate/canton-oh.json.gz')).toString()) as {
    lat: number;
    lon: number;
    elevation: number;
    timezone: string;
    start: string;
    tmin: (number | null)[];
    tmax: (number | null)[];
  };
  const t0 = Date.parse(`${f.start}T00:00:00Z`);
  const time = f.tmin.map((_, i) => new Date(t0 + i * 86_400_000).toISOString().slice(0, 10));
  return JSON.stringify({
    latitude: f.lat,
    longitude: f.lon,
    elevation: f.elevation,
    timezone: f.timezone,
    daily_units: { time: 'iso8601', temperature_2m_min: '°C', temperature_2m_max: '°C' },
    daily: { time, temperature_2m_min: f.tmin, temperature_2m_max: f.tmax },
  });
}

test.use({ geolocation: { latitude: 40.8084, longitude: -81.4347 }, permissions: ['geolocation'] });

test('"Use my location" looks up the weather for where the gardener is', async ({ page }) => {
  let asked: URL | null = null;
  await page.route('https://archive-api.open-meteo.com/**', async (route) => {
    asked = new URL(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: archiveBody() });
  });
  await page.clock.install({ time: new Date('2025-03-01T09:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await page.getByRole('button', { name: 'Start planning' }).click();
  await expect(page.locator('.place-name')).toHaveText('Your location');
  // Only a rounded position went out.
  expect(asked).not.toBeNull();
  expect(asked!.searchParams.get('latitude')).toBe('40.8100');
  expect(asked!.searchParams.get('longitude')).toBe('-81.4300');
});

test('a refused location says so and leaves the town search to use', async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByRole('alert')).toContainText('Type your town instead');
  await context.close();
});

test('searching a town: picking one closes the list, and a town outside the US starts in metric', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await page.route('https://geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        results: [
          { id: 1, name: 'Canton', latitude: 40.80, longitude: -81.38, country: 'Australia', admin1: 'Testshire', timezone: 'Australia/Melbourne' },
          { id: 2, name: 'Canton', latitude: 23.1, longitude: 113.3, country: 'China', admin1: 'Guangdong' },
        ],
      }),
    }),
  );
  await page.route('https://archive-api.open-meteo.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: archiveBody() }),
  );
  await page.clock.install({ time: new Date('2025-03-01T09:00:00') });
  await page.goto('/');
  await page.getByLabel('Town or postal code').fill('Canton');
  await page.getByRole('button', { name: /Canton\s*Testshire, Australia/ }).click();
  await expect(page.getByRole('list', { name: 'Matching places' })).toHaveCount(0);
  await expect(page.getByLabel('Town or postal code')).toHaveValue('Canton, Testshire, Australia');
  await expect(page.getByLabel(/Meters, kilograms, Celsius/)).toBeChecked();
  await context.close();
});
