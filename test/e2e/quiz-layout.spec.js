import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
import { toQuiz } from '../../src/maths/items.js';

// What a learner is working on stays in view and readable in the quiz items (src/quiz/, src/fit.js): every option of
// a pick is whole on the screen, a sentence build's slots sit clear of the tray and the verdict, and stacked bars
// clear the verdict, on a short phone too. Reached by playing the lesson up to the item, as a learner does.
const load = (name) => JSON.parse(readFileSync(new URL(`../../src/data/${name}.json`, import.meta.url)));
const COURSES = { japanese: load('japanese'), maths: load('maths') };
const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });

async function solve(page, course, item) {
  const q = course === 'maths' ? toQuiz(item) : item;
  const choice = (t, side) => page.locator(`.quiz .choices .choice:not(:disabled)${side == null ? '' : `[data-side="${side}"]`}`).filter({ hasText: new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first();
  if (q.type === 'pick') await choice(q.answer).click();
  if (q.type === 'build') for (const t of q.answer) await choice(t).click();
  if (q.type === 'pairs') for (const [l, r] of q.pairs) { await choice(l, 0).click(); await choice(r, 1).click(); }
  await expect(continueButton(page), item.id).toBeInViewport();
}

/** Plays `lessonId` up to (not through) item `itemId`, which is left asked. */
async function reach(page, course, lessonId, itemId) {
  const unit = COURSES[course].units.find((u) => u.lessons.some((l) => l.id === lessonId));
  const lesson = unit.lessons.find((l) => l.id === lessonId);
  await page.goto('/');
  await page.evaluate(([c, start, done]) => {
    localStorage.setItem('wingbeat.course', c);
    localStorage.setItem('wingbeat.progress', JSON.stringify({ ...JSON.parse(localStorage.getItem('wingbeat.progress') || '{}'), version: 3, picked: [], done, cards: {}, habits: {}, log: [], start: { [c]: start }, met: { [c]: true } }));
  }, [course, unit.title, Object.fromEntries(unit.lessons.slice(0, unit.lessons.indexOf(lesson)).map((l) => [`${course}:${l.id}`, true]))]);
  await page.reload();
  await page.getByRole('button', { name: `Continue · ${lesson.title}` }).click();
  for (const item of lesson.items) {
    if (item.id === itemId) return item;
    await solve(page, course, item);
    await continueButton(page).click();
  }
  throw new Error(`no ${itemId}`);
}

const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });

test.describe('at 412x786', () => {
  test.use({ viewport: { width: 412, height: 786 } });

  test('every option of a pick is whole on the screen, however long its label', async ({ page }) => {
    for (const [lesson, id] of [['hi', 'hi-pick-295'], ['ty', 'ty-pick-304']]) {
      await reach(page, 'japanese', lesson, id);
      const options = await page.locator('.quiz .choices .choice').evaluateAll((all) => all.map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent, left: r.left, right: r.right, clipped: e.scrollWidth > e.clientWidth + 1, h: r.height }; }));
      expect(options.length, id).toBe(3);
      for (const o of options) {
        expect(o.left, `${id} ${o.text}`).toBeGreaterThanOrEqual(0);
        expect(o.right, `${id} ${o.text}`).toBeLessThanOrEqual(412);
        expect(o.clipped, `${id} ${o.text} clipped`).toBe(false);
        expect(o.h, `${id} ${o.text} stays a full-size target`).toBeGreaterThanOrEqual(60);
      }
    }
  });
});

test.describe('at 412x533', () => {
  test.use({ viewport: { width: 412, height: 533 } });

  test('a sentence build keeps its slots above the tray, and above the verdict once answered', async ({ page }) => {
    const item = await reach(page, 'japanese', 'se3', 'se3-build-332');
    const slots = page.locator('.quiz .slots');
    expect((await rect(page, '.quiz .slots')).bottom, 'asked').toBeLessThanOrEqual((await rect(page, '.choices')).top);
    for (const t of item.answer) await page.locator('.quiz .choices .choice:not(:disabled)').filter({ hasText: new RegExp(`^${t}$`) }).first().click();
    await expect(page.locator('.foot.show')).toBeVisible();
    await expect(page.locator('.foot.show')).toHaveCSS('transform', 'none');
    expect((await rect(page, '.quiz .slots')).bottom, 'answered').toBeLessThanOrEqual((await rect(page, '.foot.show')).top);
    expect((await rect(page, '.quiz .slots')).top).toBeGreaterThanOrEqual(0);
    await expect(slots).toBeVisible();
  });

  test('stacked fraction bars stay above the verdict', async ({ page }) => {
    const item = await reach(page, 'maths', 'frac-1', 'frac-1-biggest');
    await page.locator('.quiz .choices .choice').filter({ hasText: /^1\/3$/ }).click();
    await expect(page.locator('.foot.show')).toHaveCSS('transform', 'none');
    const bars = await page.locator('.quiz .pic').evaluateAll((all) => all.map((e) => e.getBoundingClientRect().bottom));
    expect(bars.length, item.id).toBe(3);
    expect(Math.max(...bars)).toBeLessThanOrEqual((await rect(page, '.foot.show')).top);
  });
});
