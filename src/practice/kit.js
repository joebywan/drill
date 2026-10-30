import { esc } from '../html.js';
import { countOf, timeline } from './timeline.js';
import { move, play } from '../feel.js';
import { clover, demo as act } from '../cast/clover.js';

/**
 * The parts every practice habit's mount reuses, so Calm, Move, Eyes and the rest share one
 * teach card, one pausable routine runner and one Pause button rather than a copy each.
 */

/**
 * A habit's help or safety line as plain text, with an optional phone link as an extra (never the
 * only way: the number is in the text). `help` is the subject coach's { text, tel?, call? }.
 */
export const helpHtml = ({ text, tel, call }) =>
  `<p class="help">${esc(text)}${tel ? ` <a href="${esc(tel)}">Call ${esc(call)}</a>` : ''}</p>`;

/** A teach card: paragraphs, the habit's help line when the item asks for it, and Start. */
export function teach(el, item, { say, done, help }) {
  el.innerHTML = `<div class="practice-teach">${item.text.map((t) => `<p>${esc(t)}</p>`).join('')}
    ${item.help && help ? helpHtml(help) : ''}</div>
    <div class="choices"><button class="next practice-go">Start</button></div>`;
  say(item.say, 'guide');
  el.querySelector('.practice-go').addEventListener('click', () => done(null, ''));
  return () => {};
}

/**
 * The demonstrating coach (Clover) acts out `pose` in `el`, after the mood is set (coach.set
 * redraws), looping `reps` times over `seconds`. Under reduced motion it holds the pose still, so
 * the move still reads. Returns the animations for the routine to pause, or [].
 */
export function demo(el, pose, seconds, reps) {
  const anims = act(el, pose, seconds, reps);
  if (!anims) el.innerHTML = clover('guide', pose); // the next mood change redraws over it
  return anims ?? [];
}

/** The Pause button a timed routine sits above, in the thumb zone. Put it after the routine's own markup. */
export const pauseBar = '<div class="choices"><button class="choice practice-pause" aria-pressed="false">Pause</button></div>';

/**
 * Runs a timed routine in `el` (which already holds the routine's markup and `pauseBar`). Leaving
 * the page pauses it too, so it never finishes unattended. `draw(phase, index, say)` shows each
 * phase and returns its animations, which pause and play with the clock. `paused` is the coach's
 * line while paused. Any `.count` in `el` shows the seconds left in the phase, or for a phase with
 * `reps`, which rep it is on (see countOf). Ends with
 * `ctx.done(null, summary)`. Returns the cleanup function.
 */
export function routine(el, phases, ctx, draw, summary, paused) {
  let anims = [];
  let said = '';
  let now = null; // the phase playing
  // Each phase's words are kept, so carrying on after a pause puts them back.
  const say = (text, mood) => { said = text; ctx.say(text, mood); };
  const pause = el.querySelector('.practice-pause');
  const clock = timeline(phases, {
    onPhase: (p, i) => { now = p; anims = draw(p, i, say).filter(Boolean); },
    onTick: (s) => { const c = el.querySelector('.count'); if (c) c.textContent = countOf(now, s); },
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

/**
 * A routine shown as a list of named steps (`phases` are { name, line, seconds }): the current
 * step fills slowly as the calm progress cue, with a `.count` of seconds left under the list.
 * `label` names the list for screen readers, `mood` is the coach's while it reads each line,
 * `rising` lists the steps bottom to top (the body scan), and `tone` is a class for the
 * habit's colours. `act(phase, index)` adds the step's own animations (the screen break's demos).
 * Calm's body scan and the screen break both use it.
 */
export function steps(el, phases, ctx, { label, summary, paused, mood, rising = false, tone = '', act = () => [] }) {
  el.innerHTML = `<div class="scan ${tone}">
      <ol class="steps${rising ? ' rising' : ''}" aria-label="${esc(label)}">${phases.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ol>
      <p class="scan-left" aria-hidden="true"><span class="count"></span> s</p>
    </div>${pauseBar}`;
  const rows = [...el.querySelectorAll('.steps li')];
  return routine(el, phases, ctx, (p, i, say) => {
    rows.forEach((r, j) => {
      r.className = j < i ? 'past' : j === i ? 'now' : '';
      if (j === i) r.setAttribute('aria-current', 'step'); else r.removeAttribute('aria-current');
    });
    say(p.line, mood);
    play('exhale');
    return [move(rows[i], [{ '--fill': '0%' }, { '--fill': '100%' }], { duration: p.seconds * 1000, fill: 'forwards' }), ...act(p, i)];
  }, summary, paused);
}
