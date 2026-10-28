import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

/**
 * Everything the learner has done, as one plain JSON-able object. Pure functions only; the
 * app decides where it is stored.
 *
 *   xp       total points
 *   streak   { count, last }  — `last` is the local date (YYYY-MM-DD) of the last finished lesson
 *   done     { lessonId: true }
 *   cards    { itemKey: FSRS card }  — every item ever answered, scheduled for review
 */
export const emptyProgress = () => ({ xp: 0, streak: { count: 0, last: null }, done: {}, cards: {} });

const scheduler = fsrs();

/** Local calendar date, not UTC: a streak is about the learner's day. */
export const today = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const dayBefore = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return today(new Date(y, m - 1, d - 1));
};

/**
 * Records a finished session. `results` is [{ key, correct }] — `correct` means right first
 * time. `lessonId` is null for a review session, which keeps the streak but unlocks nothing.
 */
export function finishSession(progress, lessonId, results, now = new Date()) {
  const cards = { ...progress.cards };
  for (const { key, correct } of results) {
    const card = cards[key] || createEmptyCard(now);
    cards[key] = scheduler.next(card, now, correct ? Rating.Good : Rating.Again).card;
  }
  const date = today(now);
  const { count, last } = progress.streak;
  const streak = last === date ? progress.streak
    : { count: last === dayBefore(date) ? count + 1 : 1, last: date };
  return {
    xp: progress.xp + 10 + 2 * results.filter((r) => r.correct).length,
    streak,
    done: lessonId ? { ...progress.done, [lessonId]: true } : progress.done,
    cards,
  };
}

/** The streak as it stands today: one missed day and it is gone. */
export function currentStreak(progress, now = new Date()) {
  const { count, last } = progress.streak;
  const date = today(now);
  return last === date || last === dayBefore(date) ? count : 0;
}

/** Item keys due for review, most overdue first. */
export function dueKeys(progress, now = new Date()) {
  return Object.entries(progress.cards)
    .filter(([, c]) => new Date(c.due) <= now)
    .sort(([, a], [, b]) => new Date(a.due) - new Date(b.due))
    .map(([key]) => key);
}
