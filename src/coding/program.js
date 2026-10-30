/**
 * Coding's rules, pure: a tiny grid world, the block programs that walk it, and the item checks.
 *
 * A level is rows of text, top row first: '.' grass, '#' a rock, 'S' where Fennel starts, '*' the
 * flower. A program is a list of blocks:
 *   'up' | 'down' | 'left' | 'right'                  one step that way
 *   { repeat: n, do: [...] }                          the blocks inside, n times
 *   { if: 'rock-right', then: [...], else: [...] }    'rock-<way>': a rock (or the edge) is the next square that way
 *   { until: 'flower' | 'rock-<way>', do: [...] }     look first, then the blocks inside, again and again until it holds
 *   { define: 'hop', do: [...] }                      top level only: names the blocks inside and runs nothing
 *   { call: 'hop' }                                   runs the blocks defined under that name
 * In an item's `program`, `null` is a hole the learner fills by tapping a tile: a number fills a
 * repeat's count, a look ('flower', 'rock-<way>') fills what an until or if looks for, and a step
 * or `{ call }` fills a block. Holes fill in reading order.
 *
 * Items (`type`):
 *   teach    { text, level?, program? }               a card to read: not marked, not reviewed; a program plays on the level
 *   build    { level, program, tiles, prompt, explain } fill the holes; it runs when the last one is filled
 *   predict  { level, program, prompt, explain }     tap the square where Fennel stops
 *   bug      { level, program, tiles, prompt, explain } a whole program that fails: tap a block, then a tile replaces it
 * Teach, build and predict may set `view`: 'js' shows the program as JavaScript (`toJS`), 'both' as
 * blocks and JavaScript (no holes). The code is always generated, never stored.
 * Right is decided by running the program, never by comparing to a stored answer: any filling that
 * reaches the flower is right. `problem()` proves every item can be answered.
 */
export const STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const ARROW = { up: '↑\uFE0E', down: '↓\uFE0E', left: '←\uFE0E', right: '→\uFE0E' }; // text, never emoji
const LIMIT = 200; // steps before a run is cut off; no shipped program comes near it
const DEPTH = 50; // calls inside calls before a run is cut off: a block that calls itself
const CODE_WIDTH = 38; // characters of code a 360px phone shows on one line

export const kind = (item) => item.type;

/** What a screen reader hears for a tile, a filled hole or a block. */
export const tileName = (t) => (typeof t === 'number' ? `${t} times`
  : t.call ? `Block ${t.call}`
  : tileKind(t) === 'look' ? `Look for ${t.replace('rock-', 'rock ')}` : `Step ${t}`);

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
 * or the edge; `path` stops before it, `bumped` is where it tried to go), 'short' (the blocks ran
 * out somewhere else) or 'endless' (it would never finish, so it was stopped).
 */
export function run(level, program) {
  const g = parse(level);
  const defs = Object.fromEntries(program.filter((b) => b?.define).map((b) => [b.define, b.do]));
  let [x, y] = g.start;
  const path = [[x, y]];
  const stop = (end, extra) => ({ path, end, ...extra });
  let n = 0;
  let result = null;
  // The flower is never true here: reaching it has already ended the run.
  const holds = (look) => {
    if (look === 'flower') return false;
    const [dx, dy] = STEPS[look.replace('rock-', '')];
    return g.rock(x + dx, y + dy);
  };
  const exec = (list, depth = 0) => {
    for (const b of list) {
      if (result) return;
      if (typeof b === 'string') {
        const [dx, dy] = STEPS[b];
        if (++n > LIMIT) { result = stop('endless'); return; }
        if (g.rock(x + dx, y + dy)) { result = stop('bump', { bumped: [x + dx, y + dy] }); return; }
        x += dx; y += dy;
        path.push([x, y]);
        if (x === g.flower[0] && y === g.flower[1]) { result = stop('flower'); return; }
      } else if ('repeat' in b) {
        for (let i = 0; i < b.repeat && !result; i++) exec(b.do, depth);
      } else if ('until' in b) {
        // A round depends only on the square it starts from, so a square seen twice never ends.
        const seen = new Set();
        while (!result && !holds(b.until)) {
          if (seen.has(`${x},${y}`)) { result = stop('endless'); return; }
          seen.add(`${x},${y}`);
          exec(b.do, depth);
        }
      } else if ('if' in b) {
        exec(holds(b.if) ? b.then : b.else, depth);
      } else if ('call' in b) {
        if (depth >= DEPTH) { result = stop('endless'); return; }
        exec(defs[b.call] ?? [], depth + 1);
      } // a define runs nothing where it stands
    }
  };
  exec(program);
  return result || stop('short');
}

/**
 * The program with `visit(kind, value)` applied to every slot, in reading order: 'step' (a block,
 * or a hole for one), 'count' (a repeat's number), 'look' (what an until or if looks for).
 */
function slots(list, visit) {
  return list.map((b) => {
    if (b === null || typeof b === 'string' || 'call' in b) return visit('step', b);
    const out = { ...b };
    if ('repeat' in b) out.repeat = visit('count', b.repeat);
    for (const k of ['until', 'if']) if (k in b) out[k] = visit('look', b[k]);
    for (const k of ['do', 'then', 'else']) if (k in b) out[k] = slots(b[k], visit);
    return out;
  });
}

/** Every slot of `program`, in reading order: [{ kind, value }]. */
export function parts(program) {
  const out = [];
  slots(program, (kind, value) => { out.push({ kind, value }); return value; });
  return out;
}

/** Each hole's kind, in filling order. */
export const holes = (program) => parts(program).filter((p) => p.value === null).map((p) => p.kind);

export const tileKind = (tile) => (typeof tile === 'number' ? 'count' : tile === 'flower' || /^rock-/.test(tile) ? 'look' : 'step');

/** `program` with its holes filled from `picks`, in order; a hole with no pick stays null. */
export function fill(program, picks) {
  let i = 0;
  return slots(program, (_, v) => {
    if (v !== null) return v;
    const pick = i < picks.length ? picks[i] : null;
    i++;
    return pick;
  });
}

/** `program` with its `n`th slot (counting every slot, as `parts` does) made a hole. */
export function punch(program, n) {
  let i = 0;
  return slots(program, (_, v) => (i++ === n ? null : v));
}

const jsLook = (look) => (look === null ? '___' : look === 'flower' ? 'flower()' : `rock("${look.replace('rock-', '')}")`);

/** How a tile or filled hole reads as JavaScript. */
export const jsFace = (t) => (typeof t === 'number' ? String(t) : tileKind(t) === 'look' ? jsLook(t) : `${t.call ?? t}();`);

/** The program as JavaScript, the only place code text is made. A hole reads `___`, without its `;`. */
export function toJS(program) {
  const lines = [];
  const body = (list, depth, loops) => {
    const pad = '  '.repeat(depth);
    const block = (head, inner, nextLoops = loops) => { lines.push(pad + head); body(inner, depth + 1, nextLoops); };
    for (const b of list) {
      if (b === null) lines.push(`${pad}___`);
      else if (typeof b === 'string' || 'call' in b) lines.push(pad + jsFace(b));
      else {
        if ('repeat' in b) {
          const i = 'ijklm'[loops];
          block(`for (let ${i} = 0; ${i} < ${b.repeat ?? '___'}; ${i}++) {`, b.do, loops + 1);
        } else if ('until' in b) block(`while (!${jsLook(b.until)}) {`, b.do);
        else if ('define' in b) block(`function ${b.define}() {`, b.do);
        else {
          block(`if (${jsLook(b.if)}) {`, b.then);
          if (b.else.length) { lines.push(`${pad}} else {`); body(b.else, depth + 1, loops); }
        }
        lines.push(`${pad}}`);
      }
    }
  };
  body(program, 0, 0);
  return lines.join('\n');
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

/** Every one-block change a bug item's tiles allow: [{ part, tile }]. */
const changes = (item) => parts(item.program).flatMap(({ kind }, part) => item.tiles.filter((t) => tileKind(t) === kind).map((tile) => ({ part, tile })));

/** A bug item's program with one block changed. */
export const changed = (item, { part, tile }) => fill(punch(item.program, part), [tile]);

/** One change that makes a bug item reach the flower (the shortest-running), or null. */
export function fixBug(item) {
  let best = null;
  for (const c of changes(item)) {
    const r = run(item.level, changed(item, c));
    if (r.end === 'flower' && (!best || r.path.length < best.len)) best = { ...c, len: r.path.length };
  }
  return best && { part: best.part, tile: best.tile };
}

/** Where a predict item's program stops: the square to tap, worked out by running it. */
export const answer = (item) => run(item.level, item.program).path.at(-1);

/** Why an item can't be shipped, or null. Every shipped item passes this (test/coding.test.js). */
export function problem(item) {
  if (!item.id) return 'no id';
  if (item.type === 'teach') return !item.text ? 'teach without text' : item.program && !item.level ? 'teach program needs a level' : null;
  if (!['build', 'predict', 'bug'].includes(item.type)) return `unknown type ${item.type}`;
  if (!item.prompt || !item.explain) return 'needs a prompt and an explanation';
  const g = parse(item.level);
  if (!g.start || !g.flower) return 'level needs S and *';
  if (item.level.some((r) => r.length !== g.w)) return 'ragged level';
  const named = item.program.filter((b) => b?.define).map((b) => b.define);
  const calls = [...parts(item.program).map((p) => p.value), ...(item.tiles ?? [])].filter((b) => b?.call);
  if (calls.some((c) => !named.includes(c.call))) return 'calls a block nothing defines';
  if (item.view && (item.type === 'bug' || (item.view === 'both' && holes(item.program).length))) return 'that view cannot show this item';
  if (item.view && toJS(item.program).split('\n').some((l) => l.length > CODE_WIDTH)) return 'a line of code is too wide';
  if (item.type === 'predict') return holes(item.program).length ? 'predict has holes' : null;
  if (item.type === 'bug') {
    if (holes(item.program).length) return 'bug has holes';
    if (run(item.level, item.program).end === 'flower') return 'the program it ships already works';
    if (!fixBug(item)) return 'no change reaches the flower';
    return changes(item).every((c) => run(item.level, changed(item, c)).end === 'flower') ? 'every change works: nothing to find' : null;
  }
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
  const turnTile = (t) => (t === null || typeof t === 'number' || t === 'flower' || t.call ? t : t.startsWith('rock-') ? `rock-${turn(t.slice(5))}` : turn(t));
  const rows = (y ? [...item.level].reverse() : item.level).map((r) => (x ? [...r].reverse().join('') : r));
  return {
    ...item,
    level: rows,
    ...(item.program && { program: slots(item.program, (_, v) => turnTile(v)) }),
    ...(item.tiles && { tiles: item.tiles.map(turnTile) }),
    prompt: swapWords(item.prompt, ...maps),
    explain: swapWords(item.explain, ...maps),
  };
}

const FLIPS = [{ x: true }, { y: true }, { x: true, y: true }];

/** The Coding subject's `vary` (repeat.js): a random flip of a marked item's level. */
export function vary(item, random = Math.random) {
  if (item.type === 'teach') return null;
  const flipped = mirrored(item, FLIPS[Math.floor(random() * FLIPS.length)]);
  return problem(flipped) ? item : flipped;
}
