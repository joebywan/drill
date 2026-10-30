/**
 * Coding's rules, pure: a tiny grid world, the block programs that walk it, and the item checks.
 *
 * A level is rows of text, top row first: '.' grass, '#' a rock, 'S' where Fennel starts, '*' the
 * flower. A program is a list of blocks:
 *   'up' | 'down' | 'left' | 'right'                  one step that way
 *   { repeat: n, do: [...] }                          the blocks inside, n times
 *   { if: 'rock-right', then: [...], else: [...] }    'rock-<way>': a rock (or the edge) is the next square that way
 * In an item's `program`, `null` is a hole the learner fills by tapping a tile: a number fills a
 * repeat's count, a step fills a block. Holes fill in reading order.
 *
 * Items (`type`):
 *   teach    { text, level?, program? }               a card to read: not marked, not reviewed; a program plays on the level
 *   build    { level, program, tiles, prompt, explain } fill the holes; it runs when the last one is filled
 *   predict  { level, program, prompt, explain }     tap the square where Fennel stops
 * Right is decided by running the program, never by comparing to a stored answer: any filling that
 * reaches the flower is right. `problem()` proves every item can be answered.
 */
export const STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const ARROW = { up: '↑\uFE0E', down: '↓\uFE0E', left: '←\uFE0E', right: '→\uFE0E' }; // text, never emoji
const LIMIT = 200; // steps before a run is cut off; no shipped program comes near it

export const kind = (item) => item.type;

/** The level read into { w, h, start: [x, y], flower: [x, y], rock(x, y) }. Off the grid counts as rock. */
export function parse(level) {
  const rows = level.map((r) => [...r]);
  const find = (c) => {
    const y = rows.findIndex((r) => r.includes(c));
    return y < 0 ? null : [rows[y].indexOf(c), y];
  };
  const w = rows[0].length, h = rows.length;
  const rock = (x, y) => x < 0 || y < 0 || x >= w || y >= h || rows[y][x] === '#';
  return { w, h, rows, start: find('S'), flower: find('*'), rock };
}

/**
 * Runs `program` on `level`. Returns { path, end } where `path` is every square stood on, start
 * first, and `end` is 'flower' (reached it: the run stops there), 'bump' (the next step hit a rock
 * or the edge; `path` stops before it, `bumped` is where it tried to go) or 'short' (the blocks
 * ran out somewhere else).
 */
export function run(level, program) {
  const g = parse(level);
  let [x, y] = g.start;
  const path = [[x, y]];
  const stop = (end, extra) => ({ path, end, ...extra });
  let n = 0;
  let result = null;
  const exec = (list) => {
    for (const b of list) {
      if (result) return;
      if (typeof b === 'string') {
        const [dx, dy] = STEPS[b];
        if (g.rock(x + dx, y + dy) || ++n > LIMIT) { result = stop('bump', { bumped: [x + dx, y + dy] }); return; }
        x += dx; y += dy;
        path.push([x, y]);
        if (x === g.flower[0] && y === g.flower[1]) { result = stop('flower'); return; }
      } else if ('repeat' in b) {
        for (let i = 0; i < b.repeat && !result; i++) exec(b.do);
      } else {
        const [dx, dy] = STEPS[b.if.replace('rock-', '')];
        exec(g.rock(x + dx, y + dy) ? b.then : b.else);
      }
    }
  };
  exec(program);
  return result || stop('short');
}

/** Each hole's kind, in filling order: 'count' (a repeat's number) or 'step' (a block). */
export function holes(program) {
  const out = [];
  const walk = (list) => {
    for (const b of list) {
      if (b === null) out.push('step');
      else if (typeof b === 'object' && 'repeat' in b) { if (b.repeat === null) out.push('count'); walk(b.do); }
      else if (typeof b === 'object') { walk(b.then); walk(b.else); }
    }
  };
  walk(program);
  return out;
}

export const tileKind = (tile) => (typeof tile === 'number' ? 'count' : 'step');

/** `program` with its holes filled from `picks`, in order; a hole with no pick stays null. */
export function fill(program, picks) {
  let i = 0;
  const next = () => (i < picks.length ? picks[i++] : (i++, null));
  const walk = (list) => list.map((b) => {
    if (b === null) return next();
    if (typeof b !== 'object') return b;
    if ('repeat' in b) { const repeat = b.repeat === null ? next() : b.repeat; return { repeat, do: walk(b.do) }; }
    return { if: b.if, then: walk(b.then), else: walk(b.else) };
  });
  return walk(program);
}

/** Every way to fill the holes from the item's tiles, in order (tiles of the hole's kind only). */
function* fillings(item) {
  const kinds = holes(item.program);
  const pick = (k) => item.tiles.filter((t) => tileKind(t) === k);
  const go = function* (i, acc) {
    if (i === kinds.length) { yield acc; return; }
    for (const t of pick(kinds[i])) yield* go(i + 1, [...acc, t]);
  };
  yield* go(0, []);
}

/** Whether these picks make a build item's program reach the flower. */
export const reaches = (item, picks) => run(item.level, fill(item.program, picks)).end === 'flower';

/** One filling that works (the shortest-running), for "here's one way"; null if none does. */
export function solve(item) {
  let best = null;
  for (const picks of fillings(item)) {
    const r = run(item.level, fill(item.program, picks));
    if (r.end === 'flower' && (!best || r.path.length < best.len)) best = { picks, len: r.path.length };
  }
  return best?.picks ?? null;
}

/** Where a predict item's program stops: the square to tap, worked out by running it. */
export const answer = (item) => run(item.level, item.program).path.at(-1);

/** Why an item can't be shipped, or null. Every shipped item passes this (test/coding.test.js). */
export function problem(item) {
  if (!item.id) return 'no id';
  if (item.type === 'teach') return !item.text ? 'teach without text' : item.program && !item.level ? 'teach program needs a level' : null;
  if (!['build', 'predict'].includes(item.type)) return `unknown type ${item.type}`;
  if (!item.prompt || !item.explain) return 'needs a prompt and an explanation';
  const g = parse(item.level);
  if (!g.start || !g.flower) return 'level needs S and *';
  if (item.level.some((r) => r.length !== g.w)) return 'ragged level';
  if (item.type === 'predict') return holes(item.program).length ? 'predict has holes' : null;
  if (!holes(item.program).length) return 'build has no holes';
  if (!solve(item)) return 'no filling reaches the flower';
  let all = true;
  for (const picks of fillings(item)) if (!reaches(item, picks)) { all = false; break; }
  return all ? 'every filling works: nothing to think about' : null;
}


const OPPOSITE = { x: { right: 'left', left: 'right' }, y: { up: 'down', down: 'up', above: 'below', below: 'above', under: 'over', over: 'under', top: 'bottom', bottom: 'top' } };

/** `text` with its directions swapped, keeping capitals: "Right, then up" flipped sideways is "Left, then up". */
function swapWords(text, ...maps) {
  const all = Object.assign({}, ...maps);
  return text?.replace(/\b[A-Za-z]+\b/g, (w) => {
    const to = all[w.toLowerCase()];
    return !to ? w : w[0] === w[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
  });
}

/**
 * The same level flipped (`x` left to right, `y` top to bottom), with its program, tiles and words
 * turned to match: the same idea on a new-looking map, with new answers.
 */
export function mirrored(item, { x = false, y = false }) {
  const maps = [x && OPPOSITE.x, y && OPPOSITE.y].filter(Boolean);
  const turn = (step) => (x && OPPOSITE.x[step]) || (y && OPPOSITE.y[step]) || step;
  const walk = (list) => list?.map((b) => {
    if (typeof b === 'string') return turn(b);
    if (b === null) return null;
    if ('repeat' in b) return { repeat: b.repeat, do: walk(b.do) };
    return { if: `rock-${turn(b.if.replace('rock-', ''))}`, then: walk(b.then), else: walk(b.else) };
  });
  const rows = (y ? [...item.level].reverse() : item.level).map((r) => (x ? [...r].reverse().join('') : r));
  return {
    ...item,
    level: rows,
    ...(item.program && { program: walk(item.program) }),
    ...(item.tiles && { tiles: item.tiles.map((t) => (typeof t === 'number' ? t : turn(t))) }),
    prompt: swapWords(item.prompt, ...maps),
    explain: swapWords(item.explain, ...maps),
  };
}

const FLIPS = [{ x: true }, { y: true }, { x: true, y: true }];

/** The Coding subject's `vary` (repeat.js): a random flip of a build or predict item's level. */
export function vary(item, random = Math.random) {
  if (!['build', 'predict'].includes(item.type)) return null;
  const flipped = mirrored(item, FLIPS[Math.floor(random() * FLIPS.length)]);
  return problem(flipped) ? item : flipped;
}
