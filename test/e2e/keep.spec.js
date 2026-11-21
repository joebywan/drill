import { test, expect, calmFinished } from './fixtures.js';

// Asking the browser to keep progress (src/keep.js). persist/persisted are counters here, never the real prompt.
// `asks` sets window.WINGBEAT_ASKS: a browser that asks the person, or one that decides by itself.
async function visit(page, { asks, kept = false, empty = false }) {
  await page.addInitScript(({ asks, kept, s }) => {
    window.WINGBEAT_ASKS = asks;
    if (s && !localStorage.getItem('wingbeat.progress')) localStorage.setItem('wingbeat.progress', s);
    window.persistCalls = 0;
    Object.defineProperty(navigator, 'storage', { configurable: true, value: {
      persisted: async () => kept,
      persist: async () => { window.persistCalls++; return false; },
    } });
  }, { asks, kept, s: empty ? JSON.stringify({ ...JSON.parse(calmFinished()), log: [], picked: [] }) : calmFinished() });
  await page.goto('/');
  await expect(page.locator('main.home')).toBeVisible();
}
const calls = (page) => page.evaluate(() => window.persistCalls);
// Away from the app is a save, and the Calm tab is where a finished path offers it.
const saveOnce = async (page) => { await page.locator('[data-path="calm"]').click(); await page.locator('[data-choose]').click(); await page.locator('.away-row').click(); };
const settings = async (page) => { await page.locator('.menu').click(); await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible(); };
const keepLine = (page) => page.locator('[data-keep]');

test('a browser that asks the person is asked once ever, at home, and has a line on the settings screen', async ({ page }) => {
  await visit(page, { asks: true });
  await expect.poll(() => calls(page)).toBe(1);
  await saveOnce(page);   // another save
  await page.reload();
  await expect(page.locator('main.home')).toBeVisible();
  await page.waitForTimeout(300);
  expect(await calls(page)).toBe(0);                   // a new visit: the counter starts again, and nothing asks
  await settings(page);
  await expect(keepLine(page)).toBeVisible();
  await keepLine(page).getByRole('button').click();
  await expect.poll(() => calls(page)).toBe(1);
});

test('an empty log asks nothing', async ({ page }) => {
  await visit(page, { asks: true, empty: true });
  await page.waitForTimeout(300);
  expect(await calls(page)).toBe(0);
});

test('no line on the settings screen once storage is kept', async ({ page }) => {
  await visit(page, { asks: true, kept: true });
  await settings(page);
  await page.waitForTimeout(300);
  await expect(keepLine(page)).toBeHidden();
  expect(await calls(page)).toBe(0);
});

test('a browser that decides by itself is asked on the first save of a visit, with no line', async ({ page }) => {
  await visit(page, { asks: false });
  await saveOnce(page);
  await expect.poll(() => calls(page)).toBe(1);
  await page.locator('[data-path="calm"]').click();
  await page.locator('[data-path="learn"]').click();
  expect(await calls(page)).toBe(1);
  await settings(page);
  await expect(keepLine(page)).toHaveCount(0);
});

test('the real detection: Gecko asks the person, Chromium decides by itself', async ({ page, browserName }) => {
  await page.goto('/');
  const asks = await page.evaluate(() => import('/src/keep.js').then((m) => m.ASKS));
  expect(asks).toBe(browserName === 'firefox');
});
