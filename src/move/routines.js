/** Move's routines as timelines (see src/practice/timeline.js, which plays them). Pure. */

export const REST = 10; // seconds between exercises
export const PACE = 3; // seconds a rep takes, unless the move says otherwise

/**
 * A set of exercises ([{ move, seconds } or { move, reps }]) as phases: each exercise is one timed
 * phase, with a rest between. `moves` is the catalog ({ name, cue, pose, pace?, unit? }). A rep
 * exercise lasts reps × pace seconds; the kit's count shows its reps rather than seconds.
 */
export function phases(set, moves, rest = REST) {
  return set.flatMap((x, i) => {
    const m = moves[x.move];
    const seconds = x.reps ? x.reps * (m.pace ?? PACE) : x.seconds;
    const p = { ...m, kind: 'move', seconds, n: i + 1, of: set.length, ...(x.reps && { reps: x.reps }) };
    return i ? [{ kind: 'rest', seconds: rest, next: m.name, cue: m.cue }, p] : [p];
  });
}

/** What a set did, for the end screen: "5 moves · 8 squats". Reps of the same move add up. */
export function summary(set, moves) {
  const reps = new Map();
  for (const x of set) if (x.reps) reps.set(moves[x.move].unit, (reps.get(moves[x.move].unit) ?? 0) + x.reps);
  return [`${set.length} moves`, ...[...reps].map(([unit, n]) => `${n} ${unit}`)].join(' · ');
}
