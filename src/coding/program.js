import pool from '../data/coding-variants.json' with { type: 'json' };

/**
 * Coding's rules, pure: a tiny grid world, the block programs that walk it, and the item checks.
 *
 * A level is rows of text, top row first: '.' grass, '#' a rock, 'S' where Fennel starts, '*' a
 * flower, 'o' a square of the shape to draw (the start is always one). What ends a run and makes it
 * right depends on the level:
 *   one flower       reaching it: the run stops there.
 *   several flowers  stepping on one picks it, and the walk goes on until the blocks run out. Right
 *                    if exactly `want` were picked (the item's `want`, else all of them).
 *   a shape ('o')    the walk goes on until the blocks run out. Right if the squares stood on are
 *                    exactly the shape, however they were walked. No flower.
 * A program is a list of blocks:
 *   'up' | 'down' | 'left' | 'right'                  one step that way
 *   { repeat: n, do: [...] }                          the blocks inside, n times (a value, see below)
 *   { if: look, then: [...], else: [...] }            one side or the other
 *   { until: look, do: [...] }                        look first, then the blocks inside, again and again until it holds
 *   { define: 'hop', params?: ['n'], do: [...] }      top level only: names the blocks inside and runs nothing
 *   { call: 'hop', args?: [3] }                       runs them, with `n` holding 3 until they end
 *   { set: 'steps', to: 0 }                           a variable: `steps` holds 0
 *   { change: 'steps', by: 1 }                        adds to it (a variable not yet set is 0)
 *   { each: 'way', in: ['up', 'left'], do: [...] }    a list: the blocks inside once per value, `way` holding it
 *   { go: 'way' }                                     one step the way a variable holds
 * A value is a number or the name of a variable or parameter. A look is:
 *   'rock-<way>'                                      a rock (or the edge) is the next square that way
 *   'flower'                                          standing on a flower (with one flower, never: that ended the run)
 *   { cmp: 'steps', op: '<' | '>' | '=', n: 3 }       a variable against a number
 *   { not: look } | { and: [a, b] } | { or: [a, b] }
 * In an item's `program`, `null` is a hole the learner fills by tapping a tile: a value fills a
 * count, a look fills what an until or if looks for, '<' '>' '=' fills a comparison, and a step,
 * `{ call }`, `{ go }` or `{ change }` fills a block. Holes fill in reading order. A list's values
 * are slots too, but a list hole has no code form, so `view` items don't punch one.
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
const WORK = 20000; // blocks run before a run is cut off: loops that only change values take no steps
const DEPTH = 50; // calls inside calls before a run is cut off: a block that calls itself
const CODE_WIDTH = 38; // characters of code a 360px phone shows on one line

export const kind = (item) => item.type;

const OP_WORDS = { '<': 'is less than', '>': 'is more than', '=': 'equals' };
const callWords = (t) => `${t.call}${t.args ? `(${t.args.join(', ')})` : ''}`;

/**
 * A look written out: the one place the shape of one is read, for tile faces, spoken names, blocks
 * and code. `o` says how each piece reads: { look, op, n, not, and, or }.
 */
export function writeLook(c, o) {
  if (c === null || typeof c === 'string') return o.look(c);
  if ('cmp' in c) return `${c.cmp} ${o.op(c.op)} ${o.n(c.n)}`;
  const bare = (x) => x === null || typeof x === 'string' || 'not' in x || ('cmp' in x && !('not' in c));
  const sub = (x) => (bare(x) ? writeLook(x, o) : `(${writeLook(x, o)})`);
  if ('not' in c) return `${o.not}${sub(c.not)}`;
  return (c.and ?? c.or).map(sub).join(c.and ? o.and : o.or);
}
const LOOK_WORDS = { look: (l) => l.replace('rock-', 'rock '), op: (x) => x, n: String, not: 'not ', and: ' and ', or: ' or ' };

/** What a screen reader hears for a tile, a filled hole or a block. */
export const tileName = (t) => (typeof t === 'number' ? `Number ${t}`
  : t.call ? `Block ${callWords(t)}`
  : t.go ? `Step the way ${t.go} says`
  : t.change ? `Change ${t.change} by ${t.by}`
  : tileKind(t) === 'look' ? `Look for ${writeLook(t, LOOK_WORDS)}`
  : tileKind(t) === 'op' ? OP_WORDS[t]
  : tileKind(t) === 'count' ? `Value ${t}` : `Step ${t}`);

/** Every name a program or its tiles hold a value under, first seen first: what the screen shows. */
export function names(...things) {
  const out = new Set();
  JSON.stringify(things, (_, v) => {
    for (const k of ['set', 'change', 'each', 'cmp']) if (typeof v?.[k] === 'string') out.add(v[k]);
    v?.params?.forEach((p) => out.add(p));
    return v;
  });
  return [...out];
}

/** The level read into { w, h, start: [x, y], flower: [x, y], flowers, shape, rock(x, y) }. Off the grid counts as rock. */
export function parse(level) {
  const rows = level.map((r) => [...r]);
  const find = (c) => {
    const y = rows.findIndex((r) => r.includes(c));
    return y < 0 ? null : [rows[y].indexOf(c), y];
  };
  const all = (...cs) => rows.flatMap((r, y) => r.flatMap((c, x) => (cs.includes(c) ? [[x, y]] : [])));
  const w = rows[0].length, h = rows.length;
  const rock = (x, y) => x < 0 || y < 0 || x >= w || y >= h || rows[y][x] === '#';
  const hasShape = rows.some((r) => r.includes('o'));
  return { w, h, rows, start: find('S'), flower: find('*'), flowers: all('*'), shape: hasShape ? all('o', 'S') : null, rock };
}

/**
 * Runs `program` on `level`. Returns { path, end, values } where `path` is every square stood on,
 * start first, `values[i]` is what the variables hold while Fennel is on `path[i]`, and `end` is
 * 'flower' (the flowers were reached: the run stops there if there is only one), 'drawn' (the
 * squares stood on are the shape), 'bump' (the next step hit a rock or the edge; `path` stops before
 * it, `bumped` is where it tried to go), 'short' (the blocks ran out with the goal not met) or
 * 'endless' (it would never finish, so it was stopped). `want` is how many of several flowers to pick.
 */
export function run(level, program, want) {
  const g = parse(level);
  const defs = Object.fromEntries(program.filter((b) => b?.define).map((b) => [b.define, b]));
  let [x, y] = g.start;
  const path = [[x, y]];
  const vars = {};
  const values = [{}];
  const note = () => { values[path.length - 1] = { ...vars }; };
  const stop = (end, extra) => ({ path, values, end, ...extra });
  const onFlower = () => g.flowers.some(([fx, fy]) => fx === x && fy === y);
  const value = (v) => (typeof v === 'number' ? v : vars[v] ?? 0);
  let n = 0, work = 0;
  let result = null;
  const holds = (look) => {
    if (look === 'flower') return onFlower();
    if (typeof look === 'string') {
      const [dx, dy] = STEPS[look.replace('rock-', '')];
      return g.rock(x + dx, y + dy);
    }
    if ('cmp' in look) {
      const a = value(look.cmp);
      return look.op === '<' ? a < look.n : look.op === '>' ? a > look.n : a === look.n;
    }
    if ('not' in look) return !holds(look.not);
    return look.and ? look.and.every(holds) : look.or.some(holds);
  };
  /** Runs `list` with `name` holding `val`, then puts back whatever it held. */
  const withValue = (name, val, list, depth) => {
    const had = vars[name];
    vars[name] = val;
    note();
    exec(list, depth);
    if (had === undefined) delete vars[name]; else vars[name] = had;
  };
  const exec = (list, depth = 0) => {
    for (const b of list) {
      if (result) return;
      if (++work > WORK) { result = stop('endless'); return; } // a loop of nothing but values never takes a step
      if (typeof b === 'string' || 'go' in b) {
        const way = STEPS[typeof b === 'string' ? b : vars[b.go]];
        if (!way) continue;
        const [dx, dy] = way;
        if (++n > LIMIT) { result = stop('endless'); return; }
        if (g.rock(x + dx, y + dy)) { result = stop('bump', { bumped: [x + dx, y + dy] }); return; }
        x += dx; y += dy;
        path.push([x, y]);
        note();
        if (g.flowers.length === 1 && onFlower()) { result = stop('flower'); return; }
      } else if ('repeat' in b) {
        const times = value(b.repeat);
        for (let i = 0; i < times && !result; i++) exec(b.do, depth);
      } else if ('until' in b) {
        // A round depends only on the square and the values it starts from, so seeing both twice never ends.
        const seen = new Set();
        while (!result && !holds(b.until)) {
          const now = `${x},${y},${JSON.stringify(vars)}`;
          if (seen.has(now)) { result = stop('endless'); return; }
          seen.add(now);
          exec(b.do, depth);
        }
      } else if ('if' in b) {
        exec(holds(b.if) ? b.then : b.else, depth);
      } else if ('call' in b) {
        if (depth >= DEPTH) { result = stop('endless'); return; }
        const def = defs[b.call];
        const [param] = def?.params ?? [];
        if (param) withValue(param, value(b.args?.[0]), def.do, depth + 1);
        else exec(def?.do ?? [], depth + 1);
      } else if ('set' in b) {
        vars[b.set] = value(b.to);
        note();
      } else if ('change' in b) {
        vars[b.change] = value(b.change) + value(b.by);
        note();
      } else if ('each' in b) {
        for (const v of b.in) {
          if (result) break;
          withValue(b.each, v, b.do, depth);
        }
      } // a define runs nothing where it stands
    }
  };
  exec(program);
  if (result) return result;
  if (g.shape) {
    const drawn = new Set(path.map(String));
    return stop(drawn.size === g.shape.length && g.shape.every((s) => drawn.has(String(s))) ? 'drawn' : 'short');
  }
  if (g.flowers.length > 1) {
    const picked = new Set(path.map(String));
    const got = g.flowers.filter((f) => picked.has(String(f))).length;
    return stop(got === (want ?? g.flowers.length) ? 'flower' : 'short');
  }
  return stop('short');
}

/** Whether a run met its level's goal. */
export const reached = (result) => result.end === 'flower' || result.end === 'drawn';

/** Runs an item's level with its own goal: `program` if given, else its own. */
export const runItem = (item, program = item.program) => run(item.level, program, item.want);

/**
 * The program with `visit(kind, value)` applied to every slot, in reading order: 'step' (a block,
 * or a hole for one), 'count' (a value: a repeat's number, what a set or change or call is given, a
 * comparison's number), 'look' (what an until or if looks for), 'op' (a comparison's sign).
 * A list's values are steps or counts, whichever the list holds.
 */
export const isStep = (b) => b === null || typeof b === 'string' || 'go' in b || ('call' in b && !b.args);

function lookSlots(c, visit) {
  if (c === null || typeof c === 'string') return visit('look', c);
  if ('cmp' in c) return { ...c, op: visit('op', c.op), n: visit('count', c.n) };
  if ('not' in c) return { not: lookSlots(c.not, visit) };
  const k = c.and ? 'and' : 'or';
  return { [k]: c[k].map((x) => lookSlots(x, visit)) };
}

export const listKind = (b) => (b.in.some((v) => typeof v === 'number') ? 'count' : 'step');

function slots(list, visit) {
  return list.map((b) => {
    if (isStep(b)) return visit('step', b);
    const out = { ...b };
    if ('call' in b) out.args = b.args.map((a) => visit('count', a));
    if ('repeat' in b) out.repeat = visit('count', b.repeat);
    if ('to' in b) out.to = visit('count', b.to);
    if ('by' in b) out.by = visit('count', b.by);
    if ('in' in b) out.in = b.in.map((v) => visit(listKind(b), v));
    for (const k of ['until', 'if']) if (k in b) out[k] = lookSlots(b[k], visit);
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

export function tileKind(tile) {
  if (typeof tile === 'number') return 'count';
  if (typeof tile === 'object') return tile.call || tile.go || tile.change ? 'step' : 'look';
  if (tile === 'flower' || /^rock-/.test(tile)) return 'look';
  if (tile in OP_WORDS) return 'op';
  return tile in STEPS ? 'step' : 'count'; // any other word is the name of a value
}

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

const JS_OP = { '<': '<', '>': '>', '=': '===' };
const JS_LOOK = {
  look: (l) => (l === null ? '___' : l === 'flower' ? 'flower()' : `rock("${l.replace('rock-', '')}")`),
  op: (x) => JS_OP[x] ?? '___', n: (x) => x ?? '___', not: '!', and: ' && ', or: ' || ',
};
const jsLook = (look) => writeLook(look, JS_LOOK);
const jsChange = (b) => (typeof b.by === 'number' && b.by < 0 ? `${b.change} = ${b.change} - ${-b.by};` : `${b.change} = ${b.change} + ${b.by ?? '___'};`);

/** How a tile or filled hole reads as JavaScript. */
export function jsFace(t) {
  if (typeof t === 'object' && t.change) return jsChange(t);
  if (typeof t === 'object' && t.go) return `go(${t.go});`;
  if (typeof t === 'object' && t.call) return `${t.call}(${(t.args ?? []).join(', ')});`;
  const kind = tileKind(t);
  return kind === 'look' ? jsLook(t) : kind === 'op' ? JS_OP[t] : kind === 'count' ? String(t) : `${t}();`;
}

/** The program as JavaScript, the only place code text is made. A hole reads `___`, without its `;`. */
export function toJS(program) {
  const lines = [];
  const declared = new Set();
  const body = (list, depth, loops) => {
    const pad = '  '.repeat(depth);
    const block = (head, inner, nextLoops = loops) => { lines.push(pad + head); body(inner, depth + 1, nextLoops); };
    for (const b of list) {
      if (b === null) lines.push(`${pad}___`);
      else if (isStep(b)) lines.push(pad + jsFace(b));
      else if ('call' in b) lines.push(`${pad}${b.call}(${b.args.map((a) => a ?? '___').join(', ')});`);
      else if ('set' in b) {
        lines.push(`${pad}${declared.has(b.set) ? '' : 'let '}${b.set} = ${b.to ?? '___'};`);
        declared.add(b.set);
      } else if ('change' in b) lines.push(pad + jsChange(b));
      else {
        if ('repeat' in b) {
          const i = 'ijklm'[loops];
          block(`for (let ${i} = 0; ${i} < ${b.repeat ?? '___'}; ${i}++) {`, b.do, loops + 1);
        } else if ('until' in b) block(`while (${jsLook({ not: b.until })}) {`, b.do);
        else if ('define' in b) block(`function ${b.define}(${(b.params ?? []).join(', ')}) {`, b.do);
        else if ('each' in b) {
          lines.push(`${pad}let ${b.each}s = [${b.in.map((v) => (typeof v === 'string' ? `"${v}"` : v ?? '___')).join(', ')}];`);
          block(`for (const ${b.each} of ${b.each}s) {`, b.do);
        } else {
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
export const reaches = (item, picks) => reached(runItem(item, fill(item.program, picks)));

/** One filling that works (the shortest-running), for "here's one way"; null if none does. */
export function solve(item) {
  let best = null;
  for (const picks of fillings(item)) {
    const r = runItem(item, fill(item.program, picks));
    if (reached(r) && (!best || r.path.length < best.len)) best = { picks, len: r.path.length };
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
    const r = runItem(item, changed(item, c));
    if (reached(r) && (!best || r.path.length < best.len)) best = { ...c, len: r.path.length };
  }
  return best && { part: best.part, tile: best.tile };
}

/** Where a predict item's program stops: the square to tap, worked out by running it. */
export const answer = (item) => runItem(item).path.at(-1);

/** Why an item can't be shipped, or null. Every shipped item passes this (test/coding.test.js). */
export function problem(item) {
  if (!item.id) return 'no id';
  if (item.type === 'teach') return !item.text ? 'teach without text' : item.program && !item.level ? 'teach program needs a level' : null;
  if (!['build', 'predict', 'bug'].includes(item.type)) return `unknown type ${item.type}`;
  if (!item.prompt || !item.explain) return 'needs a prompt and an explanation';
  const g = parse(item.level);
  if (!g.start || !(g.flower || g.shape)) return 'level needs S and a flower or a shape';
  if (item.want !== undefined && (g.flowers.length < 2 || item.want > g.flowers.length)) return 'want needs enough flowers';
  if (item.level.some((r) => r.length !== g.w)) return 'ragged level';
  const defs = Object.fromEntries(item.program.filter((b) => b?.define).map((b) => [b.define, b]));
  const calls = [];
  JSON.stringify([item.program, item.tiles], (_, v) => { if (v?.call) calls.push(v); return v; });
  if (calls.some((c) => !defs[c.call])) return 'calls a block nothing defines';
  if (calls.some((c) => (c.args?.length ?? 0) !== (defs[c.call].params?.length ?? 0))) return 'a call gives the wrong number of values';
  if (item.view && (item.type === 'bug' || (item.view === 'both' && holes(item.program).length))) return 'that view cannot show this item';
  if (item.view && toJS(item.program).split('\n').some((l) => l.length > CODE_WIDTH)) return 'a line of code is too wide';
  if (item.type === 'predict') return holes(item.program).length ? 'predict has holes' : null;
  if (item.type === 'bug') {
    if (holes(item.program).length) return 'bug has holes';
    if (reached(runItem(item))) return 'the program it ships already works';
    if (!fixBug(item)) return 'no change reaches the flower';
    return changes(item).every((c) => reached(runItem(item, changed(item, c)))) ? 'every change works: nothing to find' : null;
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
  const turnTile = (t) => {
    if (t === null || typeof t === 'number' || t === 'flower' || t.call || t.go || t.change) return t;
    if (typeof t === 'object') return lookSlots(t, (_, v) => turnTile(v));
    return t.startsWith('rock-') ? `rock-${turn(t.slice(5))}` : turn(t);
  };
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

const ALL_FLIPS = [...FLIPS, {}];
const size = (level) => level.length * level[0].length;
/** The numbers a count item's answer is, or null when nothing it asks for is a number. */
const counts = (item) => {
  if (!holes(item.program).includes('count')) return null;
  return (solve(item) ?? []).filter((v) => typeof v === 'number').join() || null;
};

/**
 * The pool entries an item can play as: its family's, as its own type and view, of a similar size,
 * never itself on a flipped map, and never with the same number to answer when it asks for one.
 */
export function variantsOf(item) {
  const own = counts(item);
  const plain = { id: item.id, type: item.type, family: item.family, ...(item.view && { view: item.view }) };
  const same = (e) => ALL_FLIPS.some((f) => {
    const m = mirrored(e, f);
    return m.level.join() === item.level.join() && JSON.stringify(m.program) === JSON.stringify(item.program);
  });
  return (pool[item.family] ?? []).map((e) => ({ ...plain, ...e })).filter((e) =>
    Math.abs(parts(e.program).length - parts(item.program).length) <= 2
    && size(e.level) <= 2 * size(item.level) + 6
    && !same(e)
    && (own === null || counts(e) !== own));
}

/** The Coding subject's `vary` (repeat.js): a fresh pool entry at a random flip, or a flip of the item itself. */
export function vary(item, random = Math.random) {
  if (item.type === 'teach') return null;
  const fresh = variantsOf(item);
  if (fresh.length) return mirrored(fresh[Math.floor(random() * fresh.length)], ALL_FLIPS[Math.floor(random() * ALL_FLIPS.length)]);
  const flipped = mirrored(item, FLIPS[Math.floor(random() * FLIPS.length)]);
  return problem(flipped) ? item : flipped;
}
