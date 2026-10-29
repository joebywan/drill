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
