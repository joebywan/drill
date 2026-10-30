import { today } from './progress.js';
import { subjects } from './subjects.js';
import { TIMINGS, timed, valueIn } from './practice/timings.js';

/**
 * Fitting the person (docs/TODO.md): what Drill learns from its own on-device log about when and
 * how someone practises, so it can fit them. Pure; nothing here leaves the device. It reads the
 * log's `hour`s, `left` (practices closed part-way) and two fields of its own on progress:
 *
 *   reminders  [{ date, hour, outcome }]  — what happened to each reminder the Android wrapper
 *              showed: 'opened' or 'cleared'; 'on' marks "Turn back on" in settings. Last 60 kept
 *   comeback   { date, habit, title, hour, done?, dismissed? }  — the comeback offered after a
 *              drop-off: started `date`, built from `habit`'s favourite practice (`title`, a unit)
 *              at `hour`; `done` is the date it was answered, which earns the garden's visitor
 *
 * Both are optional (absent means none) and kept by migrate(), so the file export carries them.
 */

const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// ponytail: usual hours read the last 40 sessions; weight by recency if habits shift faster.
const RECENT = 40;
const MIN_SESSIONS = 5; // fewer than this says nothing yet
const SHARE = 0.2; // an hour (with its neighbours) holding at least this share of sessions is usual

/** Sessions per hour (0–23) and, for each hour, the sessions within an hour either side. */
function spread(hours) {
  const c = Array(24).fill(0);
  for (const h of hours) c[h]++;
  return { c, w: c.map((n, h) => c[(h + 23) % 24] + n + c[(h + 1) % 24]) };
}

const hoursOf = (progress, habit) => (progress.log || [])
  .filter((e) => Number.isInteger(e.hour) && (!habit || e.habit === habit)).slice(-RECENT).map((e) => e.hour);

/**
 * The hours sessions usually happen (all habits, or one `habit`), earliest first: each is the
 * busiest hour of a cluster that holds at least 3 sessions and a fifth of them. [] until there are
 * five sessions with an hour, so a couple of odd ones never decide anything.
 */
export function usualHours(progress, habit) {
  const hours = hoursOf(progress, habit);
  if (hours.length < MIN_SESSIONS) return [];
  const { c, w } = spread(hours);
  // The busiest hour of its cluster; of two equal neighbours, the earlier.
  return c.flatMap((n, h) => (n && n > c[(h + 23) % 24] && n >= c[(h + 1) % 24] && w[h] >= Math.max(3, SHARE * hours.length) ? [h] : []));
}

/**
 * The best single hour for a daily reminder: the usual hour with the most sessions around it, or
 * null without enough data. It is always an hour they practise in, so never early in the day for
 * someone who only practises in the evening.
 */
export function reminderHour(progress, habit) {
  const usual = usualHours(progress, habit);
  if (!usual.length) return null;
  const { w } = spread(hoursOf(progress, habit));
  return usual.reduce((best, h) => (w[h] > w[best] ? h : best));
}

/** 7 → "7 am", 19 → "7 pm", 0 → "midnight", 12 → "noon". */
export const clock = (h) => (h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? `${h} am` : `${h - 12} pm`);
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);

/** The habit view's line: "You usually practise around 7 pm", or '' while there's no pattern. */
export const usualLine = (hours) => (hours.length ? `You usually practise around ${list(hours.map(clock))}` : '');

// Reminders. Each one shown is recorded once it is opened or cleared (window.drill.noteReminder).
export const OUTCOMES = ['opened', 'cleared', 'on'];
const KEEP_REMINDERS = 60;
const SPACE_AFTER = 3; // cleared in a row: from here, every other day
const SPARSE_AFTER = 5; // every third day
export const PAUSE_AFTER = 8; // and from here, not at all until turned back on

/** Progress with a reminder's `outcome` recorded; anything but OUTCOMES changes nothing. */
export function noteReminder(progress, outcome, now = new Date()) {
  if (!OUTCOMES.includes(outcome)) return progress;
  return { ...progress, reminders: [...(progress.reminders || []), { date: today(now), hour: now.getHours(), outcome }].slice(-KEEP_REMINDERS) };
}

/** Reminders cleared in a row, most recent last: an open, or turning them back on, starts it again. */
const cleared = (progress) => {
  const r = progress.reminders || [];
  const at = r.findLastIndex((x) => x.outcome !== 'cleared');
  return r.length - 1 - at;
};

/** True once reminders were only ever cleared, PAUSE_AFTER in a row: settings says so, once. */
export const remindersPaused = (progress) => cleared(progress) >= PAUSE_AFTER;

/**
 * Whether today's reminder should be shown. Not after a session today. Cleared reminders thin it
 * out: after 3 in a row, every other day; after 5, every third; after 8, none until turned back on.
 */
export function shouldRemind(progress, now = new Date()) {
  const date = today(now);
  if ((progress.log || []).some((e) => e.date === date)) return false;
  const n = cleared(progress);
  if (n >= PAUSE_AFTER) return false;
  if (n < SPACE_AFTER) return true;
  return days(progress.reminders.at(-1).date, date) >= (n >= SPARSE_AFTER ? 3 : 2);
}

// Drop-off: sessions this week against their own usual week.
const PRACTICE = new Set(subjects.filter((s) => s.kind === 'practice').map((s) => s.habit));
const BASELINE_WEEKS = 8;
const MIN_HISTORY = 35; // days of log before a usual week means anything
const MIN_USUAL = 3; // sessions a week: below this there is no habit to fall from
const WELL_BELOW = 0.4;
export const COMEBACK_DAYS = 7; // a comeback is offered for a week
const COMEBACK_EVERY = 28; // and not again within four weeks of the last one

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * Whether sessions this week (the 7 days to today) fell well below this person's usual week (the
 * median of the 8 weeks before), with the comeback to offer if so: { usual, recent, habit, title,
 * hour }, their favourite practice (the practice habit and unit they finished most) at their usual
 * hour for it. null with under five weeks of log, a usual under 3 a week, or no practice to offer.
 */
export function dropOff(progress, now = new Date()) {
  const log = progress.log || [];
  const date = today(now);
  if (!log.length || days(log[0].date, date) < MIN_HISTORY) return null;
  const weeks = Array(BASELINE_WEEKS + 1).fill(0);
  for (const e of log) {
    const w = Math.floor(days(e.date, date) / 7);
    if (w >= 0 && w <= BASELINE_WEEKS) weeks[w]++;
  }
  // Only the weeks since the log began count towards the usual.
  const span = Math.min(BASELINE_WEEKS, Math.floor(days(log[0].date, date) / 7));
  const usual = median(weeks.slice(1, span + 1));
  const recent = weeks[0];
  if (usual < MIN_USUAL || recent >= usual * WELL_BELOW) return null;
  const counts = new Map();
  for (const e of log) if (PRACTICE.has(e.habit)) counts.set(`${e.habit}\n${e.title}`, (counts.get(`${e.habit}\n${e.title}`) || 0) + 1);
  if (!counts.size) return null;
  const [habit, title] = [...counts].reduce((a, b) => (b[1] > a[1] ? b : a))[0].split('\n');
  return { usual, recent, habit, title, hour: reminderHour(progress, habit) ?? reminderHour(progress) };
}

/** The comeback on offer: started under a week ago, not answered or dismissed. Else null. */
export function activeComeback(progress, now = new Date()) {
  const c = progress.comeback;
  return c && !c.done && !c.dismissed && days(c.date, today(now)) < COMEBACK_DAYS ? c : null;
}

/**
 * Progress with a comeback started when there is a drop-off and none is on offer, at most once in
 * four weeks; otherwise unchanged (the same object).
 */
export function startComeback(progress, now = new Date()) {
  const c = progress.comeback;
  if (c && days(c.date, today(now)) < COMEBACK_EVERY) return progress;
  const d = dropOff(progress, now);
  return d ? { ...progress, comeback: { date: today(now), habit: d.habit, title: d.title, hour: d.hour } } : progress;
}

/** A session of `habit` answers its comeback (which the garden's rule rewards); anything else is unchanged. */
export function answerComeback(progress, habit, now = new Date()) {
  const c = activeComeback(progress, now);
  return c?.habit === habit ? { ...progress, comeback: { ...c, done: today(now) } } : progress;
}

/** The comeback card's words, linted (test/guardrails.test.js): inviting, never guilt. */
export const COMEBACK_WORDS = {
  kicker: 'Whenever you like',
  text: (c) => `Some ${c.title}${c.hour == null ? '' : ` around ${clock(c.hour)}`}, the way you like it? A ladybird would love to visit your garden.`,
  go: (c) => `Start ${c.title}`,
  dismiss: 'Not this time',
};
export const PAUSED_WORDS = { line: "Reminders are paused because they weren't helping.", on: 'Turn back on', back: 'Reminders are on again.' };

// Shorter versions. A lesson left at about the same step three times running is offered shorter.
const LEFT_RUN = 3;
const LEFT_DAYS = 30;
const NOUNS = { breaths: 'breaths', sighs: 'sighs', taps: 'taps', scan: 's each place', reps: 'reps', seconds: 's each move', minutes: 'min' };

/**
 * A shorter version of `lesson` (lessonId `id`, of practice `habit`, whose timings are `own`), for
 * one session, when its last three `left` entries in 30 days stopped within a step of each other,
 * after the first step and since the habit's last finished session: { timings, words }. `timings`
 * goes over `own` through timed(), like any override, and is never saved. Each value the lesson
 * keeps (TIMINGS `at`) is cut to the share of the routine they usually reach. Else null.
 */
export function shorter(progress, habit, lesson, id, own, now = new Date()) {
  const runs = (progress.left || []).filter((e) => e.lessonId === id && e.of && days(e.date, today(now)) < LEFT_DAYS).slice(-LEFT_RUN);
  if (runs.length < LEFT_RUN) return null;
  const steps = runs.map((e) => e.step);
  if (Math.min(...steps) < 1 || Math.max(...steps) - Math.min(...steps) > 1) return null;
  const last = (progress.log || []).findLast((e) => e.habit === habit);
  const newest = runs.at(-1);
  if (last && `${last.date} ${String(last.hour ?? 0).padStart(2, '0')}` > `${newest.date} ${String(newest.hour).padStart(2, '0')}`) return null;
  const share = median(runs.map((e) => e.step / e.of));
  const timings = {};
  // ponytail: Move cuts reps and seconds alike, not the number of moves; fine while sets stay short.
  for (const [key, r] of Object.entries(TIMINGS[habit] ?? {})) {
    const v = r.at && valueIn(lesson, r.at);
    if (v == null) continue;
    const cur = timed(habit, { [key]: v }, own)[key];
    const cut = Math.max(r.min, Math.floor((cur * share) / (r.step ?? 1)) * (r.step ?? 1));
    if (cut < cur) timings[key] = cut;
  }
  const keys = Object.keys(timings);
  if (!keys.length) return null;
  const word = (k) => `${timings[k]} ${timings[k] === 1 ? NOUNS[k].replace(/s$/, '') : NOUNS[k]}`;
  return { timings, words: `Try a shorter one: ${keys.map(word).join(', ')}` };
}

// What comes first on home.
const FAVOURITE_AT = 3; // finished sessions before a habit counts as a favourite

/**
 * Home's tab order for ordered(): the intro's picks first, as picked, then the habits finished
 * most (three sessions or more), most first. Nothing else moves.
 */
export function preferred(progress) {
  const picked = progress.picked || [];
  const counts = new Map();
  for (const e of progress.log || []) counts.set(e.habit, (counts.get(e.habit) || 0) + 1);
  const most = [...counts].filter(([h, n]) => n >= FAVOURITE_AT && !picked.includes(h)).sort((a, b) => b[1] - a[1]).map(([h]) => h);
  return [...picked, ...most];
}
