import course from '../data/focus.json' with { type: 'json' };
import { FOCUS_LINES, line } from '../cast/lines.js';
import { pauseBar, routine, stayAwake, teach } from '../practice/kit.js';
import { timed } from '../practice/timings.js';
import { cue, move } from '../feel.js';
import { esc } from '../html.js';
import { focusLines } from '../progress.js';

const hazel = (kind) => line(kind, Math.random(), FOCUS_LINES);

/** A focus session as a timeline: one phase of `minutes` (the learner's own, if set), shown as m:ss. */
export const session = (minutes, own) => [{ seconds: timed('focus', { minutes }, own).minutes * 60, clock: true }];

/**
 * Mounts one Focus item: the teach card, or a session. A session asks what it's for (a preset,
 * your own words, or nothing), then runs a calm timer with Hazel at work beside it, the screen kept
 * on. Pause and "I'm done" are always there; finishing early ends it like any other, with nothing
 * counted against it. What it was for goes to the journal through `done`'s third argument (each
 * session's line added to the day's list), never the log. Returns a cleanup function.
 */
export function mount(el, item, ctx) {
  return item.type === 'teach' ? teach(el, item, ctx) : ask(el, item, ctx);
}

function ask(el, item, ctx) {
  const phases = session(item.minutes, ctx.timings);
  const mins = phases[0].seconds / 60;
  el.innerHTML = `<form class="focus-ask">
      <h2><label for="focus-on">${esc(course.ask)}</label></h2>
      <div class="focus-presets">${course.presets.map((p) => `<button type="button" class="choice" data-on="${esc(p)}">${esc(p)}</button>`).join('')}</div>
      <input id="focus-on" autocomplete="off" autocapitalize="sentences" enterkeyhint="go" maxlength="80" placeholder="${esc(course.own)}">
      <div class="choices"><button class="next focus-go">Start · ${mins} min</button></div>
    </form>`;
  ctx.say(hazel('ask'), 'guide');
  let stop = () => {};
  const start = (on) => { stop = run(el, phases, on.trim(), ctx); };
  for (const b of el.querySelectorAll('[data-on]')) b.addEventListener('click', () => start(b.dataset.on));
  el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); start(el.querySelector('input').value); });
  return () => stop();
}

function run(el, phases, on, ctx) {
  el.innerHTML = `<div class="focus-timer">
      ${on ? `<p class="focus-on">${esc(on)}</p>` : ''}
      <div class="focus-dial" role="timer" aria-label="Time left"><span class="count"></span></div>
    </div>${pauseBar}`;
  const pause = el.querySelector('.practice-pause');
  pause.insertAdjacentHTML('beforebegin', `<button class="choice focus-early">${esc(course.early)}</button>`);
  const kept = on ? { focus: [on] } : null;
  const awake = stayAwake();
  const finish = () => { awake(); ctx.done(null, '', kept); };
  const stop = routine(el, phases, { ...ctx, done: () => { cue('bell'); finish(); } }, (p, i, say) => {
    say(hazel('go'), 'focus');
    return [move(el.querySelector('.focus-dial'), [{ '--fill': '0%' }, { '--fill': '100%' }], { duration: p.seconds * 1000, fill: 'forwards' })];
  }, '', hazel('paused'), { hidden: 'run' });
  el.querySelector('.focus-early').addEventListener('click', () => { stop(); finish(); });
  pause.focus();
  return () => { awake(); stop(); };
}

/** The habit view's hook: what each of a day's sessions was for, or nothing. Read only here and by the file export. */
export function dayDetail(progress, date) {
  const rows = focusLines(progress.journal?.[date]).map((t) => `<li><span>Focused on</span> ${esc(t)}</li>`);
  return rows.length ? `<ul class="journal" aria-label="What you focused on">${rows.join('')}</ul>` : '';
}
