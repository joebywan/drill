import { test as base, expect } from '@playwright/test';

// Lessons start straight in here: meeting a coach is one screen with its own spec (meet.spec.js).
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => { window.DRILL_MET = true; });
    await use(page);
  },
});
export { expect };
