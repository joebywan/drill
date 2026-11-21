import { defineConfig } from '@playwright/test';

// The deployed site, played from wherever this runs. `npm run e2e:live`; LIVE_URL overrides the address.
export default defineConfig({
  testDir: 'test/live',
  outputDir: 'test-results/live', // its own: Playwright empties it when it starts, and test-results/phone is the phone's
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.LIVE_URL || 'https://knowhowit.com.au/wingbeat/',
    browserName: 'chromium',
    viewport: { width: 412, height: 915 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
});
