/** Calm's routines as timelines (see src/practice/timeline.js, which plays them). */

export const INHALE = 4;
export const EXHALE = 8;

/** Breathing, 4 in and 8 out, `cycles` times. */
export const breaths = (cycles, inhale = INHALE, exhale = EXHALE) =>
  Array.from({ length: cycles }, (_, cycle) => [
    { phase: 'in', seconds: inhale, cycle },
    { phase: 'out', seconds: exhale, cycle },
  ]).flat();

/** The body scan, bottom to top: `zones` is [{ name, line }], each held `seconds`. */
export const scan = (zones, seconds) => zones.map((z, i) => ({ ...z, seconds, zone: i }));

/** The double-inhale sigh: a long breath in, a short top-up, then a long sigh out (3, 1, 6 s). */
export const SIGH = { in: 3, top: 1, sigh: 6 };
export const sighs = (cycles) =>
  Array.from({ length: cycles }, (_, cycle) => Object.entries(SIGH).map(([phase, seconds]) => ({ phase, seconds, cycle }))).flat();

/** The butterfly hug: `taps` slow taps, one a second, left then right. */
export const hugTaps = (taps) => Array.from({ length: taps }, (_, tap) => ({ side: tap % 2 ? 'right' : 'left', seconds: 1, tap }));
