import { mount as quiz } from '../quiz/exercise.js';
import { toQuiz } from './items.js';

/** A ten frame: two rows of five, the first `n` filled. */
const frame = (n) => `<svg class="pic frame" viewBox="0 0 110 46" role="img" aria-label="${n} dots in a frame of 10">
  ${Array.from({ length: 10 }, (_, i) => `<rect x="${2 + (i % 5) * 21.2}" y="${2 + Math.floor(i / 5) * 21}" width="21" height="21" class="cell"/>
  ${i < n ? `<circle cx="${12.5 + (i % 5) * 21.2}" cy="${12.5 + Math.floor(i / 5) * 21}" r="7" class="dot"/>` : ''}`).join('')}</svg>`;

/** A bar cut into `d` equal parts, the first `n` shaded. */
const bar = ([n, d]) => `<svg class="pic bar" viewBox="0 0 204 34" role="img" aria-label="${n} of ${d} equal parts shaded">
  ${Array.from({ length: d }, (_, i) => `<rect x="${2 + (i * 200) / d}" y="2" width="${200 / d}" height="30" class="${i < n ? 'cell on' : 'cell'}"/>`).join('')}</svg>`;

/** A hundred squares, the first `n` shaded. */
const grid = (n) => `<svg class="pic grid" viewBox="0 0 102 102" role="img" aria-label="${n} of 100 squares shaded">
  ${Array.from({ length: 100 }, (_, i) => `<rect x="${1 + (i % 10) * 10}" y="${1 + Math.floor(i / 10) * 10}" width="10" height="10" class="${i < n ? 'cell on' : 'cell'}"/>`).join('')}</svg>`;

/** A maths picture, drawn on the quiz card (numbers only, so nothing to escape). */
export function art(p) {
  if (p.frame != null) return frame(Number(p.frame));
  if (p.bar) return bar(p.bar.map(Number));
  if (p.grid != null) return grid(Number(p.grid));
  if (p.bars) return p.bars.map((b) => bar(b.map(Number))).join('');
  return '';
}

/** The subject's mount (see subjects.js): a maths item, answers worked out, played as a quiz item. */
export const mount = (el, item, ctx) => quiz(el, toQuiz(item), { ...ctx, art, look: 'maths' });
