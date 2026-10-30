import course from '../data/move.json' with { type: 'json' };
import { MOVE_LINES, line } from '../cast/lines.js';
import { phases, summary } from './routines.js';
import { demo, pauseBar, routine, teach } from '../practice/kit.js';
import { buzz, play } from '../feel.js';

const say = (kind) => line(kind, Math.random(), MOVE_LINES);

/**
 * Mounts one Move item in `el`: a teach card, or a routine of timed exercises with rests between.
 * The screen shows the move, a plain cue, its reps or seconds (`.count`) and "Exercise n of N";
 * rests show what's next. The coach (`ctx.coachEl`) demonstrates. `done(null, "5 moves · 8 squats")` at the end.
 */
export function mount(el, item, ctx) {
  if (item.type === 'teach') return teach(el, item, ctx);
  el.innerHTML = `<div class="exercise">
      <p class="which" aria-live="polite"></p>
      <h2></h2>
      <p class="cue"></p>
      <p class="tally"><span class="count"></span> <span class="unit"></span></p>
    </div>${pauseBar}`;
  const [which, name, cue, unit] = ['.which', 'h2', '.cue', '.unit'].map((s) => el.querySelector(s));
  return routine(el, phases(item.set, course.moves), ctx, (p, i, coachSay) => {
    el.firstElementChild.dataset.kind = p.kind;
    play(p.kind === 'rest' ? 'exhale' : 'inhale');
    buzz('inhale');
    if (p.kind === 'rest') {
      which.textContent = `Rest · next: ${p.next}`;
      name.textContent = 'Rest';
      cue.textContent = p.cue; // a look ahead at the next move
      unit.textContent = 's';
      coachSay(say('rest'), 'rest');
      return [];
    }
    which.textContent = `Exercise ${p.n} of ${p.of}`;
    name.textContent = p.name;
    cue.textContent = p.cue;
    unit.textContent = p.reps ? `of ${p.reps}` : 's';
    coachSay(say('go'), 'guide');
    return demo(ctx, p.pose, p.seconds, p.reps);
  }, summary(item.set, course.moves), say('paused'));
}
