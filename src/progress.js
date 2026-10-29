import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

/**
 * Everything the learner has done, as one plain JSON-able object. Pure functions only; the
 * app decides where it is stored.
 *
 *   streak   { count, last, forgiven }  — `last` is the local date (YYYY-MM-DD) of the last
 *            finished session; `forgiven` lists the dates a missed day was forgiven
 *   done     { lessonId: true }
 *   cards    { itemKey: FSRS card }  — every item ever answered, scheduled for review
 *   start    unit title the placement survey chose, absent until it is answered
 *   version  the shape's version; `migrate()` brings any older shape up to VERSION
 */
export const VERSION = 1;
export const emptyProgress = () => ({ version: VERSION, streak: { count: 0, last: null, forgiven: [] }, done: {}, cards: {} });

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Any stored or imported progress, brought to the current shape, or null when it isn't progress
 * at all (so the caller keeps what it has). Unversioned is version 0, and a streak from before
 * forgiving had no `forgiven`. Unknown fields are kept, so a file from a newer build loses nothing.
 */
export function migrate(raw) {
  if (!isObject(raw) || !isObject(raw.streak) || !isObject(raw.done) || !isObject(raw.cards)) return null;
  const { count, last, forgiven = [] } = raw.streak;
  if (!Number.isInteger(count) || count < 0 || !(last === null || isDate(last))) return null;
  if (!Array.isArray(forgiven) || !forgiven.every(isDate)) return null;
  if (!Object.values(raw.cards).every((c) => isObject(c) && !Number.isNaN(Date.parse(c.due)))) return null;
  if (raw.start != null && typeof raw.start !== 'string') return null;
  const { xp, ...kept } = raw; // points from earlier builds are dropped
  return { ...kept, version: Math.max(VERSION, Number(raw.version) || 0), streak: { ...raw.streak, forgiven } };
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

/**
 * Records a finished session. `results` is [{ key, correct }] — `correct` means right first
 * time. `lessonId` is null for a review session, which unlocks nothing but is the one thing that
 * repairs a longer gap. A lesson finished during a repairable gap leaves the streak waiting for
 * that review. Nothing is scored: what a session leaves behind is what was learned.
 */
export function finishSession(progress, lessonId, results, now = new Date()) {
  const cards = { ...progress.cards };
  for (const { key, correct } of results) {
    const card = cards[key] || createEmptyCard(now);
    cards[key] = scheduler.next(card, now, correct ? Rating.Good : Rating.Again).card;
  }
  return {
    ...progress,
    streak: nextStreak(progress.streak, today(now), !lessonId),
    done: lessonId ? { ...progress.done, [lessonId]: true } : progress.done,
    cards,
  };
}

function nextStreak(streak, date, review) {
  if (streak.last === date) return streak;
  const g = gap(streak, date);
  if (g === 'repairable' && !review) return streak;
  if (g === 'gone') return { count: 1, last: date, forgiven: [] };
  const forgiven = g === 'forgiven' ? [...(streak.forgiven || []), date].slice(-2) : streak.forgiven || [];
  return { count: streak.count + 1, last: date, forgiven };
}

/** The streak as it stands today: it holds through a gap that can still be forgiven or repaired. */
export function currentStreak(progress, now = new Date()) {
  return gap(progress.streak, today(now)) === 'gone' ? 0 : progress.streak.count;
}

/** True when a review today would repair the streak. */
export const needsRepair = (progress, now = new Date()) => gap(progress.streak, today(now)) === 'repairable';

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
 * Today's light, the habit display on the streak chip and the widget: bright once today's
 * session is done, soft until then, and a warm ember after a missed day. It is never dark.
 */
export function light(progress, now = new Date()) {
  const date = today(now);
  if (progress.streak.last === date) return 'bright';
  return gap(progress.streak, date) === 'kept' ? 'soft' : 'ember';
}
