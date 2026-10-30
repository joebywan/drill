import unitHelp from './data/help.json' with { type: 'json' };
import lessonHelp from './data/lesson-help.json' with { type: 'json' };

/**
 * Fitting a session to how it's going, pure: every answer goes in a short on-device log
 * (`progress.answers`), and this reads it to ease off, explain more, or get out of the way. It says
 * nothing about the person and nothing leaves the device (with sync on, it is encrypted with the
 * rest). The log is { key, right, ms, at, hinted?, warm? }, newest last: `hinted`, the item's hint was
 * used; `warm`, it opened a lesson as a warm-up.
 */
export const KEEP = 400;
export const GOES = 4; // how many goes a missed item gets in one session; then it's left for review
const LOOK_BACK = 4;
const SHAKY = 2; // this many misses in the last LOOK_BACK answers of a unit
const FLYING = 8; // this many right in a row in a course
const HINTED = 1; // a hint comes after two mistakes, so it is at least as weak as one miss

export const noteAnswer = (progress, { key, right, ms, hinted, warm }, now = new Date()) => ({
  ...progress,
  answers: [...(progress.answers ?? []), { key, right, ms, at: now.toISOString(), ...(hinted && { hinted }), ...(warm && { warm }) }].slice(-KEEP),
});

/** Whether the last few answers `inside` (a key test) went badly. */
export function struggling(answers = [], inside) {
  return answers.filter((a) => inside(a.key)).slice(-LOOK_BACK)
    .reduce((sum, a) => sum + (!a.right ? 1 : a.hinted ? HINTED : 0), 0) >= SHAKY;
}

/** Whether the course is going so well that repeats would only slow it down. */
export function flying(answers = [], inside) {
  const last = answers.filter((a) => inside(a.key)).slice(-FLYING);
  return last.length === FLYING && last.every((a) => a.right && !a.hinted);
}

/** How often each key was missed in the log: what repeats should favour. */
export function misses(answers = []) {
  const count = {};
  for (const a of answers) if (!a.right || a.hinted) count[a.key] = (count[a.key] ?? 0) + 1;
  return count;
}

/** The cards that opened the last lesson `inside` (a key test): the next lesson opens with others. */
export const warmedLast = (answers = [], inside, count) => answers.filter((a) => a.warm && inside(a.key)).slice(-count).map((a) => a.key);

/**
 * Finishing on evidence. Given a repeat's state so far ({ goes, slips, run }: goes taken, misses,
 * rights since the last miss) and whether this answer was clean, the state of the next go, or null
 * when there's no next go: never missed, landed (one right after one miss, two in a row after more),
 * or out of goes (`cap`).
 */
export function nextGo({ goes = 1, slips = 0, run = 0 }, clean, cap = GOES) {
  const now = { slips: slips + (clean ? 0 : 1), run: clean ? run + 1 : 0 };
  if (!now.slips || now.run >= Math.min(now.slips, 2)) return null;
  return goes < cap ? { goes: goes + 1, ...now } : null;
}

/** The second explanation for an item: its lesson's where one is written, else its unit's. */
export const helpFor = (course, unit, lesson) => lessonHelp[course]?.[lesson] ?? unitHelp[course]?.[unit];

/** The nearest marked item before `item` in its unit's list: a smaller version of the same idea. */
export function easier(unitItems, item) {
  const at = unitItems.findIndex((i) => i.id === item.id);
  return at > 0 ? unitItems.slice(0, at).filter((i) => i.type !== 'teach').at(-1) ?? null : null;
}
