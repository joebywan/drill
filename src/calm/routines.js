/** Calm's routines as timelines (see src/practice/timeline.js, which plays them). */
import { TIMINGS, timed } from '../practice/timings.js';

const T = TIMINGS.calm;
export const INHALE = T.inhale.def;
export const EXHALE = T.exhale.def;

/**
 * Each builder takes the lesson's own value and the learner's `own` timings (progress.timings.calm),
 * merged by `timed()`: the lesson's cycles hold until someone sets their own.
 */

/** Breathing, 4 in and 8 out, `cycles` times. */
export function breaths(cycles, own) {
  const t = timed('calm', { breaths: cycles, inhale: INHALE, exhale: EXHALE }, own);
  return Array.from({ length: t.breaths }, (_, cycle) => [
    { phase: 'in', seconds: t.inhale, cycle },
    { phase: 'out', seconds: t.exhale, cycle },
  ]).flat();
}

/** The body scan, bottom to top: `zones` is [{ name, line }], each held `seconds`. */
export function scan(zones, seconds, own) {
  const t = timed('calm', { scan: seconds }, own);
  return zones.map((z, i) => ({ ...z, seconds: t.scan, zone: i }));
}

/** The double-inhale sigh: a long breath in, a short top-up, then a long sigh out (3, 1, 6 s). */
export const SIGH = { in: T.sighIn.def, top: T.sighTop.def, sigh: T.sighOut.def };
export function sighs(cycles, own) {
  const t = timed('calm', { sighs: cycles, sighIn: SIGH.in, sighTop: SIGH.top, sighOut: SIGH.sigh }, own);
  const one = { in: t.sighIn, top: t.sighTop, sigh: t.sighOut };
  return Array.from({ length: t.sighs }, (_, cycle) => Object.entries(one).map(([phase, seconds]) => ({ phase, seconds, cycle }))).flat();
}

/** The butterfly hug: `taps` slow taps, one a second, left then right. */
export function hugTaps(taps, own) {
  const t = timed('calm', { taps }, own);
  return Array.from({ length: t.taps }, (_, tap) => ({ side: tap % 2 ? 'right' : 'left', seconds: 1, tap }));
}
