import { LEARN, light, startedHabits, today } from '../progress.js';
import { habitsFor, subjects } from '../subjects.js';

/**
 * The garden, read from progress. Pure. Plants grow from days practised (`habits[h].days`), never
 * from the streak, so a plant never shrinks. Achievements are kept in `progress.garden.earned` and
 * are never taken back. The UI needs only `garden()`, and `award()` after a session.
 */

/** Growth stages: the days practised each one starts at. Later stages take longer, so one is always coming. */
export const STAGES = [
  { name: 'seed', at: 0 },
  { name: 'sprout', at: 1 },
  { name: 'sapling', at: 5 },
  { name: 'young', at: 14 },
  { name: 'full grown', at: 30 },
];

/**
 * The stage for `days` practised: { stage 0–4, name, next }, where `next` is { name, in, progress }
 * (days still to go, and 0–1 of the way there) for the gentle "next stage" hint, or null when full grown.
 * More days never means a lower stage.
 */
export function stage(days) {
  const n = STAGES.findLastIndex((s) => days >= s.at);
  const here = STAGES[n];
  const up = STAGES[n + 1];
  const next = up && { name: up.name, in: up.at - days, progress: (days - here.at) / (up.at - here.at) };
  return { stage: n, name: here.name, next: next || null };
}

const streak = (p, h) => p.habits[h] || { count: 0, days: 0 };
// A flower for every finished unit of a habit's course.
const FLOWERS = subjects.flatMap((s) => s.units.map((u) => ({
  id: `flower:${s.id}:${u.title}`, habit: s.habit, gift: 'flower', text: `A flower opened for ${u.title}`,
  test: (p) => u.lessons.every((l) => p.done[`${s.id}:${l.id}`]),
})));

/**
 * Achievements: { id, habit, gift, text, test(progress) }. `gift` is what arrives: a 'flower'
 * grows on the plant, anything else is a visitor. `text` is the quiet line for the end screen.
 * Adding one is a line of data here. Every habit in habitsFor(progress) gets the same visitors, so
 * a habit the learner added earns them like any other (hidden ones too: their history is kept).
 */
export const rules = (progress) => [
  ...FLOWERS,
  ...habitsFor(progress).flatMap(({ id: h }) => [
    { id: `butterfly:${h}`, habit: h, gift: 'butterfly', text: 'A butterfly arrived', test: (p) => streak(p, h).count >= 7 },
    { id: `birds:${h}`, habit: h, gift: 'birds', text: 'Birds came to stay', test: (p) => streak(p, h).days >= 30 },
  ]),
  // A bee for trying something new: the first session of any habit but Learning.
  ...habitsFor(progress).filter((h) => h.id !== LEARN).map(({ id: h, name }) => (
    { id: `bee:${h}`, habit: h, gift: 'bee', text: `A bee found ${name}`, test: (p) => streak(p, h).days >= 1 })),
];
/** The built-in habits' achievements, before the learner adds any of their own. */
export const RULES = rules(null);

/**
 * Adds every achievement now earned to `progress.garden.earned`, dated today, and returns
 * { progress, newly: [rule…] }. Never removes one: a streak starting again or the log trimming
 * changes nothing already given.
 */
export function award(progress, now = new Date()) {
  const earned = progress.garden?.earned || {};
  const newly = rules(progress).filter((r) => !earned[r.id] && r.test(progress));
  if (!newly.length) return { progress, newly };
  const date = today(now);
  const more = Object.fromEntries(newly.map((r) => [r.id, date]));
  return { progress: { ...progress, garden: { ...progress.garden, earned: { ...earned, ...more } } }, newly };
}

/**
 * The garden's mood, from each habit's light(): 'sunlit' once any habit is done today; 'resting'
 * (evening, buds closed, never sad) only when every habit that has had a session is ember;
 * 'morning' otherwise, including before the first session.
 */
export function mood(progress, now = new Date()) {
  const lit = startedHabits(progress, habitsFor(progress).map((h) => h.id))
    .filter((h) => progress.habits[h]?.last)
    .map((h) => light(progress, now, h));
  if (lit.includes('bright')) return 'sunlit';
  return lit.length && lit.every((l) => l === 'ember') ? 'resting' : 'morning';
}

/**
 * Everything the garden screen draws: { mood, plants }, a plant per started habit in habitsFor
 * order: { habit, plant, days, stage, name, next, flowers, visitors }. `plant` is the drawing a
 * self-reported habit chose (undefined for a built-in habit, whose drawing art.js knows). Flowers
 * and visitors are [{ id, gift, text, on }], `on` the date it arrived.
 */
export function garden(progress, now = new Date()) {
  const earned = progress.garden?.earned || {};
  const habits = habitsFor(progress);
  const all = rules(progress);
  const plants = startedHabits(progress, habits.map((h) => h.id)).map((habit) => {
    const days = streak(progress, habit).days || 0;
    const got = all.filter((r) => r.habit === habit && earned[r.id])
      .map(({ id, gift, text }) => ({ id, gift, text, on: earned[id] }));
    return {
      habit, plant: habits.find((h) => h.id === habit).plant, days, ...stage(days),
      flowers: got.filter((g) => g.gift === 'flower'),
      visitors: got.filter((g) => g.gift !== 'flower'),
    };
  });
  return { mood: mood(progress, now), plants };
}

const dayCount = (n, more = '') => `${n} ${more}day${n === 1 ? '' : 's'}`;

/**
 * The garden screen's words for a plant from garden(): { days: "9 days practised", next: "5 more
 * days to young" }, each '' when there is nothing to say (no days yet; full grown). Kept here so
 * the guardrail test lints them.
 */
export const plantWords = (p) => ({
  days: p.days ? `${dayCount(p.days)} practised` : '',
  next: p.next ? `${dayCount(p.next.in, 'more ')} to ${p.next.name}` : '',
});

/** After three arrival lines on an end screen, the rest in one. */
export const moreArrived = (n) => `and ${n} more in your garden`;
