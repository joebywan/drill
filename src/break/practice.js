import { BREAK_LINES, line } from '../cast/lines.js';
import { STEPS } from './routines.js';
import { steps, teach } from '../practice/kit.js';

/** Mounts one screen-break item: the teach card, or the routine with Lumi reading each step. */
export function mount(el, item, ctx) {
  if (item.type === 'teach') return teach(el, item, ctx);
  return steps(el, STEPS, ctx, {
    label: 'Screen break steps', mood: 'teach', tone: 'break',
    summary: `${STEPS.length} steps`, paused: line('paused', Math.random(), BREAK_LINES),
  });
}
