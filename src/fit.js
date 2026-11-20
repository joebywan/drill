import { reducedMotion } from './cast/kit.js';

/**
 * Fitting a screen on a phone: a program for Coding (src/coding/exercise.js) and the code courses (src/code/exercise.js),
 * a card for the quiz items (src/quiz/exercise.js). Fit first (the coach, the gaps, a map or pictures give room), then
 * it scrolls in its own box, never the page, and once answered the verdict covers neither its end nor the part that matters.
 */

/**
 * How tall the runner's verdict banner will be with `words` in it (null: a teach card's, Continue alone) under the
 * longest verdict the coach's `lines` could give, by measuring a hidden copy, so a tall program can be fitted above
 * it before it comes. 0 with no banner on the page.
 */
export function verdictHeight(words, lines = {}) {
  const foot = document.querySelector('.foot');
  if (!foot) return 0;
  const copy = foot.cloneNode(true);
  copy.className = `foot show${words === null ? ' plain' : ''}`;
  copy.style.visibility = 'hidden';
  copy.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
  copy.querySelector('strong').textContent = ['correct', 'run3', 'run5', 'wrong'].flatMap((k) => lines[k] ?? []).reduce((a, b) => (b.length > a.length ? b : a), 'x');
  copy.querySelector('p').textContent = words ?? '';
  foot.after(copy);
  const height = copy.offsetHeight;
  copy.remove();
  return height;
}

/** Scrolls `box` (never the page) so `el` in it shows: smoothly, unless motion is reduced. */
export function keepInView(box, el) {
  if (!el || box.scrollHeight <= box.clientHeight) return;
  const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
  const by = r.top < b.top ? r.top - b.top - 6 : r.bottom > b.bottom ? Math.min(r.bottom - b.bottom + 6, r.top - b.top - 6) : 0;
  if (by) box.scrollBy({ top: by, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/**
 * Makes `el` a box that scrolls in itself (`.scrolls`) and shows when there is more of it above or below: it is
 * marked `more-above` / `more-below`, kept right as it scrolls, changes size or is redrawn, and styles.css draws a
 * plain gradient over that edge in the box's `--fade` colour. Plain DOM and CSS, so every browser shows it; not a
 * mask, which crashed the emulator's software renderer. Returns `el`.
 */
export function scrollBox(el) {
  el.classList.add('scrolls');
  if (el.edges) return el;
  el.edges = true;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; // the gradients sit on its edges
  const mark = () => {
    el.style.setProperty('--scrolled', `${el.scrollTop}px`);
    el.classList.toggle('more-above', el.scrollTop > 1);
    el.classList.toggle('more-below', el.scrollHeight - el.clientHeight - el.scrollTop > 1);
  };
  el.addEventListener('scroll', mark, { passive: true });
  new ResizeObserver(mark).observe(el);
  new MutationObserver(mark).observe(el, { childList: true, subtree: true, characterData: true });
  mark();
  return el;
}

/** Where `el`'s top is on the page (as if scrolled to the top, where a lesson is seen). */
export const topOf = (el) => el.getBoundingClientRect().top + scrollY;

/**
 * Past `bottom` (a y on the page) `el` scrolls in its own box (`scrollBox`), if it is taller than that; a box
 * only ever shrinks. With `always`, the box ends at `bottom` whatever `el` holds now or was before (an answer that grows).
 */
export function boxTo(el, bottom, always = false) {
  const room = Math.floor(bottom - topOf(el) - 8);
  if (!always && (el.scrollHeight <= room + 1 || room >= parseFloat(el.style.maxHeight))) return;
  el.style.maxHeight = `${room}px`;
  scrollBox(el);
}

/** The tallest height up to `limit` that ends on a whole row of `el`'s children (measured from its content's top). */
export function wholeRows(el, limit) {
  const top = el.getBoundingClientRect().top - el.scrollTop + parseFloat(getComputedStyle(el).paddingTop);
  const ends = [...el.children].map((c) => c.getBoundingClientRect().bottom - top).filter((b) => b <= limit);
  return Math.max(0, ...ends);
}

const SQUARE = 28, PICK_SQUARE = 36; // the smallest a map's squares get for a tall program: Fennel stays easy to see, a square to tap thumb-sized

/**
 * Fits `program` (an element) between what is above it and `tray` (fixed at the bottom; none: the screen's bottom).
 * `world` and `g` are a map and its level (parse() in src/coding/program.js), if there is one; `lines` the coach's.
 * Returns:
 *   fit(words)   a program too tall for the space above the tray and above the verdict to come (`words` long)
 *                first gets the room the coach and the gaps can give (`.tall`), then the map's. If even that can't fit
 *                it above the verdict (a short phone), the map gives only what fits it above the tray, so it reads
 *                whole while asked, and its box shrinks when the verdict comes. What can't fit scrolls in its own box.
 *                A program that fits is left as it is.
 *   settle(el, always)  once answered: the program's box ends above the verdict as it really came (`boxTo`), with `el` in view
 *   keep(el)     scrolls the program's box to `el`
 */
export function fitter({ program, tray, world = null, g = null, lines }) {
  const trayTop = () => (tray?.isConnected && tray.children.length ? tray.getBoundingClientRect().top : innerHeight);
  const fit = (words) => {
    const verdict = Math.min(trayTop(), innerHeight - verdictHeight(words, lines));
    const over = (bottom) => program.scrollHeight - (bottom - topOf(program) - 8);
    if (over(verdict) <= 0) return;
    program.classList.add('tall');
    const map = !!world?.isConnected;
    const high = map ? world.getBoundingClientRect().height : 0;
    const least = map ? g.h * (world.classList.contains('picking') ? PICK_SQUARE : SQUARE) : 0;
    const bottom = over(verdict) <= high - least ? verdict : trayTop();
    const fits = Math.max(least, high - over(bottom) - 4); // 4: the squares round to whole pixels
    if (map && fits < high) world.style.width = `${(fits * g.w) / g.h}px`;
    boxTo(program, bottom);
  };
  const keep = (el) => keepInView(program, el);
  const settle = (el, always = false) => {
    const foot = document.querySelector('.foot.show');
    if (foot) boxTo(program, innerHeight - foot.offsetHeight, always);
    keep(el);
  };
  return { fit, settle, keep };
}

/**
 * Fits a quiz card above whatever will cover the bottom of the screen: the answer tray while asked, the verdict
 * once answered (the same rule as Coding's `fit()`: fit first, never let the page scroll under a fixed bar). A card
 * that fits is left alone. Otherwise, in turn: the card gives up its spare room (`tight`), the coach shrinks
 * (`tall`), slots and the sentence above them shrink (`tighter`), pictures shrink, and last the card scrolls in its own box. A build's slots are measured full, as they
 * will be once answered.
 */
export function fitCard(quiz, item, coach) {
  const card = quiz.querySelector('.card');
  const tray = quiz.querySelector('.choices');
  if (!card) { // a pairs item without a picture has none: if its pairs reach her words, she gives way, then they do
    const bubble = document.querySelector('.play .bubble');
    if (!tray || !bubble) return;
    const over = () => bubble.getBoundingClientRect().bottom - tray.getBoundingClientRect().top;
    for (const c of ['tall', 'tighter']) { if (over() <= 0) break; quiz.classList.add(c); }
    // Whatever the font does to the labels, the last of it scrolls in the tray's own box.
    if (over() > 0) { tray.style.maxHeight = `${Math.floor(tray.getBoundingClientRect().height - over())}px`; scrollBox(tray); }
    return;
  }
  const slots = [...card.querySelectorAll('.slot')];
  const was = slots.map((s) => s.textContent);
  slots.forEach((s, i) => { s.textContent = item.answer[i]; });
  const limit = () => Math.min(tray?.children.length ? tray.getBoundingClientRect().top + scrollY : innerHeight,
    innerHeight - verdictHeight(item.type === 'teach' ? null : item.explain, coach?.lines));
  const over = () => card.getBoundingClientRect().bottom + scrollY - limit() + 8;
  if (over() > 0) {
    for (const c of ['tight', 'tall', 'tighter']) { quiz.classList.add(c); if (over() <= 0) break; }
    const pics = [...card.querySelectorAll('.pic')];
    if (over() > 0 && pics.length) {
      const high = pics.reduce((n, p) => n + p.getBoundingClientRect().height, 0);
      const k = Math.max(0.45, (high - over()) / high);
      for (const p of pics) p.style.maxWidth = `${Math.floor(p.getBoundingClientRect().width * k)}px`;
    }
    if (over() > 0) { card.style.maxHeight = `${Math.floor(card.getBoundingClientRect().height - over())}px`; scrollBox(card); }
  }
  slots.forEach((s, i) => { s.textContent = was[i]; });
}
