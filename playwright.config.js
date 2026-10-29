import { defineConfig } from '@playwright/test';

// Browser tests for the main flows, at phone size. `npm run e2e`; unit tests stay in `npm test`.
export default defineConfig({
  testDir: 'test/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:8124',
    browserName: 'chromium',
    viewport: { width: 412, height: 915 },
    reducedMotion: 'reduce', // skips demos, walks and confetti: fewer moving parts to wait on
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tools/serve.js',
    url: 'http://127.0.0.1:8124',
    reuseExistingServer: !process.env.CI,
  },
});
