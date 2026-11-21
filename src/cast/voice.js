import { currentStreak, light, today } from '../progress.js';
import { subjects } from '../subjects.js';
import { VOICES } from './lines.js';

/**
 * The state and facts a coach's line is picked by (say() in lines.js), read from progress. Pure.
 * The coach is the habit's own voice if it has one (Wind down's Moss), else its subject's coach;
 * a one-tap habit's is Lumi.
 */
export const coachOf = (habit) => (VOICES[habit] ? habit : subjects.find((s) => s.habit === habit)?.coach.name.toLowerCase() || 'lumi');
export const hourBand = (h) => (h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night');
export const streakBand = (n) => (n >= 30 ? 'month' : n >= 7 ? 'week' : n >= 1 ? 'short' : 'none');
const LIGHTS = { bright: 'done', soft: 'not yet', ember: 'resting' };
/** Days since the habit was last done that make the next visit a comeback: welcomes, never dares. */
export const COMEBACK_DAYS = 3;

/** The hour band most of the habit's (or, given `course`, that course's) recent sessions fell in, once there are three to go on. */
function usualHour(progress, habit, course) {
  const bands = progress.log.filter((e) => e.habit === habit && (!course || e.course === course) && Number.isInteger(e.hour)).slice(-14).map((e) => hourBand(e.hour));
  if (bands.length < 3) return null;
  const count = (b) => bands.filter((x) => x === b).length;
  return bands.reduce((best, b) => (count(b) > count(best) ? b : best));
}

/**
 * { coach, state, facts } for `habit` ({ id, name }) at `now`. A fact that isn't known is null.
 * `streakShown` false (a quiet habit, see showsStreak) leaves the streak count and the days practised out of the facts, so no
 * line states a number.
 * `coach` picks one where a habit has several (Learning's courses: the course shown), and `course` is that
 * course's id: its coach says their course is done today only when a session of it was. With Learning
 * done today through another course, the state is `elsewhere` (a moment: only pools for it match, and
 * never a dare), and the usual hour is the course's own.
 */
export function moment(progress, habit, now = new Date(), coach = coachOf(habit.id), streakShown = true, course = null) {
  const date = today(now);
  const lit = LIGHTS[light(progress, now, habit.id)];
  const elsewhere = !!course && lit === 'done' && !progress.log.some((e) => e.habit === habit.id && e.date === date && e.course === course);
  const last = progress.habits[habit.id]?.last;
  const count = currentStreak(progress, now, habit.id);
  const days = progress.habits[habit.id]?.days || 0;
  return {
    coach,
    state: {
      habit: habit.id,
      today: date,
      hour: hourBand(now.getHours()),
      light: lit,
      streak: streakBand(count),
      first: !last,
      comeback: !!last && (Date.parse(date) - Date.parse(last)) / 86400000 >= COMEBACK_DAYS,
      ...(course && { elsewhere }),
    },
    facts: { habit: habit.name, usualHour: usualHour(progress, habit.id, course), count: streakShown && count >= 2 ? count : null, days: streakShown && days >= 2 ? days : null },
  };
}
