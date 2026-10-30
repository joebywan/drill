import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

/**
 * Everything the learner has done, as one plain JSON-able object. Pure functions only; the
 * app decides where it is stored.
 *
 *   habits   { habitId: { count, last, forgiven, days } }  — one streak per habit ('learn', 'calm', …).
 *            `last` is the local date (YYYY-MM-DD) of the habit's last finished session;
 *            `forgiven` lists the dates a missed day was forgiven; `days` counts every date with a
 *            session, ever (the log only keeps a year), and only goes up: the garden grows from it
 *   log      [{ date, habit, title, mins, right?, of?, feel? }]  — every finished session,
 *            oldest first, for the habit view: what was done each day
 *   done     { lessonId: true }
 *   cards    { itemKey: FSRS card }  — every item ever answered, scheduled for review
 *   start    { subjectId: unitTitle | null }  — where a subject's optional placement question put
 *            the learner, null once the offer is dismissed, absent while it is still offered
 *   journal  { 'YYYY-MM-DD': { good?, learned?, tomorrow? } }  — Reflect's lines, the learner's
 *            own words. Kept here, not in the log; only the habit view and the file export read them
 *   garden   { earned: { achievementId: 'YYYY-MM-DD' } }  — what the garden has been given
 *            (src/garden/model.js). Earned once, kept forever: nothing removes an entry
 *   tracked  [{ id, name?, icon?, plant?, hidden? }]  — the self-reported habits the learner added,
 *            in order: a preset is just its id ('walk'); one of their own ('own-1') carries its name,
 *            icon and plant. `hidden` takes it off the tabs and keeps everything else (subjects.js habitsFor)
 *   picked   [habitId]  — what the first-visit intro was asked for, in the order picked: home puts
 *            these first (subjects.js ordered). Absent until the intro is answered or skipped ([])
 *   timings  { habitId: { key: value } }  — the learner's own practice timings (practice/timings.js),
 *            over the path's defaults. Untrusted like the rest: `timed()` ignores a value out of range
 *   version  the shape's version; `migrate()` brings any older shape up to VERSION
 */
export const VERSION = 8;
export const LEARN = 'learn';
const emptyStreak = () => ({ count: 0, last: null, forgiven: [], days: 0 });
export const emptyProgress = () => ({ version: VERSION, habits: { [LEARN]: emptyStreak() }, log: [], done: {}, cards: {}, journal: {}, garden: { earned: {} }, tracked: [], timings: {} });

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** A streak in any stored shape (one from before forgiving had no `forgiven`), or null. */
function readStreak(raw) {
  if (!isObject(raw)) return null;
  const { count, last, forgiven = [] } = raw;
  if (!Number.isInteger(count) || count < 0 || !(last === null || isDate(last))) return null;
  if (!Array.isArray(forgiven) || !forgiven.every(isDate)) return null;
  if (raw.days != null && !(Number.isInteger(raw.days) && raw.days >= 0)) return null;
  return { ...raw, forgiven };
}

const JOURNAL_KEYS = ['good', 'learned', 'tomorrow'];
const isJournal = (j) => isObject(j) && Object.entries(j).every(([date, day]) =>
  isDate(date) && isObject(day) && JOURNAL_KEYS.every((k) => day[k] == null || typeof day[k] === 'string'));

// `was` is the streak before a one-tap log, kept so the same day's Undo can put it back (unlogToday).
const isEntry = (e) => isObject(e) && isDate(e.date) && typeof e.habit === 'string' && typeof e.title === 'string'
  && (e.was === undefined || e.was === null || !!readStreak(e.was));

// Ids go into attributes and storage keys, so they are plain; names are the learner's own text.
const NAME_MAX = 30;
const isTracked = (t) => isObject(t) && typeof t.id === 'string' && /^[a-z0-9-]{1,40}$/.test(t.id)
  && (t.name == null || (typeof t.name === 'string' && t.name.trim().length > 0 && t.name.length <= NAME_MAX))
  && ['icon', 'plant'].every((k) => t[k] == null || (typeof t[k] === 'string' && t[k].length <= 16))
  && (t.hidden == null || typeof t.hidden === 'boolean');

/**
 * Any stored or imported progress, brought to the current shape, or null when it isn't progress
 * at all (so the caller keeps what it has). Unversioned is version 0; up to version 1 there was
 * one `streak`, which becomes Learning's, and no log; up to version 2 there was no journal; up to
 * version 3 no garden, and no `days` on a streak, which is counted from the log's dates and is never
 * less than the streak's count (the log may have started after the streak); up to version 4 `start`
 * was one string, chess's (the only subject that asked), and becomes { chess: it }; up to version 5
 * nothing was `tracked`, which starts empty; up to version 6 there was no first-visit intro, so
`picked` becomes [] and someone who already used Drill never sees it; up to version 7 there were
 * no timings of the learner's own, so `timings` becomes {}.
 * Unknown fields are kept, so a file from a newer build loses nothing.
 */
export function migrate(raw) {
  if (!isObject(raw) || !isObject(raw.done) || !isObject(raw.cards)) return null;
  if (!Object.values(raw.cards).every((c) => isObject(c) && !Number.isNaN(Date.parse(c.due)))) return null;
  const start = typeof raw.start === 'string' ? { chess: raw.start } : raw.start;
  if (start != null && !(isObject(start) && Object.values(start).every((u) => u === null || typeof u === 'string'))) return null;
  const { xp, ...kept } = raw; // points from earlier builds are dropped
  delete kept.streak; // version 1's one streak becomes Learning's, below
  let habits;
  if ((Number(raw.version) || 0) < 2) {
    const learn = readStreak(raw.streak);
    if (!learn) return null;
    habits = { [LEARN]: learn };
  } else {
    if (!isObject(raw.habits)) return null;
    habits = {};
    for (const [id, h] of Object.entries(raw.habits)) if (!(habits[id] = readStreak(h))) return null;
    habits[LEARN] ??= emptyStreak();
  }
  const log = raw.log ?? [];
  if (!Array.isArray(log) || !log.every(isEntry)) return null;
  const journal = raw.journal ?? {};
  if (!isJournal(journal)) return null;
  for (const [id, h] of Object.entries(habits)) {
    if (h.days != null) continue;
    const dates = new Set(log.filter((e) => e.habit === id).map((e) => e.date));
    habits[id] = { ...h, days: Math.max(dates.size, h.count) };
  }
  const garden = raw.garden ?? { earned: {} };
  if (!isObject(garden) || !isObject(garden.earned) || !Object.values(garden.earned).every(isDate)) return null;
  // Version 6: the self-reported habits the learner tracks (none before).
  const tracked = raw.tracked ?? [];
  if (!Array.isArray(tracked) || !tracked.every(isTracked) || new Set(tracked.map((t) => t.id)).size !== tracked.length) return null;
  // Version 7: what the intro was asked for. Older saves come from people who never saw it, and never will.
  const picked = (Number(raw.version) || 0) < 7 ? raw.picked ?? [] : raw.picked;
  if (picked != null && !(Array.isArray(picked) && picked.every((id) => typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id)) && new Set(picked).size === picked.length)) return null;
  // Version 8: the learner's own timings. Not an object means none; each value is checked where it is used.
  const timings = isObject(raw.timings) ? raw.timings : {};
  return { ...kept, ...(start && { start }), ...(picked && { picked }), version: Math.max(VERSION, Number(raw.version) || 0), habits, log, journal, garden, tracked, timings };
}

/**
 * True while `subject` offers its optional placement question: it has one, neither answered nor
 * dismissed, and the subject's first unit isn't finished yet (after that, skipping ahead is moot).
 */
export const offersPlacement = (progress, subject) => !!subject.placement && !(subject.id in (progress.start ?? {}))
  && !subject.units[0].lessons.every((l) => progress.done[`${subject.id}:${l.id}`]);

/** Progress with a subject's placement answered (its path starts at `unit`) or dismissed (`unit` null). */
export const placeAt = (progress, subjectId, unit) => ({ ...progress, start: { ...progress.start, [subjectId]: unit } });

/** True for a first visit: the intro is neither answered nor skipped, and nothing has been done yet. */
export const showsIntro = (progress) => !progress.picked && !progress.log.length && !Object.keys(progress.done).length && !progress.tracked?.length;

const scheduler = fsrs();

/** Local calendar date, not UTC: a streak is about the learner's day. */
export const today = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const FORGIVE_EVERY = 7;
const REPAIR_UP_TO = 3;

/**
 * What a session finished on `date` does to the streak: 'kept' (no day missed), 'forgiven' (one
 * missed day, forgiven automatically once in any seven days), 'repairable' (up to three missed
 * days, or a second missed day within the week, which a review repairs) or 'gone'.
 */
export function gap(streak, date) {
  const missed = streak.last ? Math.max(0, daysBetween(streak.last, date) - 1) : 0;
  if (missed === 0) return 'kept';
  const allowance = !(streak.forgiven || []).some((d) => daysBetween(d, date) < FORGIVE_EVERY);
  if (missed === 1 && allowance) return 'forgiven';
  return missed <= REPAIR_UP_TO ? 'repairable' : 'gone';
}

// ponytail: the log keeps every session for a year; summarise older days if it ever grows large.
const LOG_DAYS = 366;

/** Adds a session to the log and drops entries older than a year. */
function logged(progress, entry, now) {
  const date = today(now);
  const kept = (progress.log || []).filter((e) => daysBetween(e.date, date) < LOG_DAYS);
  return [...kept, { date, ...entry }];
}

const habitStreak = (progress, habit) => progress.habits[habit] || emptyStreak();

/** The habit's streak after a session today, with `days` counting today once, however many sessions. */
function practised(progress, habit, now, review) {
  const date = today(now);
  const before = habitStreak(progress, habit);
  const first = !(progress.log || []).some((e) => e.habit === habit && e.date === date);
  return { ...nextStreak(before, date, review), days: (before.days || 0) + (first ? 1 : 0) };
}

/**
 * Records a finished Learning session. `results` is [{ key, correct }] — `correct` means right
 * first time. `lessonId` is null for a review session, which unlocks nothing but is the one thing
 * that repairs a longer gap. A lesson finished during a repairable gap leaves the streak waiting
 * for that review. Nothing is scored: what a session leaves behind is what was learned.
 * `about` is { title, mins } for the log.
 */
export function finishSession(progress, lessonId, results, now = new Date(), about = {}) {
  const cards = { ...progress.cards };
  for (const { key, correct } of results) {
    const card = cards[key] || createEmptyCard(now);
    cards[key] = scheduler.next(card, now, correct ? Rating.Good : Rating.Again).card;
  }
  const entry = {
    habit: LEARN, title: about.title || (lessonId ? 'Lesson' : 'Review'), mins: about.mins || 0,
    right: results.filter((r) => r.correct).length, of: results.length,
  };
  return {
    ...progress,
    habits: { ...progress.habits, [LEARN]: practised(progress, LEARN, now, !lessonId) },
    log: logged(progress, entry, now),
    done: lessonId ? { ...progress.done, [lessonId]: true } : progress.done,
    cards,
  };
}

/**
 * Records a finished Practice session (a guided routine: Calm, Move, …). There is no right or
 * wrong and no review, so any session keeps or repairs its habit's streak. `lessonId` marks the
 * routine done, which opens the next step on the path. `about` is { title, mins } for the log.
 */
export function finishPractice(progress, habit, lessonId, now = new Date(), about = {}) {
  return {
    ...progress,
    habits: { ...progress.habits, [habit]: practised(progress, habit, now, true) },
    log: logged(progress, { habit, title: about.title || 'Practice', mins: about.mins || 0 }, now),
    done: lessonId ? { ...progress.done, [lessonId]: true } : progress.done,
  };
}

/**
 * One tap on a self-reported habit ("I walked today"): recorded through finishPractice, so the
 * streak, `days` and the log all work as for any habit. Once a day; a second tap changes nothing.
 * The log entry keeps the streak as it was (`was`) so unlogToday can put it back.
 */
export function logToday(progress, habit, title, now = new Date()) {
  const date = today(now);
  if ((progress.log || []).some((e) => e.habit === habit && e.date === date)) return progress;
  const p = finishPractice(progress, habit, null, now, { title });
  const log = [...p.log];
  log[log.length - 1] = { ...log.at(-1), was: progress.habits[habit] ?? null };
  return { ...p, log };
}

/**
 * Undoes today's one-tap log of `habit`, for a mis-tap: the streak (count, days, forgiven) goes back
 * to exactly what it was before the tap, and the entry leaves the log. Only today's, and only a
 * log entry; anything else is returned unchanged. The garden's `earned` is never touched.
 */
export function unlogToday(progress, habit, now = new Date()) {
  const date = today(now);
  const at = (progress.log || []).findLastIndex((e) => e.habit === habit && e.date === date && e.was !== undefined);
  if (at < 0) return progress;
  const { was } = progress.log[at];
  const habits = { ...progress.habits };
  if (was) habits[habit] = was; else delete habits[habit];
  return { ...progress, habits, log: progress.log.filter((_, i) => i !== at) };
}

/**
 * Adds a self-reported habit to `tracked`, or changes one already there (rename, hide, show
 * again): `entry` is merged into the one with its id. With no id it is a new habit of the
 * learner's own ('own-1', 'own-2', …). The name is trimmed and kept short; it is never judged.
 */
export function track(progress, entry) {
  const tracked = progress.tracked || [];
  const id = entry.id || `own-${1 + Math.max(0, ...tracked.map((t) => Number(t.id.match(/^own-(\d+)$/)?.[1]) || 0))}`;
  const next = { ...entry, id };
  if (typeof next.name === 'string') next.name = next.name.trim().slice(0, NAME_MAX);
  if (next.name === '') delete next.name;
  const at = tracked.findIndex((t) => t.id === id);
  if (at < 0) return { ...progress, tracked: [...tracked, next] };
  return { ...progress, tracked: tracked.map((t, i) => (i === at ? { ...t, ...next } : t)) };
}

/**
 * Keeps today's Reflect lines in the journal. Blank lines are left out, and a second visit the
 * same day adds to the first rather than wiping it. Nothing written, nothing kept.
 */
export function writeJournal(progress, entry, now = new Date()) {
  const lines = Object.fromEntries(JOURNAL_KEYS.filter((k) => entry?.[k]?.trim()).map((k) => [k, entry[k].trim()]));
  if (!Object.keys(lines).length) return progress;
  const date = today(now);
  const journal = progress.journal || {};
  return { ...progress, journal: { ...journal, [date]: { ...journal[date], ...lines } } };
}

/** The optional "how do you feel?" answer, kept on the latest session of `habit`. */
export function noteFeel(progress, habit, feel) {
  const at = progress.log.findLastIndex((e) => e.habit === habit);
  if (at < 0) return progress;
  const log = [...progress.log];
  log[at] = { ...log[at], feel };
  return { ...progress, log };
}

function nextStreak(streak, date, review) {
  if (streak.last === date) return streak;
  const g = gap(streak, date);
  if (g === 'repairable' && !review) return streak;
  if (g === 'gone') return { count: 1, last: date, forgiven: [] };
  const forgiven = g === 'forgiven' ? [...(streak.forgiven || []), date].slice(-2) : streak.forgiven || [];
  return { count: streak.count + 1, last: date, forgiven };
}

/** A habit's streak as it stands today: it holds through a gap that can still be forgiven or repaired. */
export function currentStreak(progress, now = new Date(), habit = LEARN) {
  const s = habitStreak(progress, habit);
  return gap(s, today(now)) === 'gone' ? 0 : s.count;
}

/** True when a session today would repair the habit's streak (for Learning, a review). */
export const needsRepair = (progress, now = new Date(), habit = LEARN) =>
  gap(habitStreak(progress, habit), today(now)) === 'repairable';

/** The habits to show, in a fixed order: Learning always, any other once it has a session. */
export const startedHabits = (progress, order) =>
  order.filter((h) => h === LEARN || progress.habits[h]?.last);

/** A habit's sessions on each of the `days` days ending today: [{ date, sessions }], oldest first. */
export function habitDays(progress, habit, days, now = new Date()) {
  const byDate = new Map();
  for (const e of progress.log) if (e.habit === habit) byDate.set(e.date, [...(byDate.get(e.date) || []), e]);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const date = today(d);
    return { date, sessions: byDate.get(date) || [] };
  });
}

/** Item keys due for review, most overdue first. */
export function dueKeys(progress, now = new Date()) {
  return Object.entries(progress.cards)
    .filter(([, c]) => new Date(c.due) <= now)
    .sort(([, a], [, b]) => new Date(a.due) - new Date(b.due))
    .map(([key]) => key);
}

/** Every item ever answered, soonest due first: the review when nothing is due yet. */
export const soonestKeys = (progress) =>
  Object.entries(progress.cards).sort(([, a], [, b]) => new Date(a.due) - new Date(b.due)).map(([key]) => key);

/**
 * Today's light for a habit, shown on its streak chip and the widget: bright once today's
 * session is done, soft until then, and a warm ember after a missed day. It is never dark.
 */
export function light(progress, now = new Date(), habit = LEARN) {
  const date = today(now);
  const s = habitStreak(progress, habit);
  if (s.last === date) return 'bright';
  return gap(s, date) === 'kept' ? 'soft' : 'ember';
}

/**
 * One subject's units, each lesson marked done, open or locked. A unit opens when the previous
 * unit's first lesson is done, so a beginner can move across topics without first clearing every
 * hard tier; within a unit, lessons open in order. Units before the placement question's starting
 * point are open all through, to go back to.
 */
export function unitsOf(progress, subject) {
  const start = subject.units.findIndex((u) => u.title === progress.start?.[subject.id]);
  let unitOpen = true;
  return subject.units.map((unit, i) => {
    let open = unitOpen || i <= start;
    unitOpen = !!progress.done[`${subject.id}:${unit.lessons[0].id}`];
    const nodes = unit.lessons.map((lesson) => {
      const id = `${subject.id}:${lesson.id}`;
      const state = progress.done[id] ? 'done' : open ? 'open' : 'locked';
      if (state !== 'done' && i >= start) open = false;
      return { id, subject, lesson, state };
    });
    return { title: unit.title, nodes, placed: i === start };
  });
}

/**
 * A habit's next lesson on its path (`units`, from unitsOf): `current` is the first open one from
 * the placement question's starting unit on; once the path is done, `repeat` is `again`'s lesson
 * (the subject's { label, lesson }), if it has one.
 */
export function nextUp(units, again) {
  const from = Math.max(0, units.findIndex((u) => u.placed));
  const current = [...units.slice(from), ...units].flatMap((u) => u.nodes).find((n) => n.state === 'open');
  const repeat = !current && again ? units.flatMap((u) => u.nodes).find((n) => n.lesson.id === again.lesson) : undefined;
  return { current, repeat };
}
