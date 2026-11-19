import { LEARN, WINGS, light, startedHabits, today } from '../progress.js';
import { SKIN_WORDS } from '../cast/lines.js';
import { PRESETS, habitsFor, subjects } from '../subjects.js';
import { season } from './season.js';
import { SPECIES, speciesFor } from '../cast/butterfly.js';
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

// --- Raised butterflies ------------------------------------------------------------------------

/** The life cycle, in order. Each stage reached is a rule, id `${LIFE_IDS[k]}:${raiser}`, so it is kept and never taken back. */
export const LIFE = ['egg', 'caterpillar', 'chrysalis', 'butterfly'];
const LIFE_IDS = ['egg', 'hatched', 'chrysalis', 'emerged'];

/**
 * A course with `n` units, `d` finished: an egg at 0, a caterpillar from 1 to n − 2, a chrysalis at
 * n − 1 and the butterfly at n. A three-unit course moves a stage a unit.
 */
export const courseStage = (n, d) => (d >= n ? 3 : d >= 1 && d === n - 1 ? 2 : d >= 1 ? 1 : 0);
/** A practice or one-tap habit, by days practised, at its plant's STAGES: the plant's stage less one. */
export const habitStage = (days) => Math.max(0, stage(days).stage - 1);

/**
 * Everything that raises a butterfly: every Learn course (on the Learning plant), then every habit
 * but Learning, as { id, name, habit, species, units? }. A habit of the learner's own takes its place
 * among their own habits for its species, so hiding one changes no one's butterfly.
 */
export function raisers(progress) {
  const habits = habitsFor(progress);
  const own = habits.filter((h) => h.own);
  return [
    ...subjects.filter((s) => s.kind === 'learn').map((s) => ({ id: s.id, name: s.title, habit: LEARN, species: speciesFor(s.id), units: s.units })),
    ...habits.filter((h) => h.id !== LEARN).map((h) => ({ id: h.id, name: h.name, habit: h.id, species: speciesFor(h.id, own.indexOf(h)) })),
  ];
}

/**
 * Where a raiser's creature is now, from progress alone: { started, stage 0–3, growth 0–1 (the
 * caterpillar's size), next: { stage, in, unit } | null }, `in` units or days still to go. A course
 * starts at its first finished lesson, a habit at its first day.
 */
export function grown(p, r) {
  const units = r.units;
  const n = units ? units.length : 30;
  const x = units ? units.filter((u) => u.lessons.every((l) => p.done[`${r.id}:${l.id}`])).length : streak(p, r.habit).days || 0;
  const started = units ? units.some((u) => u.lessons.some((l) => p.done[`${r.id}:${l.id}`])) : x >= 1;
  const at = units ? (d) => courseStage(n, d) : habitStage;
  const k = at(x);
  let next = null;
  for (let y = x + 1; y <= n && !next; y++) if (at(y) !== k) next = { stage: at(y), in: y - x, unit: units ? 'unit' : 'day' };
  const growth = k !== 1 ? 0 : units ? (n > 3 ? (x - 1) / (n - 3) : 0.5) : (x - 5) / 9;
  return { started, stage: started ? k : -1, growth, next: started ? next : null };
}

/**
 * Every creature being raised or emerged: { id (the raiser), name, habit, species, stage (LIFE's
 * name), k, growth, next, on }, `on` the date its stage was reached. Its stage is the higher of what
 * progress says now and the highest one earned, so it never goes back.
 */
export function creatures(progress) {
  const earned = progress.garden?.earned || {};
  return raisers(progress).flatMap((r) => {
    const now = grown(progress, r);
    const kept = LIFE_IDS.findLastIndex((id) => earned[`${id}:${r.id}`]);
    if (now.stage < 0 && kept < 0) return [];
    const ahead = kept > now.stage;
    const k = ahead ? kept : now.stage;
    return [{
      id: r.id, name: r.name, habit: r.habit, species: r.species, stage: LIFE[k], k,
      growth: ahead ? 1 : now.growth, next: ahead ? null : now.next, on: earned[`${LIFE_IDS[k]}:${r.id}`] || null,
    }];
  });
}

/**
 * The field guide: every species, emerged first, then those being raised, then the rest, each in the data's order, as { species, creature (or null), by }: the
 * creature raising it (the furthest along, when two own habits share one) and the name of what
 * raises it, or null for a habit of your own not made yet.
 */
export function guide(progress) {
  const all = creatures(progress);
  const names = Object.fromEntries([...subjects.map((s) => [s.id, s.kind === 'learn' ? s.title : null]), ...PRESETS.map((x) => [x.id, x.name]),
    ...habitsFor(progress).map((h) => [h.id, h.name])].filter(([, v]) => v));
  const rank = (e) => (!e.creature ? 2 : e.creature.k === 3 ? 0 : 1);
  return SPECIES.map((species) => {
    const creature = all.filter((c) => c.species === species).sort((a, b) => b.k - a.k)[0] || null;
    return { species, creature, by: creature?.name ?? names[species.raisedBy] ?? null };
  }).sort((a, b) => rank(a) - rank(b));
}

const an = (name) => (/^[AEIOU]/.test(name) ? `an ${name}` : `a ${name}`);
const NEXT = ['', 'hatching', 'its chrysalis', 'emerging'];
/**
 * The words for raised butterflies, linted with the garden's. `arrived[k](by, name)` is the end
 * screen's line for reaching stage k; `raising` is home's line; `next` says what comes next.
 */
export const LIFE_WORDS = {
  arrived: [
    (by, name) => `Your ${by} egg arrived: ${an(name)}`,
    (by) => `Your ${by} egg hatched into a caterpillar`,
    (by) => `Your ${by} caterpillar made its chrysalis`,
    (by, name) => `Your ${by} butterfly is out: ${an(name)}`,
  ],
  raising: (c) => (c.k === 3 ? `${c.name} raised ${an(c.species.name)}` : `${c.name} is raising ${an(c.species.name)}`),
  next: (n) => (n ? `${n.in} more ${n.unit}${n.in === 1 ? '' : 's'} to ${NEXT[n.stage]}` : ''),
  card: (c) => `${c.species.name} · ${c.k === 3 ? 'arrived' : c.stage}`,
  by: (name) => (name ? `Raised by ${name}` : 'Raised by a habit of your own'),
  title: 'Field guide',
  open: 'Field guide',
  source: 'Source:',
};

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

/** What gives each skin: [skin, test(progress), the wardrobe's line for it]. An event's comes with its landmark. */
export const SKIN_RULES = [
  ['daisy', (p) => gardenDays(p) >= 7, SKIN_WORDS.for.daisy],
  ['bowtie', (p) => (p.wings?.length ?? 0) >= WINGS, SKIN_WORDS.for.bowtie],
  ...EVENTS.map((e) => [e.skin, (p) => !!p.done[lessonOf(e)], SKIN_WORDS.event(e.name)]),
  ['costume', (p) => creatures(p).some((c) => c.k === 3), SKIN_WORDS.for.costume],
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
  // Every course and habit raises a butterfly: one rule per stage it reaches (raisers(), below).
  ...raisers(progress).flatMap((r) => LIFE.map((gift, k) => ({
    id: `${LIFE_IDS[k]}:${r.id}`, habit: r.habit, gift, raiser: r.id, stage: k, species: r.species, sound: k === 3 ? 'butterfly' : 'flower',
    text: LIFE_WORDS.arrived[k](r.name, r.species.name), test: (p) => grown(p, r).stage >= k,
  }))),
  // A bee for trying something new: the first session of any habit but Learning.
  ...habitsFor(progress).filter((h) => h.id !== LEARN).map(({ id: h, name }) => (
    { id: `bee:${h}`, habit: h, gift: 'bee', text: `A bee found ${name}`, test: (p) => streak(p, h).days >= 1 })),
  // A ladybird for answering a comeback (src/fitting.js) with a session of its habit.
  ...habitsFor(progress).map(({ id: h }) => (
    { id: `ladybird:${h}`, habit: h, gift: 'ladybird', text: 'A ladybird came to visit', test: (p) => p.comeback?.habit === h && !!p.comeback.done })),
  ...LANDMARKS.map(({ at, gift, sound, text }) => ({ id: `garden:${gift}`, habit: null, gift, sound, text, test: (p) => gardenDays(p) >= at })),
  // A seasonal event's gift (events.js), for finishing its set in any year.
  ...EVENTS.map((e) => ({ id: `garden:${e.gift}`, habit: null, gift: e.gift, sound: e.sound, text: e.text, test: (p) => !!p.done[lessonOf(e)] })),
  // Lumi's skins (cast/skins.js), each for something the learner did: not drawn in the garden.
  ...SKIN_RULES.map(([skin, test, from]) => ({ id: `skin:${skin}`, habit: null, gift: 'skin', skin, from, sound: 'flower', text: SKIN_WORDS.arrived(SKIN_WORDS.names[skin]), test })),
];

// ponytail: 'birds:<habit>' (30 days) was retired for the birdhouse, which any such garden has long
// earned; old saves keep the id in `earned`, and garden() draws only what a rule still names.
/** The built-in habits' achievements, before the learner adds any of their own. */
export const RULES = rules(null);

/**
 * Adds every achievement now earned to `progress.garden.earned`, dated today, and returns
 * { progress, newly: [rule…] }. Never removes one: a streak starting again or the log trimming
 * changes nothing already given. `only` limits it to some rules. A creature that skips stages at
 * once (an old save, a placement) records every one but announces only the latest.
 */
export function award(progress, now = new Date(), only = () => true) {
  const earned = progress.garden?.earned || {};
  const newly = rules(progress).filter((r) => only(r) && !earned[r.id] && r.test(progress));
  if (!newly.length) return { progress, newly };
  const date = today(now);
  const more = Object.fromEntries(newly.map((r) => [r.id, date]));
  const latest = newly.filter((r) => !newly.some((o) => o.raiser === r.raiser && o.stage > r.stage));
  return { progress: { ...progress, garden: { ...progress.garden, earned: { ...earned, ...more } } }, newly: latest };
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
 * date it arrived and `species` the habit's place in habitsFor, so each habit's bee looks its own.
 * `creatures` are creatures() raised on that plant (the courses' on Learning's). Landmarks are the
 * same shape as visitors, in the order they arrive.
 */
export function garden(progress, now = new Date(), south = false) {
  const earned = progress.garden?.earned || {};
  const habits = habitsFor(progress);
  const all = rules(progress);
  const raised = creatures(progress);
  const plants = startedHabits(progress, habits.map((h) => h.id)).map((habit) => {
    const days = streak(progress, habit).days || 0;
    const species = habits.findIndex((h) => h.id === habit);
    const got = all.filter((r) => r.habit === habit && !r.raiser && earned[r.id])
      .map(({ id, gift, text }) => ({ id, gift, text, on: earned[id], species }));
    return {
      habit, plant: habits.find((h) => h.id === habit).plant, days, ...stage(days),
      flowers: got.filter((g) => g.gift === 'flower'),
      visitors: got.filter((g) => g.gift !== 'flower'),
      creatures: raised.filter((c) => c.habit === habit),
    };
  });
  const landmarks = all.filter((r) => r.habit === null && r.gift !== 'skin' && earned[r.id]).map(({ id, gift, text }) => ({ id, gift, text, on: earned[id] }));
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

