import { BREAK_LINES, line } from '../cast/lines.js';
import { breakSteps } from './routines.js';
import { demo, steps, teach } from '../practice/kit.js';
import { esc } from '../html.js';

/**
 * Mounts one screen-break item: the teach card, or the routine with Mira saying each step's cue
 * and demonstrating it. The step's guidance stays on screen beside the timer, with what's next
 * under it, so nobody has to stop and tap to find out how.
 */
export function mount(el, item, ctx) {
  if (item.type === 'teach') return teach(el, item, ctx);
  const all = breakSteps(ctx.timings);
  return steps(el, all, ctx, {
    label: 'Screen break steps', mood: 'guide', tone: 'break', inline: true,
    summary: `${all.length} steps`, paused: line('paused', Math.random(), BREAK_LINES),
    act: (p, i) => {
      el.querySelector('.how-now').innerHTML = p.how.map((t) => `<li>${esc(t)}</li>`).join('');
      el.querySelector('.next-step').textContent = all[i + 1] ? `Next: ${all[i + 1].name}` : 'Last one';
      return demo(ctx, p.pose, p.seconds, p.loops);
    },
    detail: '<ul class="how-now"></ul><p class="next-step"></p>',
  });
}
