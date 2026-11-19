import { test as base, expect } from '@playwright/test';
import calm from '../../src/data/calm.json' with { type: 'json' };
import { emptyProgress, finishPractice } from '../../src/progress.js';

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
