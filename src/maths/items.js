import { clears, tick } from '../play/items.js';

/**
 * Maths items: the general types in src/play/items.js (teach, pick, tiles, line, pairs), plus
 *   show     what is written big above the answer: "38 + 5"
 *   sum      what is worked out, when it isn't `show` ("10 - 7" for "How many more make 10?")
 *   picture  { frame: n } n dots in a ten frame; { bar: [n, d] } n of d parts shaded;
 *            { grid: n } n of 100 squares shaded; { bars: [[n, d], ...] } bars one above another
 *   make     for pairs: two tiles go together when they add up to this. Without it, when they are
 *            worth the same (50% and 1/2)
 *   goal     'biggest': for pick, the biggest option is the answer
 *
 * Every answer is worked out from the sum or the picture, never stored, so a typo in the course
 * can't make a right answer wrong; and any way of writing the right value is right (2/4 for 1/2).
 */

/** The value of a sum as written: numbers, + - × ÷ and brackets, "a/b", "n%" and "of" (25% of 80). */
export function value(text) {
  const js = String(text).replace(/\$/g, '').replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)').replace(/\bof\b/g, '*');
  if (!/^[\d\s.+\-*/()]+$/.test(js)) throw new Error(`not a sum: ${text}`);
  const v = Function(`"use strict"; return (${js});`)();
  if (!Number.isFinite(v)) throw new Error(`not a number: ${text}`);
  return v;
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

/** What a picture shows, as a number. */
export function pictured(p) {
  if (p.frame != null) return p.frame;
  if (p.bar) return p.bar[0] / p.bar[1];
  if (p.grid != null) return p.grid / 100;
  return null;
}

/** The number an item asks for. */
export function target(item) {
  if (item.goal === 'biggest') return Math.max(...item.options.map(value));
  const sum = item.sum ?? item.show;
  return sum != null ? value(sum) : pictured(item.picture);
}

/** The answer as tiles spell it: a shaded bar is "2/5", anything else the number ("4.5"). */
export const answer = (item) => (item.sum ?? item.show) == null && item.picture?.bar
  ? `${item.picture.bar[0]}/${item.picture.bar[1]}` : String(+target(item).toFixed(6));

/** Whether an option (text) or a point on the line (a number) is the right value. */
export const right = (item, v) => near(typeof v === 'number' ? v : value(v), target(item));

/** Whether two pairs tiles go together. */
export const together = (item, a, b) => near(item.make != null ? value(a) + value(b) : value(a), item.make ?? value(b));

/** Why an item can't be shipped, or null. */
export function problem(item) {
  try {
    if (item.type === 'teach') return item.text ? null : 'no text';
    if (!item.prompt) return 'no prompt';
    if (!item.explain) return 'no explanation';
    switch (item.type) {
      case 'pick': {
        const n = item.options?.filter((o) => right(item, o)).length;
        return n === 1 ? null : `${n} options are right`;
      }
      case 'tiles': return /^[\d./]+$/.test(answer(item)) ? null : `tiles can't spell ${answer(item)}`;
      case 'line': {
        if (!Number.isInteger(item.ticks) || item.ticks < 2) return 'no ticks';
        const n = Array.from({ length: item.ticks + 1 }, (_, k) => tick(item, k)).filter((v) => right(item, v)).length;
        return n === 1 ? null : `${n} ticks are right`;
      }
      case 'pairs':
        if (!item.tiles?.length || item.tiles.length % 2) return 'pairs needs an even number of tiles';
        return clears(item.tiles, (a, b) => together(item, a, b)) ? null : "the tiles don't all pair off";
    }
    return 'unknown type';
  } catch (e) {
    return e.message;
  }
}
