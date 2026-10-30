import { BREAK_LINES, line } from '../cast/lines.js';
import { STEPS } from './routines.js';
import { demo, steps, teach } from '../practice/kit.js';
import { esc } from '../html.js';

/**
 * Mounts one screen-break item: the teach card, or the routine with Clover saying each step's cue
 * and demonstrating it. "How?" opens the step's guidance and pauses the routine (its own Pause)
 * until it is closed.
 */
export function mount(el, item, ctx) {
  if (item.type === 'teach') return teach(el, item, ctx);
  let now = STEPS[0];
  const stop = steps(el, STEPS, ctx, {
    label: 'Screen break steps', mood: 'guide', tone: 'break', inline: true,
    summary: `${STEPS.length} steps`, paused: line('paused', Math.random(), BREAK_LINES),
    act: (p) => { now = p; return demo(ctx.coachEl, p.pose, p.seconds, p.loops); },
  });
  const pause = el.querySelector('.practice-pause');
  pause.insertAdjacentHTML('beforebegin', '<button class="choice practice-how">How?</button>');
  el.insertAdjacentHTML('beforeend', '<dialog class="how" aria-labelledby="how-title"><h2 id="how-title"></h2><div></div><form method="dialog"><button class="next">Got it</button></form></dialog>');
  const how = el.querySelector('.how');
  let held = false; // whether opening "How?" paused the routine, so closing it carries on
  el.querySelector('.practice-how').addEventListener('click', () => {
    how.querySelector('h2').textContent = now.name;
    how.querySelector('div').innerHTML = now.how.map((t) => `<p>${esc(t)}</p>`).join('');
    held = pause.getAttribute('aria-pressed') === 'false';
    if (held) pause.click();
    how.showModal();
  });
  how.addEventListener('close', () => { if (held) pause.click(); held = false; });
  return () => { how.close(); stop(); };
}
