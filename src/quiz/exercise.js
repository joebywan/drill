import { esc } from '../html.js';
import { cue, flourish, move, play, speak, voice } from '../feel.js';
import { nearestTick, nextTile, onLine, paired, picked, shuffle, tick, tilesOf } from './items.js';

/**
 * Mounts one item from src/quiz/items.js in `el`, for the shared lesson runner (app.js run()).
 * `ctx` is the runner's { say, done } plus `lang`, the course's language ('ja-JP'): it marks the
 * text (so the system's own font for it is used) and picks the voice; `art(picture)`, for a course
 * whose items carry a `picture`, returns its drawing for the card (html the course has escaped);
 * `look`, a class for the course's own styling (maths sets its sums large). With no voice, or Sound
 * muted, readings are shown instead of spoken and nothing waits on speech.
 * Returns a cleanup function.
 */
export function mount(el, item, ctx) {
  const lang = ctx.lang || 'en';
  const hear = (text) => speak(text, lang);
  // A listening item hides what it plays, so it only listens when there is a voice to play it.
  const listening = item.listen && !!voice(lang);
  // A pick that shows its glyph keeps quiet until answered: hearing it would give it away.
  const speaker = item.speak && voice(lang) && (item.type !== 'pick' || listening)
    ? `<button class="hear${listening ? ' big' : ''}" aria-label="Hear it again"><span aria-hidden="true">🔊</span></button>` : '';
  const glyph = (text) => `<p class="glyph" style="--len:${[...text].length}">${esc(text)}</p>`;
  const art = item.picture && ctx.art ? ctx.art(item.picture) : '';
  el.innerHTML = `<div class="quiz ${esc(ctx.look || '')}" lang="${esc(lang)}">
    <div class="card">${art}${item.type === 'build' ? `${item.show ? `<p class="meaning">${esc(item.show)}</p>` : ''}<p class="slots">${item.answer.map(() => '<span class="slot"></span>').join('')}</p>`
      : item.type === 'pairs' || listening || !item.show ? '' : glyph(item.show)}
      ${item.type === 'teach' && item.read ? `<p class="reading" lang="en">${esc(item.read)}</p>` : ''}${item.type === 'pairs' ? '' : speaker}</div>
    <div class="choices quiz-${item.type}"></div></div>`;
  const card = el.querySelector('.card');
  const choices = el.querySelector('.choices');
  el.querySelector('.hear')?.addEventListener('click', () => hear(item.speak));
  if (item.type === 'pairs' && !art) card.remove();
  return TYPES[item.type]({ card, choices, item, hear, ...ctx });
}

/** The right tap's juice: a pop, and a star off the card. Both skip under reduced motion. */
function cheer(btn, card) {
  flourish(btn, 'pop');
  if (!card?.isConnected) return;
  const star = Object.assign(document.createElement('i'), { className: 'quiz-star', textContent: '★', ariaHidden: 'true' });
  card.append(star);
  const a = move(star, [{ opacity: 0, transform: 'translateY(0) scale(.4)' }, { opacity: 1, transform: 'translateY(-24px) scale(1.3) rotate(20deg)', offset: 0.4 },
    { opacity: 0, transform: 'translateY(-48px) scale(1) rotate(40deg)' }], { duration: 700, easing: 'ease-out' });
  if (a) a.onfinish = () => star.remove(); else star.remove();
}

const button = (text, attrs = '') => `<button class="choice" ${attrs}>${esc(text)}</button>`;

const TYPES = {
  teach({ item, say, done, hear }) {
    say(item.text, 'teach');
    if (item.speak) hear(item.speak);
    done(null);
    return () => {};
  },

  /** One tap, final: marked right or wrong, the right one shown either way. */
  pick({ card, choices, item, say, done, hear }) {
    const options = shuffle(item.options);
    choices.innerHTML = options.map((o) => button(o)).join('');
    say(item.prompt, 'think');
    if (item.listen) hear(item.speak);
    [...choices.children].forEach((b, i) => b.addEventListener('click', () => {
      for (const other of choices.children) other.disabled = true;
      const correct = picked(item, options[i]);
      b.classList.add(correct ? 'right' : 'wrong');
      const right = choices.children[options.findIndex((o) => picked(item, o))];
      right.classList.add('right');
      if (correct) cheer(b, card);
      if (item.speak) hear(item.speak); // the answer, heard
      done(correct, item.explain);
    }));
    return () => {};
  },

  /**
   * Tap one from each column. A match locks green at once (and is spoken); a mismatch flashes and
   * lets go, and the item counts as missed. Done when every pair is matched.
   */
  pairs({ choices, item, say, done, hear }) {
    const cols = [0, 1].map((side) => shuffle(item.pairs.map((p) => p[side])));
    choices.innerHTML = cols[0].map((l, i) => button(l, `data-side="0" aria-pressed="false"`) + button(cols[1][i], `data-side="1" aria-pressed="false"`)).join('');
    say(item.prompt, 'think');
    let held = null;
    let left = item.pairs.length;
    let slipped = false;
    const hold = (b) => { held?.setAttribute('aria-pressed', 'false'); held = b; b?.setAttribute('aria-pressed', 'true'); };
    const timers = [];
    for (const b of choices.children) b.addEventListener('click', () => {
      if (!held || held.dataset.side === b.dataset.side) { hold(held === b ? null : b); play('tap'); return; }
      const [l, r] = held.dataset.side === '0' ? [held, b] : [b, held];
      const pair = [l, r];
      hold(null);
      if (paired(item, l.textContent, r.textContent)) {
        for (const x of pair) { x.disabled = true; x.classList.add('right'); x.removeAttribute('aria-pressed'); }
        cheer(r, choices);
        hear(l.textContent);
        if (--left === 0) done(!slipped, item.explain); else play('tap');
      } else {
        slipped = true;
        cue('wrong');
        for (const x of pair) { x.classList.add('wrong'); flourish(x, 'shake'); }
        timers.push(setTimeout(() => { for (const x of pair) x.classList.remove('wrong'); }, 600));
      }
    });
    return () => timers.forEach(clearTimeout);
  },

  /**
   * A number line on the card (the answer banner would cover the thumb zone, and where the marker
   * landed is the feedback): drag the marker, or tap the line, and let go to answer. It snaps to
   * the nearest tick. Arrow keys step along it; Enter or Space answers.
   */
  line({ card, choices, item, say, done }) {
    choices.remove();
    const unit = item.unit || '';
    const at = (k) => `${(100 * k) / item.ticks}%`;
    card.insertAdjacentHTML('beforeend', `<div class="numline" role="slider" tabindex="0" aria-label="${esc(item.prompt)}"
        aria-valuemin="${item.min}" aria-valuemax="${item.max}">
        <div class="track">${Array.from({ length: item.ticks + 1 }, (_, k) => `<i style="left:${at(k)}"></i>`).join('')}
          <b class="marker"></b><b class="marker answer" hidden></b></div>
        <span class="end">${esc(item.min + unit)}</span><span class="end">${esc(item.max + unit)}</span>
      </div>`);
    const slider = card.querySelector('.numline');
    const track = slider.querySelector('.track');
    const [marker, shown] = slider.querySelectorAll('.marker');
    let k = 0;
    let over = false;
    const place = (next) => {
      k = next;
      marker.style.left = at(k);
      slider.setAttribute('aria-valuenow', tick(item, k));
      slider.setAttribute('aria-valuetext', `${+tick(item, k).toFixed(4)}${unit}`);
    };
    const fromPointer = (e) => {
      const r = track.getBoundingClientRect();
      place(nearestTick(item, (e.clientX - r.left) / r.width));
    };
    const answer = () => {
      if (over) return;
      over = true;
      const correct = onLine(item, tick(item, k));
      marker.classList.add(correct ? 'right' : 'wrong');
      if (correct) cheer(marker, card);
      else {
        shown.hidden = false;
        shown.style.left = at(Array.from({ length: item.ticks + 1 }, (_, i) => i).find((i) => onLine(item, tick(item, i))));
        flourish(marker, 'shake');
      }
      done(correct, item.explain);
    };
    place(0); // the marker waits at the start, ready to drag
    slider.addEventListener('pointerdown', (e) => {
      if (over) return;
      slider.setPointerCapture?.(e.pointerId);
      fromPointer(e);
    });
    slider.addEventListener('pointermove', (e) => { if (!over && e.buttons) fromPointer(e); });
    slider.addEventListener('pointerup', answer);
    slider.addEventListener('keydown', (e) => {
      if (over) return;
      const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (step) { e.preventDefault(); place(Math.min(item.ticks, Math.max(0, k + step))); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answer(); }
    });
    say(item.prompt, 'think');
    return () => {};
  },

  /** Tap the tiles in order. A right tile drops into its slot; a wrong one ends it and shows the word. */
  build({ card, choices, item, say, done, hear }) {
    const tiles = tilesOf(item);
    choices.innerHTML = tiles.map((t) => button(t)).join('');
    say(item.prompt, 'think');
    const slots = [...card.querySelectorAll('.slot')];
    let at = 0;
    for (const b of choices.children) b.addEventListener('click', () => {
      if (b.textContent === nextTile(item, at)) {
        b.disabled = true;
        b.classList.add('used');
        slots[at].textContent = b.textContent;
        move(slots[at], [{ transform: 'scale(.6)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
        if (++at < item.answer.length) return play('tap');
      } else {
        b.classList.add('wrong');
        slots.slice(at).forEach((s, i) => { s.textContent = item.answer[at + i]; s.classList.add('shown'); });
      }
      for (const x of choices.children) x.disabled = true;
      const correct = at === item.answer.length;
      if (correct) cheer(card.querySelector('.slots'), card);
      if (item.speak) hear(item.speak);
      done(correct, item.explain);
    });
    return () => {};
  },
};
