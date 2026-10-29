import course from '../data/calm.json' with { type: 'json' };
import { breathe } from '../cast/moss.js';
import { CALM_LINES, HELP_LINE, HELP_TEL, line } from '../cast/lines.js';
import { breaths, scan } from './routines.js';
import { pauseBar, routine, steps, teach } from '../practice/kit.js';
import { buzz, move, play } from '../feel.js';
import { esc } from '../html.js';

const calm = (kind) => line(kind, Math.random(), CALM_LINES);

/** The help line as plain text, with the number also as a link for phones. */
export const helpHtml = () =>
  `<p class="help">${esc(HELP_LINE)} <a href="${HELP_TEL}">Call 13 11 14</a></p>`;

/**
 * Mounts one Calm item in `el`: a teach card, or a guided routine (breathe, ground, scan).
 * `say(text, mood)` sets Moss's line and mood; `coachEl` is Moss's element, which breathes along.
 * `done(null, summary)` is called once when the item ends, with what was done ("3 breaths").
 * There is no right or wrong. Returns a cleanup function.
 */
export function mount(el, item, ctx) {
  return MOUNTS[item.type](el, item, ctx);
}

const MOUNTS = {
  teach: (el, item, ctx) => teach(el, item, ctx, item.help ? helpHtml() : ''),
  breathe: breathing, ground: grounding, scan: scanning,
};

function breathing(el, item, ctx) {
  const n = item.cycles;
  el.innerHTML = `<div class="breath">
      <div class="orb" aria-hidden="true"><span class="count"></span></div>
      <p class="which" aria-live="polite"></p>
    </div>${pauseBar}`;
  const orb = el.querySelector('.orb');
  const which = el.querySelector('.which');
  const SMALL = 'scale(.55)', BIG = 'scale(1)';
  return routine(el, breaths(n), ctx, (p, i, say) => {
    const inhale = p.phase === 'in';
    orb.dataset.phase = p.phase;
    if (inhale) which.textContent = `Breath ${p.cycle + 1} of ${n}`;
    say(calm(inhale ? 'breatheIn' : 'breatheOut'), inhale ? 'inhale' : 'exhale');
    play(inhale ? 'inhale' : 'exhale');
    buzz(inhale ? 'inhale' : 'exhale');
    return [
      move(orb, [{ transform: inhale ? SMALL : BIG }, { transform: inhale ? BIG : SMALL }],
        { duration: p.seconds * 1000, easing: 'ease-in-out', fill: 'forwards' }),
      breathe(ctx.coachEl, p.phase, p.seconds),
    ];
  }, `${n} breaths`, calm('paused'));
}

function scanning(el, item, ctx) {
  const zones = course.zones;
  return steps(el, scan(zones, item.seconds), ctx, {
    label: 'Body scan, feet to head', rising: true, mood: 'notice',
    summary: `${zones.length} places, feet to head`, paused: calm('paused'),
  });
}

/** 5-4-3-2-1: tap a bubble for each thing noticed. Self-paced, so no clock and no Pause. */
function grounding(el, item, { say, done }) {
  const senses = course.senses;
  let at = 0;
  let noticed = 0;
  let timer;
  const show = () => {
    const s = senses[at];
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
