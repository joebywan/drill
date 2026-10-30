import { esc } from '../html.js';
import { countOf, timeline } from './timeline.js';
import { move, play } from '../feel.js';

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

/**
 * A teach card: paragraphs, the habit's help line when the item asks for it, and Start. An item may
 * name its own button (`go`, Wind down's "Goodnight") and the coach's mood (`mood`, default 'guide').
 */
export function teach(el, item, { say, done, help }) {
  el.innerHTML = `<div class="practice-teach">${item.text.map((t) => `<p>${esc(t)}</p>`).join('')}
    ${item.help && help ? helpHtml(help) : ''}</div>
    <div class="choices"><button class="next practice-go">${esc(item.go ?? 'Start')}</button></div>`;
  say(item.say, item.mood ?? 'guide');
  el.querySelector('.practice-go').addEventListener('click', () => done(null, ''));
  return () => {};
}

/**
 * The subject's demonstrating coach (`coach.demo`: Clover for Move, Mira for the screen break)
 * acts out `pose` in `coachEl`, after the mood is set (coach.set redraws), looping `reps` times over
 * `seconds`. Under reduced motion it holds the pose still, so the move still reads. Returns the
 * animations for the routine to pause, or [].
 */
export function demo({ coach, coachEl }, pose, seconds, reps) {
  const anims = coach.demo(coachEl, pose, seconds, reps);
  if (!anims) coachEl.innerHTML = coach.draw('guide', pose); // the next mood change redraws over it
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
 * Plays several routines one after another as one item, run once: each part through
 * `play(el, part, ctx)` (a habit's mount for a single routine, such as Calm's breathing or scan),
 * then the next, each with its own Pause. `ctx.done(null, summary)` is called once at the end with
 * the parts' summaries joined ("3 breaths · 2 sighs"). Wind down chains Calm's routines this way.
 * Returns the cleanup function, which stops whichever part is playing.
 */
export function sequence(el, parts, ctx, play) {
  const did = [];
  let at = 0;
  let stop = () => {};
  const next = () => {
    if (at === parts.length) return ctx.done(null, did.join(' · '));
    stop = play(el, parts[at++], { ...ctx, done: (_, text) => { if (text) did.push(text); next(); } });
    if (at > 1) el.querySelector('.practice-go, .choice')?.focus(); // the session focused the first
  };
  next();
  return () => stop();
}

/**
 * A routine shown as a list of named steps (`phases` are { name, line, seconds }): the current
 * step fills slowly as the calm progress cue, with a `.count` of seconds left under the list.
 * `label` names the list for screen readers, `mood` is the coach's while it reads each line,
 * `rising` lists the steps bottom to top (the body scan), and `tone` is a class for the
 * habit's colours. `act(phase, index)` adds the step's own animations (the screen break's demos).
 * `inline` shows the seconds left in the current row, for a screen with a large coach above.
 * Calm's body scan and the screen break both use it.
 */
export function steps(el, phases, ctx, { label, summary, paused, mood, rising = false, tone = '', act = () => [], inline = false }) {
  const left = '<span class="count"></span> s';
  el.innerHTML = `<div class="scan ${tone}${inline ? ' inline' : ''}">
      <ol class="steps${rising ? ' rising' : ''}" aria-label="${esc(label)}">${phases.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ol>
      ${inline ? '' : `<p class="scan-left" aria-hidden="true">${left}</p>`}
    </div>${pauseBar}`;
  const rows = [...el.querySelectorAll('.steps li')];
  const inRow = Object.assign(document.createElement('span'), { className: 'step-left', innerHTML: left });
  inRow.setAttribute('aria-hidden', 'true');
  return routine(el, phases, ctx, (p, i, say) => {
    if (inline) rows[i].append(inRow);
    rows.forEach((r, j) => {
      r.className = j < i ? 'past' : j === i ? 'now' : '';
      if (j === i) r.setAttribute('aria-current', 'step'); else r.removeAttribute('aria-current');
    });
    say(p.line, mood);
    play('exhale');
    return [move(rows[i], [{ '--fill': '0%' }, { '--fill': '100%' }], { duration: p.seconds * 1000, fill: 'forwards' }), ...act(p, i)];
  }, summary, paused);
}
