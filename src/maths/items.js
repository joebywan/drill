import { problem as quizProblem, shuffle } from '../quiz/items.js';
import pool from '../data/maths-variants.json' with { type: 'json' };

/**
 * Maths items are written as sums and pictures, then played as the general items in src/quiz/
 * (teach, pick, build, line, pairs) through `toQuiz()`, which works out each answer. Fields:
 *   show     what is written big above the answer: "38 + 5"
 *   sum      what is worked out, when it isn't `show` ("10 - 7" for "How many more make 10?")
 *   picture  { frame: n } n dots in a ten frame; { bar: [n, d] } n of d parts shaded;
 *            { grid: n } n of 100 squares shaded; { bars: [[n, d], ...] } bars one above another;
 *            { line: [min, max, hops] } a number line to look at, on a teach card
 *   tiles    for pairs: the numbers to pair off, in any order
 *   extra    for build: decoy tiles (default: two digits not in the answer)
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

/** A way to pair off every tile by `together`, as [[a, b], ...], or null. Tiny: a handful of tiles. */
export function pairing(tiles, fits) {
  if (!tiles.length) return [];
  const [first, ...rest] = tiles;
  for (const [i, t] of rest.entries()) {
    if (!fits(first, t)) continue;
    const others = pairing(rest.filter((_, j) => j !== i), fits);
    if (others) return [[first, t], ...others];
  }
  return null;
}

/** A small number the same for the same text, for decoys that don't change between visits. */
const seed = (text) => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);

/**
 * The quiz item a maths item plays as, with every answer worked out here: the right option, the
 * tiles in order (decoys are digits not in the answer), the tick the line wants, the pairs.
 */
export function toQuiz(item) {
  switch (item.type) {
    case 'pick': return { ...item, answer: item.options.find((o) => right(item, o)) };
    case 'build': {
      const want = [...answer(item)];
      const free = [...'0123456789'].filter((d) => !want.includes(d));
      const n = seed(item.id);
      const extra = item.extra ? [...item.extra] : [free[n % free.length], free[(n + 3) % free.length]];
      return { ...item, show: item.show ?? '', answer: want, tiles: [...new Set(extra)] };
    }
    case 'line': return { ...item, answer: target(item) };
    case 'pairs': {
      const pairs = pairing(item.tiles, (a, b) => together(item, a, b)) || [];
      return { ...item, pairs: pairs.map((p) => shuffle(p, () => (seed(p.join()) % 2 ? 0.9 : 0.1))) };
    }
    default: return item;
  }
}

/** Why an item can't be shipped, or null: the maths checks, then the quiz item it plays as. */
export function problem(item) {
  try {
    if (item.type === 'teach') return quizProblem(item);
    if (!item.prompt) return 'no prompt';
    if (!item.explain) return 'no explanation';
    switch (item.type) {
      case 'pick': {
        const n = item.options?.filter((o) => right(item, o)).length;
        if (n !== 1) return `${n} options are right`;
        break;
      }
      case 'build': if (!/^[\d./]+$/.test(answer(item))) return `tiles can't spell ${answer(item)}`; break;
      case 'pairs':
        if (!item.tiles?.length || item.tiles.length % 2) return 'pairs needs an even number of tiles';
        if (!pairing(item.tiles, (a, b) => together(item, a, b))) return "the tiles don't all pair off";
        break;
    }
    return quizProblem(toQuiz(item));
  } catch (e) {
    return e.message;
  }
}

/** What an item comes to: a value, or for pairs the tiles to clear. */
const outcome = (item) => (item.type === 'pairs' ? [...item.tiles].sort().join() : String(target(item)));

/** The pool entries an item can play as: its family's, as its own type, with a different answer. */
export const variantsOf = (item) => (pool[item.family] ?? [])
  .map((e) => ({ id: item.id, type: item.type, family: item.family, ...e }))
  .filter((e) => outcome(e) !== outcome(item));

/** The Maths subject's `vary` (repeat.js): fresh numbers, or the item as written if it has no family. */
export function vary(item, random = Math.random) {
  const fresh = item.type === 'teach' ? [] : variantsOf(item);
  return fresh.length ? fresh[Math.floor(random() * fresh.length)] : item;
}
