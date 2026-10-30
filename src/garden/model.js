import { LEARN, light, startedHabits, today } from '../progress.js';
import { habitsFor, subjects } from '../subjects.js';
import { season } from './season.js';
import { EVENTS, eventOn, lessonOf } from './events.js';

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

/** The whole garden's practice: every habit's days practised, added up. Never goes down. */
export const gardenDays = (p) => Object.values(p?.habits || {}).reduce((n, h) => n + (h.days || 0), 0);

/**
 * The garden's landmarks: one-off pieces of the scene for the whole garden's practice, each its own
 * thing so every one changes the picture. `sound` is the file chime() plays when it arrives.
 * The birdhouse brings birds and the hive bees; art.js draws them with it.
 */
export const LANDMARKS = [
  { at: 3, gift: 'path', sound: 'build', text: 'A path wound into the garden' },
  { at: 10, gift: 'bench', sound: 'build', text: 'A bench to sit a while' },
  { at: 14, gift: 'birdhouse', sound: 'birds', text: 'A birdhouse, and birds moved in' },
  { at: 21, gift: 'pond', sound: 'pond', text: 'A frog joined Lumi at the pond' },
  { at: 30, gift: 'fence', sound: 'build', text: 'A little fence around it all' },
  { at: 45, gift: 'lantern', sound: 'lantern', text: 'Lanterns for the evenings' },
  { at: 60, gift: 'beehive', sound: 'bee', text: 'A hive, humming with bees' },
  { at: 90, gift: 'nest', sound: 'birds', text: 'More birds came to stay' },
];

/**
 * Achievements: { id, habit, gift, text, test(progress), sound? }. `gift` is what arrives: a
 * 'flower' grows on the plant, a 'butterfly' or 'bee' visits it, anything else is a landmark for the
 * whole garden (`habit` null). `text` is the quiet line for the end screen. Adding one is a line of
 * data here. Every habit in habitsFor(progress) earns the same visitors, so a habit the learner added
 * earns them like any other (hidden ones too: their history is kept). Each habit's visitors are their
 * own species (garden() numbers them), so no two butterflies look alike.
 */
export const rules = (progress) => [
  ...FLOWERS,
  ...habitsFor(progress).map(({ id: h }) => (
    { id: `butterfly:${h}`, habit: h, gift: 'butterfly', text: 'A butterfly arrived', test: (p) => streak(p, h).count >= 7 })),
  // A bee for trying something new: the first session of any habit but Learning.
  ...habitsFor(progress).filter((h) => h.id !== LEARN).map(({ id: h, name }) => (
    { id: `bee:${h}`, habit: h, gift: 'bee', text: `A bee found ${name}`, test: (p) => streak(p, h).days >= 1 })),
  // A ladybird for answering a comeback (src/fitting.js) with a session of its habit.
  ...habitsFor(progress).map(({ id: h }) => (
    { id: `ladybird:${h}`, habit: h, gift: 'ladybird', text: 'A ladybird came to visit', test: (p) => p.comeback?.habit === h && !!p.comeback.done })),
  ...LANDMARKS.map(({ at, gift, sound, text }) => ({ id: `garden:${gift}`, habit: null, gift, sound, text, test: (p) => gardenDays(p) >= at })),
  // A seasonal event's gift (events.js), for finishing its set in any year.
  ...EVENTS.map((e) => ({ id: `garden:${e.gift}`, habit: null, gift: e.gift, sound: e.sound, text: e.text, test: (p) => !!p.done[lessonOf(e)] })),
];
// ponytail: 'birds:<habit>' (30 days) was retired for the birdhouse, which any such garden has long
// earned; old saves keep the id in `earned`, and garden() draws only what a rule still names.
/** The built-in habits' achievements, before the learner adds any of their own. */
export const RULES = rules(null);

/**
 * Adds every achievement now earned to `progress.garden.earned`, dated today, and returns
 * { progress, newly: [rule…] }. Never removes one: a streak starting again or the log trimming
 * changes nothing already given. `only` limits it to some rules.
 */
export function award(progress, now = new Date(), only = () => true) {
  const earned = progress.garden?.earned || {};
  const newly = rules(progress).filter((r) => only(r) && !earned[r.id] && r.test(progress));
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
 * Everything the garden screen draws: { mood, season, event, plants, landmarks } (`south` flips the season; `event` is events.js's, or null),
 * a plant per started habit in habitsFor order: { habit, plant, days, stage, name, next, flowers,
 * visitors }. `plant` is the drawing a self-reported habit chose (undefined for a built-in habit,
 * whose drawing art.js knows). Flowers and visitors are [{ id, gift, text, on, species }], `on` the
 * date it arrived and `species` the habit's place in habitsFor, so each habit's butterfly and bee
 * look their own. Landmarks are the same shape, in the order they arrive.
 */
export function garden(progress, now = new Date(), south = false) {
  const earned = progress.garden?.earned || {};
  const habits = habitsFor(progress);
  const all = rules(progress);
  const plants = startedHabits(progress, habits.map((h) => h.id)).map((habit) => {
    const days = streak(progress, habit).days || 0;
    const species = habits.findIndex((h) => h.id === habit);
    const got = all.filter((r) => r.habit === habit && earned[r.id])
      .map(({ id, gift, text }) => ({ id, gift, text, on: earned[id], species }));
    return {
      habit, plant: habits.find((h) => h.id === habit).plant, days, ...stage(days),
      flowers: got.filter((g) => g.gift === 'flower'),
      visitors: got.filter((g) => g.gift !== 'flower'),
    };
  });
  const landmarks = all.filter((r) => r.habit === null && earned[r.id]).map(({ id, gift, text }) => ({ id, gift, text, on: earned[id] }));
  return { mood: mood(progress, now), season: season(now, south), event: eventOn(now, south), plants, landmarks };
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

/** The garden screen's card for the landmarks, under the plants' cards. */
export const GARDEN_WORDS = { kicker: 'The whole garden' };
