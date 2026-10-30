import { today } from './progress.js';

/**
 * The words of the habit view, kept pure so they can be tested and linted. Days without a session
 * are plain, never marked as missed; a day the streak forgave is a rest day.
 */
export const QUIET_DAY = 'A quiet day.';
export const REST_DAY = 'A rest day. The streak kept going.';
export const NO_STREAK = 'Any session starts a streak.';
export const FIRST_SQUARE = 'Your first session fills the first square.';

/** The line over a habit's path on home, which opens its view: "14-day streak · See your week". */
export const streakLine = (n, started) => (n ? `${n}-day streak · See your week`
  : started ? 'Any session starts a streak · See your week' : 'Your first session starts a streak');

/** A YYYY-MM-DD local date as a Date at local midnight, `plus` days on. */
export const dateOf = (date, plus = 0) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d + plus);
};

/** One logged session as a line: "Forks · 7 of 8 right first try · 6 min", "Breathing · 2 min · felt calmer". */
export function sessionLine(e) {
  const parts = [e.title];
  if (e.of) parts.push(`${e.right} of ${e.of} ${e.title === 'Review' ? 'recalled' : 'right first try'}`);
  if (e.mins) parts.push(`${e.mins} min`);
  if (e.feel) parts.push(`felt ${e.feel}`);
  return parts.join(' · ');
}

/** The days a streak forgave. Each `forgiven` date is the session after the one day off. */
export const restDays = (streak) => new Set((streak?.forgiven || []).map((d) => today(dateOf(d, -1))));

/** "Today", "Yesterday", then the weekday. */
export function dayName(date, now = new Date()) {
  const t = today(now);
  if (date === t) return 'Today';
  if (date === today(dateOf(t, -1))) return 'Yesterday';
  return dateOf(date).toLocaleDateString('en', { weekday: 'long' });
}
