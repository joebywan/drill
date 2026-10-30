import { nearestTick, nextTile, tick, tilesFor } from './items.js';
import { move, play } from '../feel.js';
import { esc } from '../html.js';

/**
 * Answer buttons in the thumb zone, as [label, right]. The first tap is final: it is marked right or
 * wrong, the right one is shown either way, and `then(right)` runs. Chess's true/false uses it too.
 */
export function choices(el, options, then) {
  el.innerHTML = options.map(([label]) => `<button class="choice">${esc(label)}</button>`).join('');
  [...el.children].forEach((b, i) => b.addEventListener('click', () => {
    for (const other of el.children) other.disabled = true;
    const right = options[i][1];
    b.classList.add(right ? 'right' : 'wrong');
    el.children[options.findIndex(([, r]) => r)]?.classList.add('right');
    then(right);
  }));
}

const pop = (el) => move(el, [{ transform: 'scale(.7)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
const shake = (el) => move(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 });

/**
 * Plays one item of a type in items.js, with `ctx` the runner's { say, done } (see chess/exercise.js).
 * `rules` is what the subject knows:
 *   answer(item)        the answer as text, for tiles ("43", "2/5")
 *   right(item, value)  whether a picked option or a value on the line is right
 *   together(item, a, b) whether two pairs tiles go together
 *   show(item)          html above the answer: a picture, the sum. Escaped by the subject.
 *   explain(item)       what is said after the answer
 * Returns a cleanup function.
 */
export function mount(el, item, ctx, rules) {
  el.innerHTML = `<div class="sum">${rules.show(item)}</div><div class="choices ${item.type}"></div>`;
  return TYPES[item.type](el.firstChild, el.lastChild, item, ctx, rules) || (() => {});
}

const TYPES = {
  teach(sum, bottom, item, { say, done }) {
    bottom.remove();
    say(item.text, 'teach');
    done(null);
  },

  pick(sum, bottom, item, { say, done }, rules) {
    choices(bottom, item.options.map((o) => [o, rules.right(item, o)]), (right) => done(right, rules.explain(item)));
    say(item.prompt, 'think');
  },

  /** Tap tiles in order: each one is judged at once, and a wrong one ends it with the answer shown. */
  tiles(sum, bottom, item, { say, done }, rules) {
    const answer = rules.answer(item);
    sum.insertAdjacentHTML('beforeend', `<p class="built" aria-live="polite">${[...answer].map(() => '<i></i>').join('')}</p>`);
    const slots = sum.querySelectorAll('.built i');
    bottom.innerHTML = tilesFor(item, answer).map((t) => `<button class="tile">${esc(t)}</button>`).join('');
    let built = '';
    for (const b of bottom.children) {
      b.addEventListener('click', () => {
        const verdict = nextTile(answer, built, b.textContent);
        if (verdict === 'wrong') {
          for (const t of bottom.children) t.disabled = true;
          b.classList.add('wrong');
          shake(b);
          slots.forEach((s, i) => { if (i >= built.length) { s.textContent = answer[i]; s.className = 'shown'; } });
          return done(false, rules.explain(item));
        }
        b.disabled = true;
        b.classList.add('used');
        slots[built.length].textContent = b.textContent;
        pop(slots[built.length]);
        built += b.textContent;
        if (verdict === 'done') {
          for (const t of bottom.children) t.disabled = true;
          sum.querySelector('.built').classList.add('right');
          return done(true, rules.explain(item));
        }
        play('tap');
      });
    }
    say(item.prompt, 'think');
  },

  /**
   * A number line: drag the marker (or tap the line) and let go to answer. It
   * snaps to the nearest tick. Arrow keys step along it; Enter or Space answers.
   */
  line(sum, bottom, item, { say, done }, rules) {
    const unit = item.unit || '';
    const at = (k) => `${(100 * k) / item.ticks}%`;
    // On the stage, not in the thumb zone: the answer banner would cover where the marker landed.
    bottom.remove();
    sum.insertAdjacentHTML('beforeend', `<div class="numline" role="slider" tabindex="0" aria-label="${esc(item.prompt)}"
        aria-valuemin="${item.min}" aria-valuemax="${item.max}">
        <div class="track">${Array.from({ length: item.ticks + 1 }, (_, k) => `<i style="left:${at(k)}"></i>`).join('')}
          <b class="marker"></b><b class="marker answer" hidden></b></div>
        <span class="end">${esc(item.min + unit)}</span><span class="end">${esc(item.max + unit)}</span>
      </div>`);
    const slider = sum.querySelector('.numline');
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
      const right = rules.right(item, tick(item, k));
      marker.classList.add(right ? 'right' : 'wrong');
      if (!right) {
        const want = Array.from({ length: item.ticks + 1 }, (_, i) => i).find((i) => rules.right(item, tick(item, i)));
        shown.hidden = false;
        shown.style.left = at(want);
        shake(marker);
      } else pop(marker);
      done(right, rules.explain(item));
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
  },

  /** Tap two tiles that go together: they pop. A wrong pair shakes and counts as a slip; play on until all are gone. */
  pairs(sum, bottom, item, { say, done }, rules) {
    bottom.innerHTML = item.tiles.map((t) => `<button class="tile" aria-pressed="false">${esc(t)}</button>`).join('');
    let first = null;
    let slips = 0;
    let left = item.tiles.length;
    for (const b of bottom.children) {
      b.addEventListener('click', () => {
        if (!first || first === b) {
          first = first === b ? null : b;
          b.setAttribute('aria-pressed', first === b);
          return;
        }
        const a = first;
        first = null;
        a.setAttribute('aria-pressed', 'false');
        if (!rules.together(item, a.textContent, b.textContent)) {
          slips++;
          shake(a); shake(b);
          say("Those two don't go together. Try another pair.", 'think');
          return;
        }
        for (const t of [a, b]) { t.disabled = true; t.classList.add('gone'); pop(t); }
        left -= 2;
        play('tap');
        if (!left) return done(slips === 0, rules.explain(item));
        say(`${left / 2} pair${left === 2 ? '' : 's'} to go.`, 'think');
      });
    }
    say(item.prompt, 'think');
  },
};
