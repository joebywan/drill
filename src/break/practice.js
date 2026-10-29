import { BREAK_LINES, SAFETY_LINE, line } from '../cast/lines.js';
import { STEPS } from './routines.js';
import { steps, teach } from '../practice/kit.js';
import { esc } from '../html.js';

/** The safety line, on the first lesson and after "Not really". */
export const safetyHtml = () => `<p class="help">${esc(SAFETY_LINE)}</p>`;

/** Mounts one screen-break item: the teach card, or the routine with Lumi reading each step. */
export function mount(el, item, ctx) {
  if (item.type === 'teach') return teach(el, item, ctx, item.help ? safetyHtml() : '');
  return steps(el, STEPS, ctx, {
    label: 'Screen break steps', mood: 'teach', tone: 'break',
    summary: `${STEPS.length} steps`, paused: line('paused', Math.random(), BREAK_LINES),
  });
}
