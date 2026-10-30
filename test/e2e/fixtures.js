import { test as base, expect } from '@playwright/test';

// Sessions here play exactly what the course lists: meeting a coach and the repeats have their own spec (meet.spec.js).
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => { window.DRILL_PLAIN = true; });
    await use(page);
  },
});
export { expect };
