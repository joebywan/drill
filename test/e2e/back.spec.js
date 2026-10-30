import { test, expect } from './fixtures.js';

// The phone's back button (src/nav.js): page.goBack() is what the wrapper's web.goBack() does.
const seed = (page, extra = {}) => page.addInitScript((p) => {
  if (localStorage.getItem('drill.progress')) return;
  localStorage.setItem('drill.progress', JSON.stringify({ version: 3, picked: [], done: {}, cards: {}, habits: {}, log: [], ...p }));
}, extra);
const back = (page) => page.evaluate(() => history.back());
const onHome = (page) => expect(page.locator('main.home')).toBeVisible();
const tab = (page, name) => page.locator(`[data-path="${name}"]`).click();

test('back steps through nested screens one at a time, and home is the last stop', async ({ page }) => {
  await seed(page, { habits: { calm: { count: 1, last: '2026-10-01', forgiven: [], days: 1 } } });
  await page.goto('/');
  await onHome(page);
  const start = await page.evaluate(() => history.length);

  await page.locator('.garden-link').click();
  await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
  await page.locator('[data-plant="calm"]').click();
  await expect(page.locator('main.habit')).toBeVisible();
  await page.locator('.timings-link').click();
  await expect(page.locator('main.timings')).toBeVisible();
  await back(page);
  await expect(page.locator('main.habit:not(.timings)')).toBeVisible();
  await back(page);
  await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
  await back(page);
  await onHome(page);
  // Home sits on the first entry, so the next back leaves the app.
  await expect.poll(() => page.evaluate(() => history.state?.depth ?? 0)).toBe(0);
  expect(await page.evaluate(() => history.length)).toBeGreaterThan(start);
  await page.goBack();
  await expect(page).toHaveURL('about:blank');
});

test('an X or ← leaves no back press behind: home is still the last stop', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('.garden-link').click();
  await page.locator('.back').click();
  await onHome(page);
  await expect.poll(() => page.evaluate(() => history.state?.depth ?? 0)).toBe(0);
  await page.locator('.menu').click();
  await page.locator('[data-back]').click();
  await onHome(page);
  await expect.poll(() => page.evaluate(() => history.state?.depth ?? 0)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL('about:blank');
});

test('back from a lesson does what its X does', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('.cta .next').click();
  await expect(page.locator('main.play')).toBeVisible();
  await back(page);
  await onHome(page);
  await expect(page.locator('.cta .next')).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')).log.length)).toBe(0);
});

test('back from a routine does what its X does: how far it got is kept in `left`', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tab(page, 'calm');
  await page.locator('.cta .next').click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.orb')).toBeVisible();
  await back(page);
  await onHome(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')));
  expect(saved.log).toHaveLength(0);
  expect(Object.keys(saved.left ?? {}).length).toBeGreaterThan(0);
});

test("back from an end screen is its Continue", async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tab(page, 'reflect');
  await page.locator('.cta .next').click();
  await page.getByRole('button', { name: 'Start' }).click();
  for (const _ of [1, 2, 3]) await page.locator('.reflect-skip').click();
  await expect(page.locator('.practice-end')).toBeVisible();
  await back(page);
  await onHome(page);
});

test('back from a coach meeting, the settings, the add-a-habit sheet and its form', async ({ page }) => {
  await page.addInitScript(() => { window.DRILL_PLAIN = false; });
  await seed(page);
  await page.goto('/');
  await page.locator('.cta .next').click();
  await expect(page.locator('.meet')).toBeVisible();
  await back(page);
  await onHome(page);

  await page.locator('.menu').click();
  await page.locator('[data-change]').click();
  await expect(page.locator('[data-want]').first()).toBeVisible();
  await back(page);
  await onHome(page); // as that screen's own Back does

  await page.locator('[data-add]').click();
  await page.locator('[data-own]').click();
  await expect(page.locator('.own-habit')).toBeVisible();
  await back(page);
  await expect(page.locator('.add-habit')).toBeVisible();
  await back(page);
  await onHome(page);
});

test('back through the placement question', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('[data-place]').click();
  await page.locator('[data-i]').last().click();
  await expect(page.locator('[data-start]')).toBeVisible();
  await back(page);
  await expect(page.locator('[data-i]').first()).toBeVisible();
  await back(page);
  await onHome(page);
});

test("the first-visit intro: back from step 2 is step 1, and step 1 is the last stop", async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-next]').click();
  await expect(page.locator('[data-want]').first()).toBeVisible();
  await back(page);
  await expect(page.locator('[data-next]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.depth ?? 0)).toBe(0);
});

test('an open dialog closes on back and the screen stays, on home too', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  const open = () => page.evaluate(() => {
    const d = document.createElement('dialog');
    document.querySelector('main').append(d);
    d.showModal();
  });
  await open();
  await expect.poll(() => page.evaluate(() => history.state?.depth ?? 0)).toBe(1);
  await back(page);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await onHome(page);
  await expect.poll(() => page.evaluate(() => history.state?.depth ?? 0)).toBe(0);

  await page.locator('.garden-link').click();
  await open();
  await back(page);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
  await back(page);
  await onHome(page);
});

test('a reload part-way lands on home, on the first entry', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('.garden-link').click();
  await page.reload();
  await onHome(page);
  await expect.poll(() => page.evaluate(() => history.state?.depth ?? 0)).toBe(0);
});
