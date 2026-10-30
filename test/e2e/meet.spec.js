import { test, expect } from '@playwright/test';

const seed = (page, course, done = {}) => page.addInitScript(([c, d]) => {
  if (localStorage.getItem('drill.progress')) return;
  localStorage.setItem('drill.course', c);
  localStorage.setItem('drill.progress', JSON.stringify({ version: 3, picked: [], done: d, cards: {}, habits: {}, log: [] }));
}, [course, done]);

test("a course's own coach waits on its path and introduces themselves once, before the first lesson", async ({ page }) => {
  await seed(page, 'coding');
  await page.goto('/');
  await expect(page.locator('.guide svg')).toHaveClass(/cast-fennel/);
  await page.locator('.node.here').click();
  await expect(page.getByRole('heading', { name: 'Meet Fennel' })).toBeFocused();
  await expect(page.locator('.meet .does li')).toHaveCount(3);
  await page.getByRole('button', { name: "Let's build" }).click();
  await expect(page.locator('.who svg')).toHaveClass(/cast-fennel/);
  await page.getByRole('button', { name: 'Quit lesson' }).click();
  const leave = page.getByRole('button', { name: /leave|quit/i });
  if (await leave.count()) await leave.first().click();
  await page.reload();
  await page.locator('.node.here').click();
  await expect(page.locator('.who svg')).toHaveClass(/cast-fennel/);
  await expect(page.getByRole('heading', { name: 'Meet Fennel' })).toHaveCount(0);
});

test('someone already on a course never gets the introduction', async ({ page }) => {
  await seed(page, 'maths', { 'maths:done-already': true });
  await page.goto('/');
  await expect(page.locator('.guide svg')).toHaveClass(/cast-ada/);
  await page.locator('.node.here').click();
  await expect(page.locator('.who svg')).toHaveClass(/cast-ada/);
});

const card = { due: '2020-01-01T00:00:00Z', stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: 2, last_review: '2019-12-31T00:00:00Z' };
const seeded = (page, done, cards = {}) => page.addInitScript(([d, c]) => {
  if (localStorage.getItem('drill.progress')) return;
  localStorage.setItem('drill.course', 'coding');
  localStorage.setItem('drill.progress', JSON.stringify({ version: 3, picked: [], done: d, cards: c, habits: {}, log: [] }));
}, [done, cards]);

test('a second lesson opens with an earlier item and ends with its own again', async ({ page }) => {
  await seeded(page, { 'coding:steps-0': true }, { 'coding:steps-0-one': card });
  await page.goto('/');
  await page.getByRole('button', { name: 'Around the rock, current' }).click();
  await expect(page.locator('.topic')).toHaveText('Warm up');
  // One warm-up, the lesson's nine items, three of them again.
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '13');
});

test('a unit ends in a checkpoint that mixes it', async ({ page }) => {
  await seeded(page, { 'coding:steps-0': true, 'coding:steps-1': true, 'coding:steps-2': true, 'coding:steps-3': true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Checkpoint, current' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '8');
});

test('two misses in a unit bring a second explanation and a smaller step, and the miss comes back', async ({ page }) => {
  await seeded(page, { 'coding:steps-0': true });
  await page.addInitScript(() => {
    const p = JSON.parse(localStorage.getItem('drill.progress'));
    p.answers = [{ key: 'coding:steps-0-one', right: false, ms: 1, at: '2026-01-01T00:00:00.000Z' }];
    localStorage.setItem('drill.progress', JSON.stringify(p));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Around the rock, current' }).click();
  // Past the teach card to the first marked item, then tap the first tiles until it runs and fails.
  await page.locator('.foot.show .next').click();
  const before = await page.getByRole('progressbar').getAttribute('aria-valuemax');
  for (let i = 0; i < 12 && !(await page.locator('.foot.show').count()); i++) {
    await page.locator('.tiles').getByRole('button', { name: 'Step up' }).click();
    await page.waitForTimeout(50);
  }
  await expect(page.locator('.foot.show.wrong')).toBeVisible();
  await page.locator('.foot.show .next').click();
  await expect(page.locator('.topic')).toHaveText('One step back');
  await expect(page.locator('.bubble')).toContainText('one block at a time');
  // The explanation, the smaller item and the returning miss.
  expect(+await page.getByRole('progressbar').getAttribute('aria-valuemax')).toBe(+before + 3);
});
