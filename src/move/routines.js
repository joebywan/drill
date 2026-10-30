/** Move's routines as timelines (see src/practice/timeline.js, which plays them). Pure. */
import { TIMINGS, timed } from '../practice/timings.js';

export const REST = TIMINGS.move.rest.def; // seconds between exercises
export const PACE = 3; // seconds a rep takes, unless the move says otherwise

/** The set with the learner's `own` timings (progress.timings.move) on each exercise's reps or seconds. */
const yours = (set, own) => set.map((x) => ({ ...x, ...timed('move', x.reps ? { reps: x.reps } : { seconds: x.seconds }, own) }));

/**
 * A set of exercises ([{ move, seconds } or { move, reps }]) as phases: each exercise is one timed
 * phase, with a rest between. `moves` is the catalog ({ name, how, pose, pace?, unit? }). A rep
 * exercise lasts reps × pace seconds; the kit's count shows its reps rather than seconds.
 */
export function phases(set, moves, own) {
  const { rest } = timed('move', { rest: REST }, own);
  const mine = yours(set, own);
  return mine.flatMap((x, i) => {
    const m = moves[x.move];
    const seconds = x.reps ? x.reps * (m.pace ?? PACE) : x.seconds;
    const p = { ...m, kind: 'move', seconds, n: i + 1, of: mine.length, ...(x.reps && { reps: x.reps }) };
    return i ? [{ kind: 'rest', seconds: rest, how: m.how }, p] : [p];
  });
}

/** What a set did, for the end screen: "5 moves · 8 squats". Reps of the same move add up. */
export function summary(set, moves, own) {
  const reps = new Map();
  for (const x of yours(set, own)) if (x.reps) reps.set(moves[x.move].unit, (reps.get(moves[x.move].unit) ?? 0) + x.reps);
  return [`${set.length} moves`, ...[...reps].map(([unit, n]) => `${n} ${unit}`)].join(' · ');
}
