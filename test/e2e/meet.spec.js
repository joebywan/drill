import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { vary } from '../../src/chess/items.js';

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
  // One warm-up, the lesson's nine items, two of them again.
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '12');
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
  for (let i = 0; i < 12 && !(await page.locator('.foot.show').count()); i++) {
    await page.locator('.tiles').getByRole('button', { name: 'Step up' }).click();
    await page.waitForTimeout(50);
  }
  await expect(page.locator('.foot.show.wrong')).toBeVisible();
  await page.locator('.foot.show .next').click();
  await expect(page.locator('.topic')).toHaveText('One step back');
  await expect(page.locator('.bubble')).toContainText('one block at a time');
  // Then the smaller item, and the miss comes back after what's left of the lesson.
  await page.locator('.foot.show .next').click();
  await expect(page.locator('.topic')).toHaveText('One step back');
});

const seedCard = (page, course, key) => page.addInitScript(([c, k, cd]) => {
  if (localStorage.getItem('drill.progress')) return;
  localStorage.setItem('drill.course', c);
  localStorage.setItem('drill.progress', JSON.stringify({ version: 3, picked: [], done: { [`${c}:done-already`]: true }, cards: { [k]: cd }, habits: {}, log: [] }));
}, [course, key, card]);

test('a Japanese warm-up asks a different question from the one in its lesson', async ({ page }) => {
  await seedCard(page, 'japanese', 'japanese:v2-which-13');
  await page.goto('/');
  await page.locator('.node.here').click();
  await expect(page.locator('.topic')).toHaveText('Warm up');
  await expect(page.locator('.bubble')).not.toHaveText('Which kana says "o"?');
  await expect(page.locator('.quiz .choice').first()).toBeVisible();
});

test('a chess move item warms up mirrored, and its board and text agree', async ({ page }) => {
  await seedCard(page, 'chess', 'chess:capture-0-free');
  await page.goto('/');
  await page.locator('.node.here').click();
  await expect(page.locator('.topic')).toHaveText('Warm up');
  await expect(page.locator('.board g[data-piece="bn"][data-square="h4"]')).toBeVisible(); // a4 in the course
  await page.locator('.board rect[data-square="e1"]').click(); // the queen, now on e1
  await page.locator('.board rect[data-square="h4"]').click();
  await expect(page.locator('.foot.show.right')).toBeVisible();
  await expect(page.locator('#verdict p')).toContainText('The knight on h4 is free');
});

test('a puzzle solved after its hint is logged as that, plays as a miss and comes back', async ({ page }) => {
  const courses = JSON.parse(readFileSync(new URL('../../src/data/chess.json', import.meta.url)));
  const item = courses.units.flatMap((u) => u.lessons).flatMap((l) => l.items).find((i) => i.moves?.length === 2 && i.fen.split(' ')[2] === '-');
  const mirror = vary(item);
  const game = new Chess(mirror.fen);
  game.move({ from: mirror.moves[0].slice(0, 2), to: mirror.moves[0].slice(2, 4) });
  const right = mirror.moves[1];
  const wrong = game.moves({ verbose: true }).filter((m) => m.from + m.to !== right.slice(0, 4) && !m.san.endsWith('#'))[0];
  await seedCard(page, 'chess', `chess:${item.id}`);
  await page.goto('/');
  await page.locator('.node.here').click();
  await expect(page.locator('.topic')).toHaveText('Warm up');
  await page.waitForTimeout(600); // the setup move
  const before = +await page.getByRole('progressbar').getAttribute('aria-valuemax');
  const play = async (from, to) => {
    await page.locator(`.board rect[data-square="${from}"]`).click();
    await page.locator(`.board rect[data-square="${to}"]`).click();
  };
  await play(wrong.from, wrong.to);
  await expect(page.locator('.bubble')).toContainText('Not that one');
  await play(wrong.from, wrong.to);
  await expect(page.locator('.bubble')).toContainText('The marked piece');
  await play(right.slice(0, 2), right.slice(2, 4));
  await expect(page.locator('.foot.show.wrong')).toBeVisible();
  const last = await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')).answers.at(-1));
  expect(last).toMatchObject({ key: `chess:${item.id}`, right: true, hinted: true, warm: true });
  expect(+await page.getByRole('progressbar').getAttribute('aria-valuemax')).toBe(before + 1);
});
