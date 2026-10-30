/**
 * The learner's own timings for the practice habits. Every routine runs on its path's defaults
 * until someone changes a value (for example to match timings they were given); then that value
 * holds everywhere the habit uses it. Pure.
 *
 * TIMINGS is each habit's settable values: { key: { label, unit?, min, max, step?, def?, at?, from? } }.
 * `def` is a fixed default (Calm's 4 in, 8 out); without one the default comes from the lesson, so
 * it grows along the path: `at` is where a lesson keeps it (an item's `field`, of `type` if given;
 * Move's are in each item's `set`), and `from` stands in when no lesson has it. `varies` marks a
 * value that differs from step to step rather than growing (the screen break's steps): the
 * routine's own values, the subject's `varied`, show as written, and setting one sets every step. Overrides are kept in
 * progress as `timings: { habit: { key: value } }` and are untrusted: `timed()` uses one only when
 * it is a whole number in range.
 */
export const TIMINGS = {
  calm: {
    inhale: { label: 'Breathe in', unit: 's', min: 2, max: 10, def: 4 },
    exhale: { label: 'Breathe out', unit: 's', min: 2, max: 12, def: 8 },
    breaths: { label: 'Breaths each time', min: 1, max: 20, from: 5, at: { type: 'breathe', field: 'cycles' } },
    sighIn: { label: 'Sigh: breathe in', unit: 's', min: 2, max: 8, def: 3 },
    sighTop: { label: 'Sigh: top-up', unit: 's', min: 1, max: 3, def: 1 },
    sighOut: { label: 'Sigh: breathe out', unit: 's', min: 3, max: 12, def: 6 },
    sighs: { label: 'Sighs each time', min: 1, max: 20, from: 5, at: { type: 'sigh', field: 'cycles' } },
    scan: { label: 'Body scan: each place', unit: 's', min: 5, max: 60, step: 5, from: 15, at: { type: 'scan', field: 'seconds' } },
    taps: { label: 'Butterfly hug: taps', min: 10, max: 120, step: 10, from: 40, at: { type: 'hug', field: 'taps' } },
  },
  move: {
    reps: { label: 'Reps', min: 1, max: 30, from: 8, at: { field: 'reps' } },
    seconds: { label: 'Each timed move', unit: 's', min: 10, max: 120, step: 5, from: 30, at: { field: 'seconds' } },
    rest: { label: 'Rest between moves', unit: 's', min: 5, max: 60, step: 5, def: 10 },
  },
  break: {
    seconds: { label: 'Each step', unit: 's', min: 5, max: 60, step: 5, from: 20, varies: true },
  },
  focus: {
    minutes: { label: 'Focus time', unit: 'min', min: 5, max: 90, step: 5, from: 10 },
  },
};

/** The words around them, linted with the rest (test/guardrails.test.js). */
export const TIMING_WORDS = {
  link: 'Your timings',
  intro: "If someone has given you timings, set them here. Anything you don't change stays as it is.",
  path: 'grows as you go',
  written: 'As written',
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

/**
 * A habit's overrides with `key` set to `value`, or dropped when `value` is its default: the fixed
 * one, or `usual` (pathTimings') for a value that grows, so stepping back to it keeps it growing.
 * A `varies` value is always kept: one time for every step is not the steps as written.
 */
export function setTiming(overrides, habit, key, value, usual) {
  const { [key]: _, ...rest } = overrides ?? {};
  const r = TIMINGS[habit][key];
  return value === (r.def ?? (r.varies ? undefined : usual)) ? rest : { ...rest, [key]: value };
}

/** The first value a lesson keeps at `at` ({ type?, field }), looking in its items and their sets. */
const valueIn = (lesson, at) => lesson.items.flatMap((it) => [it, ...(it.set ?? [])])
  .find((x) => (!at.type || x.type === at.type) && Number.isInteger(x[at.field]))?.[at.field];

/**
 * What `habit`'s growing values are now ({ key: value }): `lessons` is its path in order and `next`
 * the index of its next lesson (the one the next session runs). A value that lesson doesn't use
 * comes from the first lesson after it that does, else the last one before it, else `from`. A
 * `varies` value starts from the middle of its `varied[key]` (the routine's own values), on its step.
 */
export function pathTimings(habit, lessons, next, varied = {}) {
  const i = Math.max(0, next);
  const order = [...lessons.slice(i), ...lessons.slice(0, i).reverse()];
  const middle = (r, vals) => {
    const [lo, hi] = spread(vals);
    return Math.round((lo + hi) / 2 / (r.step ?? 1)) * (r.step ?? 1);
  };
  return Object.fromEntries(Object.entries(TIMINGS[habit] ?? {}).filter(([, r]) => r.def == null)
    .map(([k, r]) => [k, r.varies && varied[k]?.length ? middle(r, varied[k])
      : (r.at && order.map((l) => valueIn(l, r.at)).find((v) => v != null)) ?? r.from]));
}

/** The lowest and highest of `values`. */
export const spread = (values) => [Math.min(...values), Math.max(...values)];
