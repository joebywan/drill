/**
 * The learner's own timings for the practice habits. Every routine runs on its path's defaults
 * until someone changes a value (for example to match timings they were given); then that value
 * holds everywhere the habit uses it. Pure.
 *
 * TIMINGS is each habit's settable values: { key: { label, unit?, min, max, step?, def?, from? } }.
 * `def` is a fixed default (Calm's 4 in, 8 out); without one the default comes from the lesson, so
 * it grows along the path, and `from` is where the stepper starts. Overrides are kept in
 * progress as `timings: { habit: { key: value } }` and are untrusted: `timed()` uses one only when
 * it is a whole number in range.
 */
export const TIMINGS = {
  calm: {
    inhale: { label: 'Breathe in', unit: 's', min: 2, max: 10, def: 4 },
    exhale: { label: 'Breathe out', unit: 's', min: 2, max: 12, def: 8 },
    breaths: { label: 'Breaths each time', min: 1, max: 20, from: 5 },
    sighIn: { label: 'Sigh: breathe in', unit: 's', min: 2, max: 8, def: 3 },
    sighTop: { label: 'Sigh: top-up', unit: 's', min: 1, max: 3, def: 1 },
    sighOut: { label: 'Sigh: breathe out', unit: 's', min: 3, max: 12, def: 6 },
    sighs: { label: 'Sighs each time', min: 1, max: 20, from: 5 },
    scan: { label: 'Body scan: each place', unit: 's', min: 5, max: 60, step: 5, from: 15 },
    taps: { label: 'Butterfly hug: taps', min: 10, max: 120, step: 10, from: 40 },
  },
  move: {
    reps: { label: 'Reps', min: 1, max: 30, from: 8 },
    seconds: { label: 'Each timed move', unit: 's', min: 10, max: 120, step: 5, from: 30 },
    rest: { label: 'Rest between moves', unit: 's', min: 5, max: 60, step: 5, def: 10 },
  },
  break: {
    seconds: { label: 'Each step', unit: 's', min: 5, max: 60, step: 5, from: 20 },
  },
  focus: {
    minutes: { label: 'Focus time', unit: 'min', min: 5, max: 90, step: 5, from: 10 },
  },
};

/** The words around them, linted with the rest (test/guardrails.test.js). */
export const TIMING_WORDS = {
  link: 'Your timings',
  intro: "If someone has given you timings, set them here. Anything you don't change stays as it is.",
  path: 'grows along the path',
  usual: 'As the path goes',
  reset: 'Back to defaults',
};

const ok = (range, v) => !!range && Number.isInteger(v) && v >= range.min && v <= range.max;

/**
 * `defaults` ({ key: value }, a routine's own) with `habit`'s valid overrides on top. A value that
 * isn't a whole number in its range, or a key the habit doesn't have, is ignored. The one place
 * overrides meet a routine: every routine builder goes through it.
 */
export const timed = (habit, defaults, overrides) => Object.fromEntries(Object.entries(defaults)
  .map(([k, d]) => [k, ok(TIMINGS[habit]?.[k], overrides?.[k]) ? overrides[k] : d]));

/** A habit's overrides with `key` set to `value`, or dropped when `value` is its fixed default. */
export function setTiming(overrides, habit, key, value) {
  const { [key]: _, ...rest } = overrides ?? {};
  return value === TIMINGS[habit][key].def ? rest : { ...rest, [key]: value };
}
