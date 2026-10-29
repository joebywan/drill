import { defineConfig } from '@playwright/test';

// Browser tests for the main flows, at phone size. `npm run e2e`; unit tests stay in `npm test`.
// E2E_PORT lets parallel worktrees each test their own server (tools/serve.js reads PORT).
const port = process.env.E2E_PORT || 8124;

export default defineConfig({
  testDir: 'test/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    viewport: { width: 412, height: 915 },
    reducedMotion: 'reduce', // skips demos, walks and confetti: fewer moving parts to wait on
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `PORT=${port} node tools/serve.js`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
