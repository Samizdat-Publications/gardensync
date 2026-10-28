import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build (vite preview), not the dev server,
// so what passes here is what ships.
const browsers = (process.env.E2E_BROWSERS ?? 'chromium,firefox,webkit').split(',');

export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: '**/shots.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // WebKit with axe times out under full parallel load on this PC; half the cores is dependable.
  workers: process.env.CI ? undefined : '50%',
  reporter: process.env.CI ? 'github' : 'line',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Page routing cannot see requests from a page the service worker controls (WebKit), so mocks
    // would leak to the real network. Only the offline spec turns the service worker on.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    ...browsers.map((name) => ({
      name,
      use: { ...devices[name === 'chromium' ? 'Desktop Chrome' : name === 'firefox' ? 'Desktop Firefox' : 'Desktop Safari'] },
    })),
    ...(browsers.includes('chromium') ? [{ name: 'phone', use: { ...devices['Pixel 7'] } }] : []),
  ],
});
