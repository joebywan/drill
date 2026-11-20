// Shared by the phone scenarios (test/phone/*.js): dates, seeded practice, and a Maths lesson played by real taps.
// Not a scenario itself: tools/phone.js runs only the files directly in test/phone.
import { award } from '../../../src/garden/model.js';
import { emptyProgress, finishPractice, finishSession, setWhen, today, track } from '../../../src/progress.js';
import { answer, right, toQuiz } from '../../../src/maths/items.js';
import { tick } from '../../../src/quiz/items.js';
import { subjects } from '../../../src/subjects.js';

/** That many days before now, at `hour` when given. */
export const daysAgo = (n, hour = null) => { const d = new Date(); d.setDate(d.getDate() - n); if (hour !== null) d.setHours(hour, 0, 0, 0); return d; };
/** Its date as the app stores it, YYYY-MM-DD. */
export const ago = (n) => today(daysAgo(n));

/** `p` with `habit` practised on each of the days `from`…`to` days ago (from > to). */
export const practised = (p, habit, from, to = 1) => {
  for (let i = from; i >= to; i--) p = habit === 'learn' ? finishSession(p, null, [], daysAgo(i)) : finishPractice(p, habit, null, daysAgo(i));
  return p;
};

/** `p` with these lessons of course `id` done `n` days ago: `which` picks them from its lessons in order. */
export const lessons = (p, id, which, n = 1) => {
  const all = subjects.find((s) => s.id === id).units.flatMap((u) => u.lessons);
  for (const l of which(all, subjects.find((s) => s.id === id).units)) p = finishSession(p, `${id}:${l.id}`, [], daysAgo(n));
  return p;
};
/** The lessons of `units` (in order) up to, not including, unit `u`'s last lesson, which is the one left to play. */
export const allBut = (u) => (_, units) => units.slice(0, u + 1).flatMap((x) => x.lessons).slice(0, -1);

/**
 * Someone `days` days in: Learning, Calm, Move and Reflect every day, Walk with a "when"; everything up to yesterday
 * (`to` = 1) or today (`to` = 0), and what that has earned in the garden. Chess and Maths go further the longer it
 * has been: a lesson at day 1, three at 7,
 * all but the last lesson of the second unit at 30, of the fourth at 60.
 * Day 0 is brand new: the habits picked, nothing done.
 */
export function daysIn(days, to = 1) {
  let p = { ...emptyProgress(), start: 'x', picked: ['calm', 'move', 'reflect', 'walk', 'learn'] };
  p = track(p, { id: 'walk', hidden: false });
  p = setWhen(p, 'walk', 'After breakfast');
  if (!days) return p;
  // Each day's first habit takes a turn, so the wing panels come in several colours.
  const all = ['learn', 'calm', 'move', 'reflect', 'walk'];
  for (let i = days; i >= to; i--) {
    for (const h of [...all.slice(i % 5), ...all.slice(0, i % 5)]) if (h !== 'learn' || i >= 1) p = practised(p, h, i, i);
  }
  const done = days >= 60 ? allBut(3) : days >= 30 ? allBut(1) : (ls) => ls.slice(0, days >= 7 ? 3 : 1);
  p = lessons(p, 'chess', done, Math.min(2, days));
  p = lessons(p, 'maths', done, Math.min(2, days));
  return award(p).progress;
}

/** Someone 30 days in (`daysIn`): Chess and Maths a unit each and the next all but its last lesson. */
export const thirtyDays = (to = 1) => daysIn(30, to);

/**
 * Every Move routine done, one a day in path order; `first` is the one home should suggest: of the routines a
 * finished path offers (`again.lessons`, each unit's last), the one done longest ago.
 */
export const moveDone = (p = { ...emptyProgress(), start: 'x' }) => {
  const move = subjects.find((s) => s.id === 'move');
  const all = move.units.flatMap((u) => u.lessons);
  all.forEach((l, i) => { p = finishPractice(p, 'move', `move:${l.id}`, daysAgo(all.length - i), { title: l.title, mins: 3 }); });
  return { p, first: all.find((l) => l.id === move.again.lessons[0]) };
};

/** Plays one Maths lesson through by real taps, from its first item to its summary. */
export async function playMaths(lesson, { page, touch, btn, swipe, shot }) {
  const bottom = page.locator('.choices');
  for (const [i, item] of lesson.items.entries()) {
    if (shot) await shot(`maths${i}-${item.type}`);
    if (item.type === 'pick') await touch(bottom.getByRole('button', { name: item.options.find((o) => right(item, o)), exact: true }));
    if (item.type === 'build') for (const c of answer(item)) await touch(bottom.getByRole('button', { name: c, exact: true, disabled: false }));
    if (item.type === 'pairs') for (const pair of toQuiz(item).pairs) for (const x of pair) await touch(bottom.getByRole('button', { name: x, exact: true, disabled: false }));
    if (item.type === 'line') {
      const k = Array.from({ length: item.ticks + 1 }, (_, j) => j).find((j) => right(item, tick(item, j)));
      const box = await page.locator('.numline .track').boundingBox();
      await swipe(page.locator('.numline .track'), 2 * ((box.width * k) / item.ticks - box.width / 2));
    }
    if (item.type !== 'teach') await page.locator('.foot.show').waitFor();
    await touch(btn('Continue'));
  }
}

/**
 * The dark theme, as the phone's own setting, put back by `off()`. Reload after either. Large text is not here: Chrome
 * replaces its page when the font scale changes, so the runner sets it before Chrome starts (PHONE_FONT_SCALE).
 */
export const looks = (adb) => ({
  dark: () => adb('shell', 'cmd', 'uimode', 'night', 'yes'),
  off: () => adb('shell', 'cmd', 'uimode', 'night', 'no'),
});

/** Shows home's tab for habit `id`, by a real tap, once it is pressed. */
export const showTab = async ({ page, touch }, id) => {
  await touch(page.locator(`.path-tab[data-path="${id}"]`));
  await page.locator(`.path-tab[data-path="${id}"][aria-pressed="true"]`).waitFor();
};
// After a tab change on a heavy home (a 30-day garden) the emulator's screen can lag the page by a second: the DOM is
// already Calm's at the top while a screenshot still shows the path before. Wait for the screen, not just the page.
/** Scrolls to the top of the page and waits for the screen to catch up. */
export const atTop = async (page) => { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1500); };
