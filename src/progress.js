import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

/**
 * Everything the learner has done, as one plain JSON-able object. Pure functions only; the
 * app decides where it is stored.
 *
 *   habits   { habitId: { count, last, forgiven } }  — one streak per habit ('learn', 'calm', …).
 *            `last` is the local date (YYYY-MM-DD) of the habit's last finished session;
 *            `forgiven` lists the dates a missed day was forgiven
 *   log      [{ date, habit, title, mins, right?, of?, feel? }]  — every finished session,
 *            oldest first, for the habit view: what was done each day
 *   done     { lessonId: true }
 *   cards    { itemKey: FSRS card }  — every item ever answered, scheduled for review
 *   start    unit title the placement survey chose, absent until it is answered
 *   journal  { 'YYYY-MM-DD': { good?, learned?, tomorrow? } }  — Reflect's lines, the learner's
 *            own words. Kept here, not in the log; only the habit view and the file export read them
 *   version  the shape's version; `migrate()` brings any older shape up to VERSION
 */
export const VERSION = 3;
export const LEARN = 'learn';
const emptyStreak = () => ({ count: 0, last: null, forgiven: [] });
export const emptyProgress = () => ({ version: VERSION, habits: { [LEARN]: emptyStreak() }, log: [], done: {}, cards: {}, journal: {} });

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** A streak in any stored shape (one from before forgiving had no `forgiven`), or null. */
function readStreak(raw) {
  if (!isObject(raw)) return null;
  const { count, last, forgiven = [] } = raw;
  if (!Number.isInteger(count) || count < 0 || !(last === null || isDate(last))) return null;
  if (!Array.isArray(forgiven) || !forgiven.every(isDate)) return null;
  return { ...raw, forgiven };
}

const JOURNAL_KEYS = ['good', 'learned', 'tomorrow'];
const isJournal = (j) => isObject(j) && Object.entries(j).every(([date, day]) =>
  isDate(date) && isObject(day) && JOURNAL_KEYS.every((k) => day[k] == null || typeof day[k] === 'string'));

const isEntry = (e) => isObject(e) && isDate(e.date) && typeof e.habit === 'string' && typeof e.title === 'string';

/**
 * Any stored or imported progress, brought to the current shape, or null when it isn't progress
 * at all (so the caller keeps what it has). Unversioned is version 0; up to version 1 there was
 * one `streak`, which becomes Learning's, and no log; up to version 2 there was no journal.
 * Unknown fields are kept, so a file from a newer build loses nothing.
 */
export function migrate(raw) {
  if (!isObject(raw) || !isObject(raw.done) || !isObject(raw.cards)) return null;
  if (!Object.values(raw.cards).every((c) => isObject(c) && !Number.isNaN(Date.parse(c.due)))) return null;
  if (raw.start != null && typeof raw.start !== 'string') return null;
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
  return { ...kept, version: Math.max(VERSION, Number(raw.version) || 0), habits, log, journal };
}

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
    habits: { ...progress.habits, [LEARN]: nextStreak(habitStreak(progress, LEARN), today(now), !lessonId) },
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
    habits: { ...progress.habits, [habit]: nextStreak(habitStreak(progress, habit), today(now), true) },
    log: logged(progress, { habit, title: about.title || 'Practice', mins: about.mins || 0 }, now),
    done: lessonId ? { ...progress.done, [lessonId]: true } : progress.done,
  };
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
