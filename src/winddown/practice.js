import course from '../data/winddown.json' with { type: 'json' };
import { WINDDOWN_LINES, line } from '../cast/lines.js';
import { practise, sounded } from '../calm/practice.js';
import { sequence, steps, teach } from '../practice/kit.js';

/**
 * Wind down: a bedtime sequence made of Calm's own routines. A 'sequence' item plays its `parts` one
 * after another through kit.js `sequence()`: its own two (settle in, goodnight) and Calm's breathing,
 * scan and sigh, with Calm's bell and rain once around the whole thing. The learner's Calm timings
 * reach the Calm parts through ctx.timings (the subject's `timings: 'calm'`).
 */
const OWN = {
  settle: (el, item, ctx) => steps(el, course.settle, ctx, {
    label: 'Settling in', mood: 'sleepy', paused: line('paused', Math.random(), WINDDOWN_LINES),
  }),
  goodnight: (el, item, ctx) => teach(el, course.goodnight, ctx),
};
const part = (el, item, ctx) => (OWN[item.type] ?? practise)(el, item, ctx);

export function mount(el, item, ctx) {
  if (item.type === 'teach') return teach(el, item, ctx);
  return sounded(el, item, ctx, (at, it, c) => sequence(at, it.parts, c, part));
}
