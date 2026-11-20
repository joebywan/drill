import { test as base, expect } from '@playwright/test';
import calm from '../../src/data/calm.json' with { type: 'json' };
import { emptyProgress, finishPractice } from '../../src/progress.js';
import { toQuiz } from '../../src/maths/items.js';
import { subjects } from '../../src/subjects.js';

// Sessions here play exactly what the course lists: meeting a coach and the repeats have their own spec (meet.spec.js).
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => { window.WINGBEAT_PLAIN = true; });
    await use(page);
  },
});
export { expect };

/**
 * A finished Calm path, as JSON for localStorage: every lesson done, each logged a day apart (a few days
 * back from `from`), `last` the lesson ids in the order they were last done, oldest first.
 */
export function calmFinished(last = ['scan2', 'breathe3', 'ground2', 'sigh2', 'hug2'], from = 10) {
  const ids = calm.units.flatMap((u) => u.lessons.map((l) => l.id));
  const order = [...ids.filter((id) => !last.includes(id)), ...last];
  let p = emptyProgress();
  order.forEach((id, i) => {
    const d = new Date(); d.setDate(d.getDate() - from - order.length + i); d.setHours(19, 0, 0, 0);
    p = finishPractice(p, 'calm', `calm:${id}`, d, { title: id, mins: 1 });
  });
  return JSON.stringify(p);
}

const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });

/** Answers a Maths or Japanese quiz item right, by taps. */
export async function solve(page, course, item) {
  const q = course === 'maths' ? toQuiz(item) : item;
  const choice = (t, side) => page.locator(`.quiz .choices .choice:not(:disabled)${side == null ? '' : `[data-side="${side}"]`}`).filter({ hasText: new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first();
  if (q.type === 'pick') await choice(q.answer).click();
  if (q.type === 'build') for (const t of q.answer) await choice(t).click();
  if (q.type === 'pairs') for (const [l, r] of q.pairs) { await choice(l, 0).click(); await choice(r, 1).click(); }
  await expect(continueButton(page), item.id).toBeInViewport();
}

/** Plays `lessonId` of a Learn course up to (not through) item `itemId`, which is left asked. Items before it must be teach cards or Maths and Japanese quiz items. */
export async function reach(page, course, lessonId, itemId) {
  const unit = subjects.find((s) => s.id === course).units.find((u) => u.lessons.some((l) => l.id === lessonId));
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
