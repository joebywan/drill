import { BREAK_LINES, line } from '../cast/lines.js';
import { breakSteps } from './routines.js';
import { coached, teach } from '../practice/kit.js';

const say = (kind) => line(kind, Math.random(), BREAK_LINES);

/** Mounts one screen-break item: the teach card, or the routine, with Mira saying each step's cue and demonstrating it. */
export function mount(el, item, ctx) {
  if (item.type === 'teach') return teach(el, item, ctx);
  const all = breakSteps(ctx.timings);
  return coached(el, all, ctx, {
    label: 'Screen break steps', tone: 'break', summary: `${all.length} steps`, paused: say('paused'), room: say('room'),
  });
}
