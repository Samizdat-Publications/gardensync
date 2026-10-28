import { defineConfig } from '@playwright/test';

// `npm run shots`: captures every screen at phone, tablet and desktop sizes, light and dark,
// into review/shots/ for visual review. Not part of the pass/fail check.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/shots.spec.ts',
  reporter: 'line',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
