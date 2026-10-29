import { esc } from '../html.js';
import { timeline } from './timeline.js';

/**
 * The parts every practice habit's mount reuses, so Calm, Move, Eyes and the rest share one
 * teach card, one pausable routine runner and one Pause button rather than a copy each.
 */

/** A teach card: paragraphs, optional extra html (a help line), and Start. `say` is the coach's line. */
export function teach(el, item, { say, done }, extra = '') {
  el.innerHTML = `<div class="practice-teach">${item.text.map((t) => `<p>${esc(t)}</p>`).join('')}
    ${extra}</div>
    <div class="choices"><button class="next practice-go">Start</button></div>`;
  say(item.say, 'guide');
  el.querySelector('.practice-go').addEventListener('click', () => done(null, ''));
  return () => {};
}

/** The Pause button a timed routine sits above, in the thumb zone. Put it after the routine's own markup. */
export const pauseBar = '<div class="choices"><button class="choice practice-pause" aria-pressed="false">Pause</button></div>';

/**
 * Runs a timed routine in `el` (which already holds the routine's markup and `pauseBar`). Leaving
 * the page pauses it too, so it never finishes unattended. `draw(phase, index, say)` shows each
 * phase and returns its animations, which pause and play with the clock. `paused` is the coach's
 * line while paused. Any `.count` in `el` shows the seconds left in the phase. Ends with
 * `ctx.done(null, summary)`. Returns the cleanup function.
 */
export function routine(el, phases, ctx, draw, summary, paused) {
  let anims = [];
  let said = '';
  // Each phase's words are kept, so carrying on after a pause puts them back.
  const say = (text, mood) => { said = text; ctx.say(text, mood); };
  const pause = el.querySelector('.practice-pause');
  const clock = timeline(phases, {
    onPhase: (p, i) => { anims = draw(p, i, say).filter(Boolean); },
    onTick: (s) => { const c = el.querySelector('.count'); if (c) c.textContent = s; },
    onEnd: () => { cleanup(); ctx.done(null, summary); },
  });
  const hold = () => {
    clock.pause();
    for (const a of anims) a.pause();
    pause.textContent = 'Carry on';
    pause.setAttribute('aria-pressed', 'true');
    ctx.say(paused); // no mood change: the coach holds where it was
  };
  const carryOn = () => {
    pause.textContent = 'Pause';
    pause.setAttribute('aria-pressed', 'false');
    ctx.say(said);
    for (const a of anims) a.play();
    clock.resume();
  };
  pause.addEventListener('click', () => (clock.paused ? carryOn() : hold()));
  const hidden = () => { if (document.hidden && !clock.paused) hold(); };
  document.addEventListener('visibilitychange', hidden);
  const cleanup = () => { clock.stop(); document.removeEventListener('visibilitychange', hidden); };
  return cleanup;
}
