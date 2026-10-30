/**
 * Fitting a session to how it's going, pure: every answer goes in a short on-device log
 * (`progress.answers`), and this reads it to ease off, explain more, or get out of the way. It says
 * nothing about the person and nothing leaves the device (with sync on, it is encrypted with the
 * rest). The log is { key, right, ms, at }, newest last.
 */
export const KEEP = 400;
export const GOES = 3; // how many goes a missed item gets in one session; then it's left for review
const LOOK_BACK = 4;
const SHAKY = 2; // this many misses in the last LOOK_BACK answers of a unit
const FLYING = 8; // this many right in a row in a course

export const noteAnswer = (progress, { key, right, ms }, now = new Date()) => ({
  ...progress,
  answers: [...(progress.answers ?? []), { key, right, ms, at: now.toISOString() }].slice(-KEEP),
});

/** Whether the last few answers `inside` (a key test) went badly. */
export function struggling(answers = [], inside) {
  return answers.filter((a) => inside(a.key)).slice(-LOOK_BACK).filter((a) => !a.right).length >= SHAKY;
}

/** Whether the course is going so well that repeats would only slow it down. */
export function flying(answers = [], inside) {
  const last = answers.filter((a) => inside(a.key)).slice(-FLYING);
  return last.length === FLYING && last.every((a) => a.right);
}

/** How often each key was missed in the log: what repeats should favour. */
export function misses(answers = []) {
  const count = {};
  for (const a of answers) if (!a.right) count[a.key] = (count[a.key] ?? 0) + 1;
  return count;
}

/** The nearest marked item before `item` in its unit's list: a smaller version of the same idea. */
export function easier(unitItems, item) {
  const at = unitItems.findIndex((i) => i.id === item.id);
  return at > 0 ? unitItems.slice(0, at).filter((i) => i.type !== 'teach').at(-1) ?? null : null;
}
