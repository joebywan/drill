import course from '../data/calm.json' with { type: 'json' };
import { breathe, tap } from '../cast/moss.js';
import { CALM_LINES, line } from '../cast/lines.js';
import { breaths, hugTaps, scan, sighs } from './routines.js';
import { pauseButton, routine, steps, teach } from '../practice/kit.js';
import { buzz, calmSound, move, play, rain } from '../feel.js';
import { esc } from '../html.js';

const calm = (kind) => line(kind, Math.random(), CALM_LINES);

/**
 * Mounts one Calm item in `el`: a teach card, or a guided routine (breathe, ground, scan).
 * `say(text, mood)` sets Moss's line and mood; `coachEl` is Moss's element, which breathes along.
 * `done(null, summary)` is called once when the item ends, with what was done ("3 breaths").
 * There is no right or wrong. Returns a cleanup function.
 */
export function mount(el, item, ctx) {
  if (item.type === 'teach') return teach(el, item, ctx);
  return sounded(el, item, ctx, practise);
}

/**
 * Plays `run(el, item, ctx)` opening and closing on the soft bell, with rain under it, each only if
 * turned on (the ⋯ screen). Wind down wraps its whole sequence in it, so the bell rings once each end.
 */
export function sounded(el, item, ctx, run) {
  const bell = () => { if (calmSound('bell')) play('bell'); };
  bell();
  const quiet = rain();
  const stop = run(el, item, { ...ctx, done: (...a) => { bell(); ctx.done(...a); } });
  return () => { quiet(); stop(); };
}

/** One Calm routine (breathe, sigh, hug, ground, scan) with no bell or rain: for a habit chaining them. */
export const practise = (el, item, ctx) => MOUNTS[item.type](el, item, ctx);

const MOUNTS = {
  breathe: breathing, sigh: breathing, hug: hugging, ground: grounding, scan: scanning,
};

// How full the orb is at the end of each breath phase. The sigh's first breath stops short, so
// the top-up has room to fill it.
const SIZE = { in: 1, top: 1, out: 0.55, sigh: 0.55 };
const WORDS = { in: 'breatheIn', out: 'breatheOut' };
const SIGH_WORDS = { in: 'sighIn', top: 'sighTop', sigh: 'sighOut' };

/** Breathing (4 in, 8 out) and the sigh (in, a little more, a long sigh out), with Moss along. */
function breathing(el, item, ctx) {
  const sigh = item.type === 'sigh';
  const phases = (sigh ? sighs : breaths)(item.cycles, ctx.timings);
  const n = phases.at(-1).cycle + 1;
  const name = sigh ? 'Sigh' : 'Breath';
  let size = SIZE.out;
  el.innerHTML = `<div class="breath">
      <div class="orb" aria-hidden="true"><span class="count"></span></div>
      <p class="which" aria-live="polite"></p>
    </div>${pauseButton}`;
  const orb = el.querySelector('.orb');
  const which = el.querySelector('.which');
  return routine(el, phases, ctx, (p, i, say) => {
    const inhale = p.phase === 'in' || p.phase === 'top';
    orb.dataset.phase = inhale ? 'in' : 'out';
    if (p.phase === 'in') which.textContent = `${name} ${p.cycle + 1} of ${n}`;
    say(calm((sigh ? SIGH_WORDS : WORDS)[p.phase]), inhale ? 'inhale' : 'exhale');
    play(inhale ? 'inhale' : 'exhale');
    buzz(inhale ? 'inhale' : 'exhale');
    const from = size;
    size = sigh && p.phase === 'in' ? 0.85 : SIZE[p.phase];
    return [
      move(orb, [{ transform: `scale(${from})` }, { transform: `scale(${size})` }],
        { duration: p.seconds * 1000, easing: 'ease-in-out', fill: 'forwards' }),
      breathe(ctx.coachEl, p.phase, p.seconds),
    ];
  }, `${n} ${name.toLowerCase()}${n === 1 ? '' : 's'}`, calm('paused'));
}

/** The butterfly hug: arms crossed, one slow tap a second, left then right, as Moss does it. */
function hugging(el, item, ctx) {
  const taps = hugTaps(item.taps, ctx.timings);
  const n = taps.length;
  el.innerHTML = `<div class="hug">
      <div class="sides" aria-hidden="true"><span data-side="left">Left</span><span data-side="right">Right</span></div>
      <p class="which" aria-live="off"></p>
    </div>${pauseButton}`;
  const sides = el.querySelectorAll('[data-side]');
  const which = el.querySelector('.which');
  return routine(el, taps, ctx, (p, i, say) => {
    for (const s of sides) s.classList.toggle('on', s.dataset.side === p.side);
    which.textContent = `Tap ${p.tap + 1} of ${n}`;
    if (!i) say(calm('hug'), 'hug'); // one line: a new one every second would be a lot to hear
    buzz('inhale');
    return [tap(ctx.coachEl, p.side)];
  }, `${n} slow taps`, calm('paused'));
}

function scanning(el, item, ctx) {
  const zones = course.zones;
  return steps(el, scan(zones, item.seconds, ctx.timings), ctx, {
    label: 'Body scan, feet to head', rising: true, mood: 'notice', inline: true,
    summary: `${zones.length} places, feet to head`, paused: calm('paused'),
  });
}

/** 5-4-3-2-1: tap a bubble for each thing noticed. Self-paced, so no clock and no Pause. */
function grounding(el, item, { say, done, reached }) {
  const senses = course.senses;
  let at = 0;
  let noticed = 0;
  let timer;
  const show = () => {
    const s = senses[at];
    reached?.(at, senses.length);
    el.innerHTML = `<div class="ground">
        <p class="topic">Step ${at + 1} of ${senses.length}</p>
        <h2>${esc(s.prompt)}</h2>
        <p class="said">${esc(s.hint)}</p>
        <div class="bubbles">${Array.from({ length: s.count }, (_, i) =>
          `<button class="bubble-tap" aria-pressed="false" aria-label="Noticed ${i + 1} of ${s.count}"></button>`).join('')}</div>
      </div>
      <div class="choices"><button class="choice practice-on">${at + 1 < senses.length ? 'Next' : 'Finish'}</button></div>`;
    say(calm('ground'), 'notice');
    const bubbles = [...el.querySelectorAll('.bubble-tap')];
    const noticedAll = () => bubbles.every((x) => x.getAttribute('aria-pressed') === 'true');
    if (at) bubbles[0].focus();
    for (const b of bubbles) {
      b.addEventListener('click', () => {
        // Any bubble fills the next empty one, so the count always reads left to right.
        const next = bubbles.find((x) => x.getAttribute('aria-pressed') === 'false');
        if (!next) return;
        next.setAttribute('aria-pressed', 'true');
        noticed++;
        play('tap');
        buzz('inhale');
        move(next, [{ transform: 'scale(.8)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
        if (noticedAll()) timer = setTimeout(onward, 700);
      });
    }
    el.querySelector('.practice-on').addEventListener('click', onward);
  };
  const onward = () => {
    clearTimeout(timer);
    if (++at < senses.length) show();
    else done(null, `${noticed} things noticed`);
  };
  show();
  return () => clearTimeout(timer);
}
