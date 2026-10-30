/**
 * Writes the fresh versions a repeat plays: src/data/coding-variants.json and maths-variants.json,
 * { family: [entry, ...] }. An item names its family (`family` in the course file); `vary` picks an
 * entry and it keeps the item's id, so its review card stays the same. Run by hand, `npm run variants`,
 * and commit the result. Each family has its own fixed seed, so the same code writes the same bytes
 * (test/variants.test.js checks) and adding a family leaves the others alone.
 *
 * Numbers in the words are worked out from what was generated: a Coding explanation ends in `story()`,
 * told from running the program. Prompts say "rounds", not "repeat", because the same entries also
 * play as JavaScript.
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { STEPS, fill, holes, parse, parts, problem as codingProblem, run, solve } from '../src/coding/program.js';
import { problem as mathsProblem } from '../src/maths/items.js';

const MAX = 8; // entries in a family: past this a repeat gains little and the pool gets heavy

const seeded = (name) => {
  let s = [...name].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffled = (list, r) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const one = (r, list) => list[Math.floor(r() * list.length)];
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const product = (...lists) => lists.reduce((all, l) => all.flatMap((a) => l.map((v) => [...a, v])), [[]]);

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const say = (n) => WORDS[n] ?? String(n);
const Cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---- Coding: drawing levels ----

const OPP = { right: 'left', left: 'right', up: 'down', down: 'up' };
const WHERE = { right: 'to my right', left: 'to my left', up: 'above me', down: 'below me' };
/** Pairs of ways to walk: a flip gives the other corners, so these only need the two shapes. */
const CORNERS = [['right', 'down'], ['down', 'right']];
const line = (d, n) => Array(n).fill(d);
const segs = (...s) => s.flatMap((v, i) => (i % 2 ? [] : line(v, s[i + 1])));
const walkOf = (moves, from = [0, 0]) => moves.reduce((p, m) => {
  const [x, y] = p.at(-1);
  return [...p, [x + STEPS[m][0], y + STEPS[m][1]]];
}, [from]);

/**
 * A level drawn around a walk: S where it starts, the flower where it ends. `fill` is what the rest
 * is ('#' makes a corridor), `rocks` are squares relative to the start, `pad` extends it [left, top,
 * right, bottom], `paint` makes the walk a shape to draw instead.
 */
function map(moves, { fill: ground = '.', rocks = [], pad = [0, 0, 0, 0], paint = false, flowers = null } = {}) {
  const path = walkOf(moves);
  const all = [...path, ...rocks];
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const left = Math.min(...xs) - pad[0], top = Math.min(...ys) - pad[1];
  const w = Math.max(...xs) + pad[2] - left + 1, h = Math.max(...ys) + pad[3] - top + 1;
  const rows = Array.from({ length: h }, () => Array(w).fill(ground));
  const put = ([x, y], c) => { rows[y - top][x - left] = c; };
  path.forEach((p) => put(p, paint ? 'o' : '.'));
  rocks.forEach((p) => put(p, '#'));
  if (!paint) (flowers ?? [path.at(-1)]).forEach((p) => put(p, '*'));
  put(path[0], 'S');
  return rows.map((r) => r.join(''));
}

/** A random open field with a few rocks, S and a flower: for reading a program on. */
function field(r, { w = int(r, 3, 5), h = int(r, 2, 4), rocks = 0, start = null } = {}) {
  const rows = Array.from({ length: h }, () => Array(w).fill('.'));
  const free = shuffled(product(range(0, w - 1), range(0, h - 1)), r);
  const [sx, sy] = start ?? free[0];
  rows[sy][sx] = 'S';
  const rest = free.filter(([x, y]) => x !== sx || y !== sy);
  rows[rest[0][1]][rest[0][0]] = '*';
  rest.slice(1, rocks + 1).forEach(([x, y]) => { rows[y][x] = '#'; });
  return rows.map((row) => row.join(''));
}

/** What a run did, in words, from the run itself: the one place explanations get their numbers. */
export function story(level, program, want) {
  const r = run(level, program, want);
  const parts = [];
  r.path.slice(1).forEach(([x, y], i) => {
    const [px, py] = r.path[i];
    const d = Object.keys(STEPS).find((k) => STEPS[k][0] === x - px && STEPS[k][1] === y - py);
    if (parts.at(-1)?.[0] === d) parts.at(-1)[1]++;
    else parts.push([d, 1]);
  });
  const walked = parts.length ? `${Cap(parts.map(([d, n]) => `${say(n)} ${d}`).join(', '))}.` : "I don't take a step.";
  if (r.end === 'bump') {
    const g = parse(level);
    const [x, y] = r.bumped;
    const edge = x < 0 || y < 0 || x >= g.w || y >= g.h;
    return `${walked} The next step hits ${edge ? 'the edge' : 'a rock'}, so I stop there.`;
  }
  if (r.end === 'endless') return `${walked} I'm back on a square I looked from, so that loop never ends and I stop it.`;
  if (r.end === 'drawn') return `${walked} Every faint square gets painted.`;
  if (r.end === 'flower') return `${walked} ${parse(level).flowers.length > 1 ? 'That picks the flowers I was after.' : 'That lands on the flower.'}`;
  return `${walked} The blocks run out there.`;
}

const upTo = (n) => [n - 2, n - 1, n].filter((v) => v >= 1);
const near = (n) => [n - 1, n, n + 1].filter((v) => v >= 1);
const HOP = (d = 'right') => ({ define: 'hop', params: ['n'], do: [{ repeat: 'n', do: [d] }] });
const STAIRS = (a, b) => ({ define: 'stairs', params: ['n'], do: [{ repeat: 'n', do: [a, b] }] });
const GROW = (a, b) => ({ define: 'grow', params: ['n'], do: [{ repeat: 'n', do: [a] }, { repeat: 'n', do: [b] }] });

/** a then b, k times. A rock sits where b-first would go, so the order matters. */
function stairs(k, a, b, extra = {}) {
  const moves = Array.from({ length: k }, () => [a, b]).flat();
  const path = walkOf(moves);
  const rocks = range(0, k - 1).map((i) => [path[2 * i][0] + STEPS[b][0], path[2 * i][1] + STEPS[b][1]]);
  return { moves, level: map(moves, { rocks, ...extra }) };
}
const STAIR_WAYS = [['right', 'up'], ['right', 'down'], ['down', 'right'], ['up', 'right']];

/** Walks `main`, one step of `turn` at each rock. `runs` is how far between rocks. */
function climb(main, turn, runs) {
  const moves = [], rocks = [];
  runs.forEach((n, i) => {
    moves.push(...line(main, n));
    if (i === runs.length - 1) return;
    const [x, y] = walkOf(moves).at(-1);
    rocks.push([x + STEPS[main][0], y + STEPS[main][1]]);
    moves.push(turn);
  });
  return { moves, level: map(moves, { rocks }) };
}
const CLIMBS = [[0, 1, 1], [1, 1, 1], [2, 1], [1, 2], [2, 2], [1, 1, 2], [2, 1, 1], [3, 1], [1, 3], [0, 2, 1], [1, 1, 1, 1], [3, 2]];
const CLIMB_WAYS = [['right', 'up'], ['down', 'right'], ['right', 'down'], ['left', 'up']];
const ifRock = (look, then, other) => ({ if: `rock-${look}`, then, else: other });
const SOME_CLIMBS = () => product(CLIMB_WAYS, CLIMBS).map(([[m, t], runs]) => ({ m, t, ...climb(m, t, runs) }));
/** A gap to walk to and drop through: a along a row, a rock, then down and one more along. */
const gapMoves = (a, d = 'right', t = 'down') => [...line(d, a), t, d];

/** Random programs to read: `make(r)` gives { level, program, prompt, want? }, kept if `keep(run)`. */
function* reading(r, make, keep = (res) => res.path.length >= 3, tries = 300) {
  for (let i = 0; i < tries; i++) {
    const e = make(r);
    if (keep(run(e.level, e.program, e.want), e)) yield e;
  }
}
/** n random steps, none undoing the one before it. */
const someWays = (r, n) => range(1, n).reduce((w) => [...w, one(r, ['right', 'right', 'down', 'down', 'left', 'up'].filter((d) => d !== OPP[w.at(-1)]))], []);


const hop = (...args) => args.map((a) => ({ call: 'hop', args: [a] }));

/** Every Coding template, by family name. Each gives candidates; `build` keeps the ones that pass. */
export const CODING = {
  // Steps
  'walk-line': () => product(['right', 'left', 'down', 'up'], range(1, 5)).map(([d, n]) => ({
    level: map(line(d, n), { pad: d === 'down' || d === 'up' ? [0, 0, 1, 0] : [0, 0, 0, 0] }),
    program: line(null, n), tiles: [d, OPP[d], d === 'right' || d === 'left' ? 'up' : 'right'],
    prompt: `${Cap(say(n))} step${n > 1 ? 's' : ''} to the flower. Which way?`,
    lead: 'Straight there.',
  })),
  'walk-corner': () => product(range(1, 4), range(1, 3), [[0, 0, 0, 0], [0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0]]).map(([a, b, pad]) => ({
    level: map(segs('right', a, 'down', b), { pad }), program: line(null, a + b), tiles: ['right', 'down', 'up'],
    prompt: `An open field, ${say(a + b)} steps. Build any way there.`,
    explain: `${Cap(say(a))} right and ${say(b)} down, in any order that stays on the grid.`,
  })),
  'read-steps': (r) => reading(r, (q) => {
    const n = int(q, 2, 5);
    return { level: field(q), program: someWays(q, n), prompt: `${Cap(say(n))} steps, one at a time. Tap where I stop.` };
  }, (res, e) => res.end === 'short' && res.path.length === e.program.length + 1),
  'read-rocks': (r) => reading(r, (q) => {
    const n = int(q, 3, 6);
    return { level: field(q, { rocks: int(q, 1, 3) }), program: someWays(q, n), prompt: `${Cap(say(n))} steps, with rocks about. Tap where I stop.` };
  }, (res) => res.end !== 'flower'),
  'rock-round': () => product(range(1, 3), [2, 3, 4]).map(([h, w]) => ({
    level: map(segs('down', h, 'right', w, 'up', h), { rocks: range(0, h - 1).map((y) => [1, y]) }),
    program: line(null, 2 * h + w), tiles: ['right', 'up', 'down'],
    prompt: `A rock in the way. ${Cap(say(2 * h + w))} steps, all the way round it.`,
  })),
  maze: function* (r) {
    for (let i = 0; i < 1500; i++) {
      const level = field(r, { w: int(r, 3, 5), h: int(r, 2, 4), rocks: int(r, 2, 6), start: [0, 0] });
      const g = parse(level);
      const ways = new Map([[String(g.start), []]]);
      const queue = [g.start];
      for (const here of queue) { // grows while it runs: breadth first
        for (const d of Object.keys(STEPS)) {
          const to = [here[0] + STEPS[d][0], here[1] + STEPS[d][1]];
          if (g.rock(...to) || ways.has(String(to))) continue;
          ways.set(String(to), [...ways.get(String(here)), d]);
          queue.push(to);
        }
      }
      const way = ways.get(String(g.flower));
      if (!way || way.length < 4 || way.length > 8) continue;
      const used = [...new Set(way)];
      if (used.length < 2) continue; // a straight walk has no rocks to get past
      const tiles = used.length >= 3 ? used : [...used, ...Object.keys(STEPS).filter((d) => !used.includes(d))].slice(0, 3);
      yield { level, program: line(null, way.length), tiles, prompt: `${Cap(say(way.length))} steps. Find the way past the rocks first.` };
    }
  },

  // Loops
  'loop-count': () => product(['right', 'down', 'left'], range(2, 6)).map(([d, n]) => ({
    level: map(line(d, n), { pad: d === 'down' ? [1, 0, 0, 0] : [0, 0, 0, 0] }),
    program: [{ repeat: null, do: [d] }], tiles: upTo(n),
    prompt: `How many times should I step ${d}?`,
    explain: `${Cap(say(n))} squares to the flower, so ${n} rounds. Counting the gaps is the trick.`,
  })),
  'loop-step': () => product(['right', 'down', 'up'], range(2, 6)).filter(([d, n]) => d === 'right' || n <= 4).map(([d, n]) => ({
    level: map(line(d, n), { pad: d === 'right' ? [0, 0, 0, 0] : [1, 0, 0, 0] }),
    program: [{ repeat: n, do: [null] }], tiles: ['up', 'down', 'right'],
    prompt: 'The count is set. Which step goes inside?', explain: `${Cap(d)}, ${say(n)} times in a row.`,
  })),
  'loop-whole': () => product(['right', 'up', 'down'], range(2, 6)).filter(([d, n]) => d === 'right' || n <= 4).map(([d, n]) => ({
    level: map(line(d, n), { pad: d === 'right' ? [0, 0, 0, 0] : [1, 0, 1, 0] }),
    program: [{ repeat: null, do: [null] }], tiles: [n - 1, n, d, d === 'right' ? 'down' : 'left'],
    prompt: 'Fill in the count and the step.', explain: `${Cap(d)}, ${n} times. You chose both parts.`,
  })),
  'stairs-step': () => product(range(2, 4), STAIR_WAYS).map(([k, [a, b]]) => ({
    level: stairs(k, a, b).level, program: [{ repeat: k, do: [null, null] }], tiles: [a, b],
    prompt: `Stairs! Two steps inside, ${say(k)} rounds.`,
    explain: `${Cap(a)} then ${b}, ${say(k)} rounds. ${Cap(b)} first runs into a rock.`,
  })),
  'stairs-all': () => product(range(2, 4), STAIR_WAYS).map(([k, [a, b]]) => ({
    level: stairs(k, a, b).level, program: [{ repeat: null, do: [null, null] }], tiles: [k - 1 || 3, k, a, b],
    prompt: 'Stairs. How many rounds, and which two steps?',
    explain: `${Cap(a)} then ${b}, ${k} times. ${Cap(b)} first runs into a rock.`,
  })),
  'loop-piece': () => product([[2, 2], [2, 3], [3, 2], [1, 2], [1, 3]], [['right', 'down'], ['right', 'up']]).map(([[p, k], [a, b]]) => {
    const inside = [...line(a, p), b];
    return {
      level: map(Array.from({ length: k }, () => inside).flat().slice(0, -1), { fill: '#' }),
      program: [{ repeat: null, do: line(null, p + 1) }], tiles: [k === 2 ? 3 : 2, k, a, b],
      prompt: 'Find the piece that comes round, then count it.',
      explain: `${Cap(inside.join(', '))}, ${k} times. The last round ends on the flower.`,
    };
  }),
  'corridor-counts': () => [...product(range(2, 6), range(1, 4)).map(([a, b]) => [a, b]), ...product(range(2, 5), [2, 3]).map(([a, b]) => [a, b, a])].map((c) => {
    const ways = ['right', 'down', 'left'].slice(0, c.length);
    return {
      level: map(ways.flatMap((d, i) => line(d, c[i])), { fill: '#' }),
      program: ways.map((d) => ({ repeat: null, do: [d] })), tiles: [...new Set([...c, Math.max(...c) - 1])].filter((v) => v >= 1).sort((x, y) => x - y),
      prompt: c.length === 2 ? 'One loop, then the next. Set both counts.' : 'Three loops, one after another. Set each count.',
    };
  }),
  'corridor-steps': () => [...product(range(2, 5), range(1, 4)).map(([a, b]) => [a, b]), ...product(range(2, 5), [2, 3]).map(([a, b]) => [a, b, a])].map((c) => {
    const ways = ['right', 'down', 'left'].slice(0, c.length);
    return {
      level: map(ways.flatMap((d, i) => line(d, c[i])), { fill: '#' }),
      program: ways.map((_, i) => ({ repeat: c[i], do: [null] })), tiles: ['right', 'down', c.length === 3 ? 'left' : 'up'],
      prompt: 'Now the counts are set. Pick each loop\'s step.',
    };
  }),
  'corridor-both': () => product(range(2, 6), [2, 3]).map(([a, b]) => ({
    level: map(segs('right', a, 'down', b, 'left', a), { fill: '#' }),
    program: line(0, 3).map(() => ({ repeat: null, do: [null] })), tiles: [...new Set([b, a])].sort((x, y) => x - y).concat(['right', 'down', 'left']),
    prompt: 'Three whole loops to build.',
  })),
  'corridor-mix': () => product(range(2, 6), ['down', 'up']).map(([a, b]) => ({
    level: map([...line('right', a), b], { fill: '#' }),
    program: [{ repeat: null, do: ['right'] }, null], tiles: [a - 1, a, 'down', 'up'],
    prompt: 'A loop, then one plain step. Fill both.',
    explain: `Right ${a} times, then one step ${b}. Loops and plain steps mix freely.`,
  })),
  'read-loop': (r) => reading(r, (q) => {
    const n = int(q, 2, 6), d = one(q, ['right', 'down']), tail = q() < 0.5 ? [one(q, ['down', 'up', 'right'])] : [];
    return { level: field(q, { w: int(q, 4, 7), h: one(q, [1, 1, 2, 3]), rocks: int(q, 0, 1), start: [0, 0] }), program: [{ repeat: n, do: [d] }, ...tail], prompt: `${Cap(say(n))} rounds${tail.length ? ', then one more step' : ''}. Tap where I stop.` };
  }),
  'read-loop-pair': (r) => reading(r, (q) => {
    const k = int(q, 2, 3), inside = someWays(q, int(q, 2, 4));
    return { level: field(q, { w: int(q, 4, 7), h: int(q, 3, 4), rocks: int(q, 0, 1), start: [0, 0] }), program: [{ repeat: k, do: inside }], prompt: `${Cap(say(inside.length))} steps inside, ${say(k)} rounds. Tap where I stop.` };
  }, (res) => res.path.length >= 3),
  'read-loop-two': (r) => reading(r, (q) => {
    const [a, b] = [int(q, 1, 4), int(q, 1, 3)], [x, y] = one(q, CORNERS);
    return { level: field(q, { w: int(q, 4, 6), h: int(q, 3, 4), start: [0, 0] }), program: [{ repeat: a, do: [x] }, { repeat: b, do: [y] }], prompt: 'Two loops, one after the other. Tap where I stop.' };
  }),

  // If and else
  'if-sides': () => SOME_CLIMBS().map(({ m, t, moves, level }) => ({
    level, program: [{ repeat: moves.length, do: [ifRock(m, [null], [null])] }], tiles: [m, t, OPP[t]],
    prompt: `Rock ${WHERE[m]}: which way? No rock: which way?`,
    explain: `If a rock is ${WHERE[m]}, step ${t}. Else, step ${m}.`,
  })),
  'if-look': () => SOME_CLIMBS().map(({ m, t, moves, level }) => ({
    level, program: [{ repeat: moves.length, do: [{ if: null, then: [t], else: [m] }] }], tiles: [`rock-${m}`, `rock-${t}`],
    prompt: 'Which way should I look?', explain: `Look ${m}. A rock ${WHERE[m]} is the reason to step ${t}.`,
  })),
  'if-all': () => SOME_CLIMBS().map(({ m, t, moves, level }) => ({
    level, program: [{ repeat: moves.length, do: [{ if: null, then: [null], else: [null] }] }], tiles: [`rock-${m}`, `rock-${t}`, m, t],
    prompt: 'The whole if is empty. Fill all three.', explain: `If a rock is ${WHERE[m]}, step ${t}. Else, step ${m}.`,
  })),
  'if-rounds': () => SOME_CLIMBS().filter(({ moves }) => moves.length >= 3).map(({ m, t, moves, level }) => ({
    level, program: [{ repeat: null, do: [ifRock(m, [t], [m])] }], tiles: upTo(moves.length),
    prompt: 'The if is ready. How many rounds reach the flower?',
    lead: `${moves.length} rounds.`,
  })),
  'if-rounds-look': () => SOME_CLIMBS().filter(({ moves }) => moves.length >= 3).map(({ m, t, moves, level }) => ({
    level, program: [{ repeat: null, do: [{ if: null, then: [t], else: [m] }] }], tiles: [moves.length - 1, moves.length, `rock-${m}`, `rock-${t}`],
    prompt: 'How many rounds, and what do I look for?', lead: `${moves.length} rounds, looking ${m}.`,
  })),
  'if-edge': () => product(range(2, 5), range(1, 3)).map(([a, b]) => ({
    level: map(segs('right', a, 'down', b)), program: [{ repeat: a + b, do: [ifRock('right', [null], [null])] }], tiles: ['down', 'right', 'up'],
    prompt: 'No rocks here, only the edge. Which way for each?',
    explain: 'The edge counts as a rock. At the end of the row, step down. Else, step right.',
  })),
  'read-if': (r) => reading(r, (q) => {
    const k = int(q, 1, 6), e = one(q, ['right', 'down', 'up']), t = one(q, Object.keys(STEPS).filter((d) => d !== e && d !== OPP[e]));
    return { level: field(q, { rocks: int(q, 0, 3) }), program: [{ repeat: k, do: [ifRock(one(q, [e, e, e, t]), [t], [e])] }], prompt: k === 1 ? 'One if and one look. Tap where I stop.' : `${Cap(say(k))} rounds, a new look each time. Tap where I stop.` };
  }),
  // For before the edge is taught to count when I look: only rocks ever answer a look here.
  'read-if-plain': (r) => reading(r, (q) => {
    const k = int(q, 1, 4), e = one(q, ['right', 'down']), t = e === 'right' ? 'down' : 'right';
    return { look: e, level: field(q, { w: int(q, 4, 5), h: int(q, 2, 3), rocks: int(q, 1, 2), start: [0, 0] }), program: [{ repeat: k, do: [ifRock(e, [t], [e])] }], prompt: k === 1 ? 'One if and one look. Tap where I stop.' : `${Cap(say(k))} rounds, a new look each time. Tap where I stop.` };
  }, (res, e) => {
    const g = parse(e.level);
    return res.path.every(([x, y]) => x + STEPS[e.look][0] < g.w && y + STEPS[e.look][1] < g.h);
  }),
  'until-if-sides': () => SOME_CLIMBS().map(({ m, t, level }) => ({
    level, program: [{ until: 'flower', do: [ifRock(m, [null], [null])] }], tiles: [m, t, OPP[t]],
    prompt: 'No count now. Which way for each side?',
    explain: `If a rock is ${WHERE[m]}, step ${t}. Else, step ${m}. Until the flower.`,
  })),
  'until-if-all': () => SOME_CLIMBS().map(({ m, t, level }) => ({
    level, program: [{ until: 'flower', do: [{ if: null, then: [null], else: [null] }] }], tiles: [`rock-${m}`, `rock-${t}`, m, t],
    prompt: 'Build the if yourself.', explain: `If a rock is ${WHERE[m]}, step ${t}. Else, step ${m}. Until the flower.`,
  })),

  // Nested loops
  'nest-inner': () => product(range(1, 3), range(2, 3)).filter(([a, k]) => a * k <= 6).map(([a, k]) => ({
    level: map(Array.from({ length: k }, () => [...line('right', a), 'down']).flat()),
    program: [{ repeat: k, do: [{ repeat: null, do: ['right'] }, 'down'] }], tiles: [1, 2, 3],
    prompt: 'The outside is set. How many steps right, each round?',
    explain: `${Cap(say(a))} right and one down, ${say(k)} rounds.`,
  })),
  'nest-outer': () => product(range(1, 3), range(2, 4)).filter(([a, k]) => a * k <= 6).map(([a, k]) => ({
    level: map(Array.from({ length: k }, () => [...line('right', a), 'down']).flat()),
    program: [{ repeat: null, do: [{ repeat: a, do: ['right'] }, 'down'] }], tiles: upTo(k),
    prompt: 'The inside is set. How many rounds of the outside?',
    explain: `${k} rounds: ${say(a)} right and one down, each time.`,
  })),
  'nest-both': () => product(range(1, 3), range(2, 4)).filter(([a, k]) => a * k <= 6 && a !== k).map(([a, k]) => ({
    level: map(Array.from({ length: k }, () => [...line('right', a), 'down']).flat()),
    program: [{ repeat: null, do: [{ repeat: null, do: ['right'] }, 'down'] }], tiles: [a, k].sort((x, y) => x - y),
    prompt: 'Set both counts, the outside first.', explain: `Outside ${k}, inside ${a}: ${say(a)} right and one down, ${k} times.`,
  })),
  'nest-times': () => [[2, 2], [2, 3], [3, 2], [2, 1], [3, 1], [4, 1]].map(([k, a]) => ({
    level: map(line('right', k * a)), program: [{ repeat: k, do: [{ repeat: null, do: ['right'] }] }], tiles: upTo(a).length > 1 ? upTo(a) : [1, 2, 3],
    prompt: `${Cap(say(k * a))} squares to the flower, ${say(k)} rounds. How many inside?`,
    explain: `${Cap(say(k))} rounds of ${a} makes ${k * a}.`,
  })),
  'nest-steps': () => product([[2, 2], [3, 2], [2, 3], [1, 3], [1, 4]], CORNERS).map(([[a, k], [d, t]]) => ({
    level: map(Array.from({ length: k }, () => [...line(d, a), t]).flat().slice(0, -1), { fill: '#' }),
    program: [{ repeat: k, do: [{ repeat: a, do: [null] }, null] }], tiles: [d, t, OPP[t]],
    prompt: 'Fill in both steps.', explain: `${Cap(say(a))} ${d}, then ${t}, ${say(k)} rounds. The flower stops me before the last ${t}.`,
  })),
  'nest-all': () => product([[2, 2], [2, 3], [3, 2], [1, 3]], CORNERS).map(([[a, k], [d, t]]) => ({
    level: map(Array.from({ length: k }, () => [...line(d, a), t]).flat().slice(0, -1), { fill: '#' }),
    program: [{ repeat: null, do: [{ repeat: null, do: [null] }, null] }], tiles: [2, 3, d, t],
    prompt: 'All empty. Find the stretch, then how often it comes round.',
    lead: `${Cap(say(a))} ${d} and one ${t}, ${k} rounds.`,
  })),
  'nest-sizes': () => product(range(1, 3), range(1, 2), [2, 3]).filter(([a, b, k]) => a !== b && a * k < 5 && b * k < 7).map(([a, b, k]) => ({
    level: map(Array.from({ length: k }, () => [...line('down', a), ...line('right', b)]).flat(), { fill: '#' }),
    program: [{ repeat: k, do: [{ repeat: null, do: ['down'] }, { repeat: null, do: ['right'] }] }], tiles: [1, 2, 3],
    prompt: 'Stairs, and you set the sizes.', explain: `Down ${a}, right ${b}, ${say(k)} rounds.`,
  })),
  'read-nest': (r) => reading(r, (q) => {
    const [k, a] = [int(q, 2, 3), int(q, 2, 3)], [x, y] = one(q, CORNERS);
    return { level: field(q, { w: int(q, 4, 7), h: int(q, 3, 5), start: [0, 0] }), program: [{ repeat: k, do: q() < 0.7 ? [{ repeat: a, do: [x] }, y] : [y, { repeat: a, do: [x] }] }], prompt: `${Cap(say(a))} inside, ${say(k)} rounds. Tap where I stop.` };
  }, (res) => res.path.length >= 3),

  // Repeat until
  'until-step': () => product(['right', 'down', 'left'], range(2, 6)).filter(([d, n]) => d !== 'down' || n <= 4).map(([d, n]) => ({
    level: map(line(d, n), { pad: d === 'down' ? [1, 0, 0, 0] : [0, 0, 0, 0] }), program: [{ until: 'flower', do: [null] }], tiles: [d, OPP[d], d === 'down' ? 'right' : 'up'],
    prompt: 'No count to set. Which step takes me there?', explain: `${Cap(d)}, until the flower. It works at any distance.`,
  })),
  'until-pair': () => product(range(2, 4), STAIR_WAYS).map(([k, [a, b]]) => ({
    level: stairs(k, a, b).level, program: [{ until: 'flower', do: [null, null] }], tiles: [a, b],
    prompt: 'Two steps inside. No count at all.', explain: `${Cap(a)} then ${b}, until the flower. ${Cap(b)} first runs into a rock.`,
  })),
  'until-piece': () => product([[2, 2], [2, 3], [3, 2], [1, 2], [1, 3]], [['right', 'down'], ['right', 'up']]).map(([[p, k], [a, b]]) => ({
    level: map(Array.from({ length: k }, () => [...line(a, p), b]).flat().slice(0, -1), { fill: '#' }),
    program: [{ until: 'flower', do: line(null, p + 1) }], tiles: [a, b],
    prompt: `${Cap(say(p + 1))} steps inside. Find the piece that comes round.`,
    explain: `${Cap([...line(a, p), b].join(', '))}, until the flower.`,
  })),
  'until-after': () => product(range(1, 3), range(2, 5)).map(([b, a]) => ({
    level: map(segs('down', b, 'right', a)), program: [{ repeat: null, do: ['down'] }, { until: 'flower', do: ['right'] }], tiles: [1, 2, 3],
    prompt: 'A count first, then no count. How far down?', explain: `Down ${b} to reach the flower's row, then right until the flower.`,
  })),
  'read-until': (r) => reading(r, (q) => {
    const d = one(q, ['right', 'down']), t = d === 'right' ? 'down' : 'right';
    const look = one(q, ['flower', `rock-${d}`, `rock-${d}`]);
    return { level: field(q, { rocks: int(q, 0, 2), start: [0, 0] }), program: [{ until: look, do: q() < 0.3 ? [d, t] : [d] }, ...(q() < 0.5 && look !== 'flower' ? [t] : [])], prompt: look === 'flower' ? 'Until the flower. Tap where I stop.' : 'Until a rock. Tap where I stop.' };
  }, (res) => res.end !== 'endless' && res.path.length >= 2),
  // Before "until a rock" is taught.
  'read-until-flower': (r) => reading(r, (q) => {
    const d = one(q, ['right', 'down']), t = d === 'right' ? 'down' : 'right';
    return { level: field(q, { rocks: int(q, 0, 2), start: [0, 0] }), program: [{ until: 'flower', do: q() < 0.4 ? [d, t] : [d] }], prompt: 'Until the flower. Tap where I stop.' };
  }, (res) => res.end !== 'endless' && res.path.length >= 2),
  'until-rock-step': () => product(range(1, 5), [['right', 'down'], ['down', 'right'], ['left', 'up']]).map(([a, [d, t]]) => ({
    level: map(gapMoves(a, d, t), { rocks: [[STEPS[d][0] * (a + 1), STEPS[d][1] * (a + 1)]] }),
    program: [{ until: `rock-${d}`, do: [null] }, t, d], tiles: [d, OPP[d], d === 'down' ? 'left' : 'up'],
    prompt: 'Which step until the rock?', explain: `${Cap(d)} until the rock, then ${t} and ${d}.`,
  })),
  'until-rock-look': () => range(1, 5).map((a) => ({
    level: map(gapMoves(a), { fill: '#' }), program: [{ until: null, do: ['right'] }, 'down', 'right'], tiles: ['rock-right', 'flower'],
    prompt: 'What should I go on until?', explain: 'Until a rock is to my right. Until the flower would walk me straight into it.',
  })),
  'until-two-step': () => product(range(1, 5), range(1, 4)).map(([a, b]) => ({
    level: map(segs('right', a, 'down', b), { fill: '#' }), program: [{ until: 'rock-right', do: ['right'] }, { until: 'flower', do: [null] }], tiles: ['up', 'down', 'left'],
    prompt: 'Two untils in a row. Which step in the second?', explain: 'Right until the edge, then down until the flower.',
  })),
  'until-two-all': () => product(range(2, 5), range(1, 4)).map(([a, b]) => ({
    level: map(segs('right', a, 'down', b), { fill: '#' }), program: [{ until: null, do: [null] }, { until: null, do: [null] }], tiles: ['rock-right', 'flower', 'right', 'down'],
    prompt: 'Two empty untils. Fill all four gaps.', explain: 'Right until the edge, then down until the flower.',
  })),
  'read-endless': (r) => reading(r, (q) => {
    const d = one(q, Object.keys(STEPS));
    const inside = q() < 0.7 ? [d, OPP[d]] : ['right', 'down', 'left', 'up'];
    return { level: field(q), program: [{ until: 'flower', do: inside }], prompt: 'Round and round. Tap where I stop.' };
  }, (res) => res.end === 'endless'),
  'until-choose': () => product([1, 2, 3], ['line', 'corner']).map(([n, kind]) => ({
    level: kind === 'line' ? map(line('right', 2 * n)) : map(segs('up', n, 'right', n)),
    program: [{ until: 'flower', do: [null, null] }], tiles: kind === 'line' ? ['right', 'left'] : ['up', 'down', 'right'],
    prompt: 'Two steps inside. Choose them so the loop ends.',
    explain: kind === 'line' ? 'Right, right. A step that undoes the last one makes a loop that never ends.' : 'Up and right, in either order, get closer every round. Up and down would never end.',
  })),

  // Your own block
  'fn-call': () => product(range(2, 3), STAIR_WAYS).map(([k, [a, b]]) => ({
    level: map(Array.from({ length: k }, () => [a, b]).flat()), program: [{ define: 'hop', do: [a, b] }, ...line(null, k)], tiles: [{ call: 'hop' }, OPP[a]],
    prompt: 'Hop is ready. Fill the gaps.', explain: `Hop, ${say(k)} times. One name, used again and again.`,
  })),
  'fn-body': () => product(range(2, 3), STAIR_WAYS).map(([k, [a, b]]) => ({
    level: map(Array.from({ length: k }, () => [a, b]).flat()), program: [{ define: 'hop', do: [null, b] }, ...line({ call: 'hop' }, k)], tiles: [a, OPP[a], OPP[b]],
    prompt: 'Hop needs its first step. Which one?', explain: `${Cap(a)} then ${b}. Fix the plan once and every hop uses it.`,
  })),
  'fn-body2': () => product(range(2, 4), STAIR_WAYS).map(([k, [a, b]]) => ({
    level: stairs(k, a, b).level, program: [{ define: 'hop', do: [null, null] }, ...line({ call: 'hop' }, k)], tiles: [a, b],
    prompt: `${Cap(say(k))} hops. Write the plan they all use.`, explain: `${Cap(a)} then ${b}. ${Cap(say(k))} stairs from two tiles.`,
  })),
  'fn-write': () => product(range(2, 3), STAIR_WAYS).map(([k, [a, b]]) => ({
    level: stairs(k, a, b).level, program: [{ define: 'stair', do: [null, null] }, ...line(null, k)], tiles: [{ call: 'stair' }, a, b],
    prompt: 'Write stair, then use it.', explain: `Stair goes ${a} then ${b}, used ${say(k)} times.`,
  })),
  'fn-loop': () => product(range(2, 4), STAIR_WAYS).map(([k, [a, b]]) => ({
    level: stairs(k, a, b).level, program: [{ define: 'hop', do: [null, null] }, { repeat: null, do: [{ call: 'hop' }] }], tiles: [k === 2 ? 3 : k - 1, k, a, b],
    prompt: 'A block inside a loop. Fill it all.', explain: `Hop is a step ${a} and a step ${b}, ${k} rounds.`,
  })),
  'fn-sizes': () => [[2, 2], [2, 3], [3, 2], [1, 3], [1, 4]].map(([a, k]) => ({
    level: map(Array.from({ length: k }, () => [...line('right', a), 'up']).flat(), { fill: '#' }),
    program: [{ define: 'leap', do: [{ repeat: null, do: ['right'] }, 'up'] }, { repeat: null, do: [{ call: 'leap' }] }], tiles: [...new Set([a, k, a + 1])],
    prompt: 'Set the size of each leap, then how many.', explain: `${Cap(say(a))} right and one up, ${k} times.`,
  })),
  'read-fn': (r) => reading(r, (q) => {
    const body = someWays(q, 2), k = int(q, 1, 3);
    return { level: field(q, { w: int(q, 4, 6), h: 3 }), program: [{ define: 'hop', do: body }, ...line({ call: 'hop' }, k), ...(q() < 0.5 ? [one(q, ['down', 'right'])] : [])], prompt: `${Cap(say(k))} hop${k > 1 ? 's' : ''} and what follows. Tap where I stop.` };
  }),
  'fn-rounds': () => SOME_CLIMBS().filter(({ moves }) => moves.length >= 3).map(({ m, t, moves, level }) => ({
    level, program: [{ define: 'go', do: [ifRock(m, [t], [m])] }, { repeat: null, do: [{ call: 'go' }] }], tiles: upTo(moves.length),
    prompt: 'Go takes one look and one step. How many times?', lead: `${moves.length} times.`,
  })),
  'fn-if-sides': () => SOME_CLIMBS().map(({ m, t, level }) => ({
    level, program: [{ define: 'go', do: [ifRock(m, [null], [null])] }, { until: 'flower', do: [{ call: 'go' }] }], tiles: [m, t, OPP[t]],
    prompt: 'Write go, and the until uses it.', explain: `If a rock is ${WHERE[m]}, step ${t}. Else, step ${m}. The until keeps calling go.`,
  })),

  // Parameters
  'param-one': () => product(['right', 'left'], range(2, 6)).map(([d, n]) => ({
    level: map(line(d, n)), program: [HOP(d), ...hop(null)], tiles: upTo(n),
    prompt: 'Hand hop the number that reaches the flower.', explain: `${Cap(say(n))} squares, so hop(${n}). The block stays the same, only the number moves.`,
  })),
  'param-two': () => product(range(1, 3), range(1, 3)).filter(([a, b]) => a !== b).map(([a, b]) => ({
    level: map([...line('right', a), 'down', ...line('right', b)], { fill: '#' }), program: [HOP(), ...hop(null), 'down', ...hop(null)], tiles: [1, 2, 3],
    prompt: 'Two uses of hop. Each gets its own number.', explain: `hop(${a}), a step down, then hop(${b}). Same block, different lengths.`,
  })),
  'param-sum': () => product(range(1, 3), range(1, 4)).map(([a, b]) => ({
    level: map(line('right', a + b)), program: [HOP(), ...hop(a), ...hop(null)], tiles: upTo(b).length > 1 ? upTo(b) : [1, 2, 3],
    prompt: 'The first hop is set. What does the second need?', explain: `${Cap(say(a + b))} squares, ${say(a)} done, so hop(${b}). Hops add up.`,
  })),
  'param-usen': () => product(range(1, 3), range(3, 5)).map(([a, b]) => ({
    level: map(line('right', a + b)), program: [{ define: 'hop', params: ['n'], do: [{ repeat: null, do: ['right'] }] }, ...hop(a), ...hop(b)], tiles: ['n', 1, ...(a + b >= 5 ? [2] : [])],
    prompt: 'Two uses, two numbers. What makes both work?', explain: `Only n follows what each use hands over: ${say(a)} step${a > 1 ? 's' : ''}, then ${say(b)}.`,
  })),
  'read-hop-one': (r) => reading(r, (q) => {
    const a = int(q, 1, 4);
    return { level: field(q, { w: int(q, 4, 6), h: int(q, 2, 3), start: [0, 0] }), program: [HOP(), ...hop(a), 'down'], prompt: `hop(${a}), then one step. Tap where I stop.` };
  }),
  'read-hop': (r) => reading(r, (q) => {
    const a = int(q, 1, 4), b = int(q, 1, 2);
    return { level: field(q, { w: int(q, 4, 6), h: int(q, 2, 3), start: [0, 0] }), program: [HOP(), ...hop(a), 'down', ...hop(b)], prompt: `hop(${a}), a step, hop(${b}). Tap where I stop.` };
  }),
  'js-read-hop': (r) => reading(r, (q) => {
    const a = int(q, 1, 3), b = int(q, 1, 2);
    return { view: 'js', level: field(q, { w: int(q, 3, 5), h: 2, start: [0, 0] }), program: [HOP(), ...hop(a), 'down', ...hop(b)], prompt: 'Two calls, one step between. Tap where I stop.' };
  }),
  'param-stairs': () => product(range(1, 4), [['right', 'down'], ['down', 'right']]).map(([k, [a, b]]) => ({
    level: map(Array.from({ length: k }, () => [a, b]).flat()), program: [STAIRS(a, b), { call: 'stairs', args: [null] }], tiles: upTo(k).length > 1 ? upTo(k) : [1, 2, 3],
    prompt: 'How many rounds reach the flower?', explain: `${Cap(say(k))} square${k > 1 ? 's' : ''} each way, so stairs(${k}).`,
  })),
  'read-stairs': (r) => reading(r, (q) => {
    const k = int(q, 1, 4);
    return { level: field(q, { w: int(q, 3, 5), h: int(q, 3, 5), start: [0, 0] }), program: [STAIRS('right', 'down'), { call: 'stairs', args: [k] }], prompt: `stairs(${k}). Tap where I stop.` };
  }),
  'param-body': () => product(range(2, 4), STAIR_WAYS).map(([k, [a, b]]) => ({
    level: stairs(k, a, b).level, program: [{ define: 'zig', params: ['n'], do: [{ repeat: 'n', do: [null, null] }] }, { call: 'zig', args: [k] }], tiles: [a, b, OPP[b]],
    prompt: `zig(${k}) is ready. Write the two steps inside.`, explain: `${Cap(a)} then ${b}, ${say(k)} rounds. ${Cap(b)} first walks into a rock.`,
  })),
  'read-twice': (r) => reading(r, (q) => {
    const n = int(q, 1, 3);
    return { level: field(q, { w: int(q, 4, 7), h: 2, start: [0, 0] }), program: [HOP(), { define: 'twice', params: ['n'], do: hop('n', 'n') }, { call: 'twice', args: [n] }, 'down'], prompt: `twice(${n}), then a step. Tap where I stop.` };
  }),
  'param-loop': () => product(range(1, 3), [2, 3]).filter(([a, k]) => a * k <= 6).map(([a, k]) => ({
    level: map(Array.from({ length: k }, () => [...line('right', a), 'down']).flat()), program: [HOP(), { repeat: k, do: [...hop(null), 'down'] }], tiles: [1, 2, 3],
    prompt: `${Cap(say(k))} rounds. How long is each hop?`, explain: `${Cap(say(a * k))} along in ${say(k)} rounds: ${say(a)} each.`,
  })),
  'param-loop-both': () => product(range(1, 3), [2, 3]).filter(([a, k]) => a * k <= 6).map(([a, k]) => ({
    level: map(Array.from({ length: k }, () => [...line('right', a), 'down']).flat()), program: [HOP(), { repeat: null, do: [...hop(null), 'down'] }], tiles: [1, 2, 3],
    prompt: 'Two numbers to find: rounds and length.', explain: `${Cap(say(k))} rounds of hop(${a}). The rows set the rounds first.`,
  })),
  'read-grow': (r) => reading(r, (q) => {
    const n = int(q, 1, 3);
    return { level: field(q, { w: int(q, 3, 5), h: int(q, 3, 4), start: [0, 0] }), program: [GROW('right', 'down'), { call: 'grow', args: [n] }], prompt: `grow uses n in two loops. n is ${n}. Tap where I stop.` };
  }),

  // Variables
  'var-set': () => product(['right', 'left'], range(2, 6)).map(([d, n]) => ({
    level: map(line(d, n)), program: [{ set: 'steps', to: null }, { repeat: 'steps', do: [d] }], tiles: upTo(n),
    prompt: 'Which number goes in steps, to reach the flower?', explain: `Set steps to ${n} and the loop reads ${n}.`,
  })),
  'var-by': () => product([1, 2], [2, 3]).map(([s, c]) => ({
    level: map(line('right', s + c)), program: [{ set: 'steps', to: s }, { change: 'steps', by: null }, { repeat: 'steps', do: ['right'] }], tiles: upTo(c),
    prompt: `It starts at ${s}. Change it by how much?`, explain: `${Cap(say(s + c))} squares away, so ${s} plus ${c}.`,
  })),
  'read-var-set': (r) => reading(r, (q) => {
    const s = int(q, 1, 4);
    return { level: field(q, { w: int(q, 4, 6), h: int(q, 2, 3), start: [0, 0] }), program: [{ set: 'steps', to: s }, { repeat: 'steps', do: ['right'] }, 'down'], prompt: 'The loop reads steps. Tap where I stop.' };
  }),
  'read-var': (r) => reading(r, (q) => {
    const s = int(q, 1, 4), c = one(q, [-1, 1, 2]);
    return { level: field(q, { w: int(q, 4, 6), h: int(q, 1, 3), start: [0, 0] }), program: [{ set: 'steps', to: s }, { change: 'steps', by: c }, { repeat: 'steps', do: ['right'] }], prompt: 'Change comes first, then the loop reads it. Tap where I stop.' };
  }),
  'count-end': () => range(1, 5).map((a) => ({
    level: map(gapMoves(a), { fill: '#' }), program: [{ set: 'steps', to: 0 }, { until: { cmp: 'steps', op: '=', n: null }, do: [{ change: 'steps', by: 1 }, 'right'] }, 'down', 'right'], tiles: near(a),
    prompt: 'When should the counting loop end?', explain: `At ${a} I stand above the gap. At ${a + 1} I walk into the rock.`,
  })),
  'count-start': () => product([3, 4, 5], range(1, 4)).filter(([e, a]) => a <= e && e - a <= 2).map(([e, a]) => ({
    level: map(gapMoves(a), { fill: '#' }), program: [{ set: 'steps', to: null }, { until: { cmp: 'steps', op: '=', n: e }, do: [{ change: 'steps', by: 1 }, 'right'] }, 'down', 'right'], tiles: [0, 1, 2],
    prompt: `The loop ends at ${e}. Where should the count start?`, explain: `Start at ${e - a} and ${say(a)} round${a > 1 ? 's' : ''} run, which is what this row needs.`,
  })),
  'count-by': () => [[4, 2], [6, 2], [6, 3], [3, 3], [2, 1], [3, 1]].map(([t, by]) => ({
    level: map(gapMoves(t / by), { fill: '#' }), program: [{ set: 'steps', to: 0 }, { until: { cmp: 'steps', op: '=', n: t }, do: [{ change: 'steps', by: null }, 'right'] }, 'down', 'right'], tiles: [1, 2, 3],
    prompt: 'How much per round gets me to the gap?', explain: `By ${by}: ${say(t / by)} round${t / by > 1 ? 's' : ''} to reach ${t}, so ${say(t / by)} step${t / by > 1 ? 's' : ''}.`,
  })),
  'read-count-one': (r) => reading(r, (q) => {
    const n = int(q, 1, 3);
    return { level: field(q, { w: int(q, 4, 6), h: int(q, 2, 3), start: [0, 0] }), program: [{ set: 'steps', to: 0 }, { until: { cmp: 'steps', op: '=', n }, do: [{ change: 'steps', by: 1 }, 'right'] }, 'down'], prompt: 'Follow the count. Tap where I stop.' };
  }),
  'read-count': (r) => reading(r, (q) => {
    const by = one(q, [1, 1, 2]), n = int(q, 1, 3) * by, s = one(q, [0, 0, 1]);
    return { level: field(q, { w: int(q, 4, 6), h: int(q, 1, 3), start: [0, 0], rocks: int(q, 0, 1) }), program: [{ set: 'n', to: s }, { until: { cmp: 'n', op: '=', n }, do: [{ change: 'n', by }, 'right'] }, ...(q() < 0.4 ? ['down'] : [])], prompt: `Follow the count. It adds ${by} each round. Tap where I stop.` };
  }, (res) => res.end !== 'endless' && res.path.length >= 2),

  // Several flowers
  'flower-line': () => product(range(2, 6), range(0, 2)).map(([n, skip]) => {
    const near = range(1, n - 1).filter((x) => x % 2 === (skip % 2));
    return {
      level: map(line('right', n), { flowers: [[n, 0], ...(near.length ? near : [[1]]).map((x) => [x, 0])] }),
      program: [{ repeat: null, do: ['right'] }], tiles: upTo(n),
      prompt: 'Several flowers. I only stop when the blocks stop.',
      explain: `${Cap(say(n))} steps reach the far flower, and the near ones get picked on the way.`,
    };
  }),
  'flowers-when': (r) => reading(r, (q) => {
    const want = int(q, 1, 3), spots = shuffled(range(1, 6), q).slice(0, want + 1 + int(q, 0, 1)).sort((a, b) => a - b);
    return { level: [['S', ...range(1, 6).map((x) => (spots.includes(x) ? '*' : '.'))].join('')], want, program: [{ set: 'flowers', to: 0 }, { until: { cmp: 'flowers', op: '=', n: null }, do: ['right', { if: 'flower', then: [{ change: 'flowers', by: 1 }], else: [] }] }], tiles: [1, 2, 3], prompt: `Pick exactly ${want} of these. When does the loop end?`, explain: `Until flowers = ${want}. The count ends the walk with the others still growing.` };
  }, () => true, 40),
  'read-flowers': (r) => reading(r, (q) => {
    const want = int(q, 1, 3), spots = shuffled(range(1, 6), q).slice(0, want + 1).sort((a, b) => a - b);
    return { level: [['S', ...range(1, 6).map((x) => (spots.includes(x) ? '*' : '.'))].join('')], want, program: [{ set: 'flowers', to: 0 }, { until: { cmp: 'flowers', op: '=', n: want }, do: ['right', { if: 'flower', then: [{ change: 'flowers', by: 1 }], else: [] }] }], prompt: 'Read the count. Tap where I stop.', explain: `Each flower adds one, and I stop on flower number ${want}.` };
  }, () => true, 40),

  // Values that steer
  'turn-count': () => product(range(1, 3), range(1, 3)).map(([a, b]) => ({
    level: map([...line('right', a), 'down', ...line('right', b)], { fill: '#' }),
    program: [{ set: 'steps', to: 0 }, { repeat: a + 1 + b, do: [{ if: { cmp: 'steps', op: '=', n: null }, then: ['down'], else: ['right'] }, { change: 'steps', by: 1 }] }], tiles: near(a + 1).slice(0, 3),
    prompt: 'On which count should I turn?', explain: `Count ${a}: ${say(a)} along, down past the rock, then along again. The count starts at 0.`,
  })),
  'read-turn-equals': (r) => reading(r, (q) => {
    const n = int(q, 0, 2), [x, y] = one(q, CORNERS);
    return { level: field(q, { w: int(q, 3, 5), h: int(q, 2, 3), start: [0, 0] }), program: [{ set: 'steps', to: 0 }, { repeat: 3, do: [{ if: { cmp: 'steps', op: '=', n }, then: [x], else: [y] }, { change: 'steps', by: 1 }] }], prompt: 'The count starts at 0. Tap where I stop.' };
  }),
  'read-turn': (r) => reading(r, (q) => {
    const R = int(q, 3, 4), n = int(q, 1, 2), op = one(q, ['=', '<']), [x, y] = one(q, CORNERS);
    return { level: field(q, { w: int(q, 3, 5), h: int(q, 2, 3), start: [0, 0] }), program: [{ set: 'n', to: 0 }, { repeat: R, do: [{ if: { cmp: 'n', op, n }, then: [x], else: [y] }, { change: 'n', by: 1 }] }], prompt: 'The count starts at 0. Tap where I stop.' };
  }),
  'js-read-turn': (r) => reading(r, (q) => {
    const R = int(q, 2, 3), n = int(q, 1, 2), op = one(q, ['=', '<']), [x, y] = one(q, CORNERS);
    return { view: 'js', level: field(q, { w: int(q, 3, 4), h: 2, start: [0, 0] }), program: [{ set: 'n', to: 0 }, { repeat: R, do: [{ if: { cmp: 'n', op, n }, then: [x], else: [y] }, { change: 'n', by: 1 }] }], prompt: 'An if with a test. Tap where I stop.' };
  }),
  'read-grow-n': (r) => reading(r, (q) => {
    const s = int(q, 1, 2), k = int(q, 2, 3);
    return { level: field(q, { w: int(q, 4, 6), h: 3, start: [0, 0] }), program: [{ set: 'n', to: s }, { repeat: k, do: [{ repeat: 'n', do: ['right'] }, 'down', { change: 'n', by: 1 }] }], prompt: 'n grows after each round. Tap where I stop.' };
  }),

  // Comparisons
  'sign-gap': () => range(2, 5).map((a) => ({
    level: map(gapMoves(a), { fill: '#' }), program: [{ set: 'steps', to: 0 }, { until: { cmp: 'steps', op: null, n: a - 1 }, do: [{ change: 'steps', by: 1 }, 'right'] }, 'down', 'right'], tiles: ['<', '>', '='],
    prompt: 'Which sign takes me as far as the gap?', explain: `Until steps > ${a - 1} stops at ${a}, level with the gap. Equals would stop a square too soon.`,
  })),
  'less-n': () => product([4, 5, 6], range(2, 5)).filter(([s, a]) => a < s).map(([s, a]) => ({
    level: map(line('right', a)), program: [{ set: 'steps', to: s }, { until: { cmp: 'steps', op: '<', n: null }, do: [{ change: 'steps', by: -1 }, 'right'] }], tiles: [s - a + 1, s - a + 2, s - a + 3],
    prompt: `${Cap(say(a))} steps from ${s}. Less than what?`, explain: `${Cap(say(a))} rounds take it to ${s - a}, the first value less than ${s - a + 1}.`,
  })),
  'read-back': (r) => reading(r, (q) => {
    const s = int(q, 3, 6), k = int(q, 1, s - 1);
    return { level: field(q, { w: int(q, 4, 6), h: int(q, 1, 3), start: [0, 0] }), program: [{ set: 'steps', to: s }, { until: { cmp: 'steps', op: '<', n: k }, do: [{ change: 'steps', by: -1 }, 'right'] }], prompt: `Counting back from ${s}. Tap where I stop.` };
  }),
  'read-not': (r) => reading(r, (q) => {
    const [x, y] = one(q, CORNERS);
    return { level: field(q, { rocks: int(q, 1, 3), start: [0, 0] }), program: q() < 0.5 ? [{ until: { not: `rock-${x}` }, do: [y] }, x] : [{ repeat: int(q, 2, 4), do: [{ if: { not: `rock-${y}` }, then: [y], else: [x] }] }], prompt: 'Read the not carefully. Tap where I stop.' };
  }),

  // Lists
  'list-one': () => product(['right', 'down'], range(2, 5), range(0, 4)).filter(([d, n, gap]) => gap < n && (d === 'right' || n <= 4)).map(([d, n, gap]) => ({
    level: map(line(d, n), { pad: d === 'down' ? [0, 0, 1, 0] : [0, 0, 0, 0] }), program: [{ each: 'way', in: line(d, n).map((v, i) => (i === gap ? null : v)), do: [{ go: 'way' }] }], tiles: [d, OPP[d], d === 'down' ? 'right' : 'up'],
    prompt: 'One value is missing. Which goes there?', explain: `${Cap(say(n))} ${d}. A list is only values, in the order they are walked.`,
  })),
  'list-route': () => product(range(1, 3), range(1, 2)).map(([a, b]) => ({
    level: map(segs('right', a, 'up', b)), program: [{ each: 'way', in: line(null, a + b), do: [{ go: 'way' }] }], tiles: ['up', 'right'],
    prompt: 'Fill the whole list. Any route to the flower is fine.', explain: `${Cap(say(b))} up and ${say(a)} along, in any order that stays on the grid.`,
  })),
  'list-read': (r) => reading(r, (q) => {
    const way = someWays(q, int(q, 2, 4));
    return { level: field(q, { rocks: int(q, 0, 1) }), program: [{ each: 'way', in: way, do: [{ go: 'way' }] }], prompt: 'Read the list from the start. Tap where I stop.' };
  }),
  'list-go': () => product(range(1, 3), range(1, 2), [true, false]).map(([a, b, open]) => {
    const moves = segs('right', a, 'down', b);
    return {
      level: map(moves, { fill: open ? '.' : '#' }), program: [{ each: 'way', in: moves, do: [null] }], tiles: [{ go: 'way' }, 'up'],
      prompt: 'The list is ready. What goes inside the loop?', explain: 'go way follows the list. A plain up would ignore it.',
    };
  }),
  'js-list-read': (r) => reading(r, (q) => {
    const way = someWays(q, 2); // three values won't fit one line of code on a phone
    return { view: 'js', level: field(q), program: [{ each: 'way', in: way, do: [{ go: 'way' }] }], prompt: 'Read the array from the start. Tap where I stop.' };
  }),
  'js-list-go': () => [[1, 1], [2, 0], [0, 2]].flatMap(([a, b]) => [true, false].map((open) => {
    const moves = segs('right', a, 'down', b);
    return {
      view: 'js', level: map(moves, { fill: open ? '.' : '#' }), program: [{ each: 'way', in: moves, do: [null] }], tiles: [{ go: 'way' }, 'left'],
      prompt: 'Which line goes inside the for...of?', explain: 'go(way); uses each value. left(); would ignore the array.',
    };
  })),
  'nums-fill': () => product(range(1, 3), range(1, 3)).filter(([a, b]) => a !== b).map(([a, b]) => ({
    level: map([...line('right', a), 'down', ...line('right', b), 'down']), program: [{ each: 'hop', in: [a, null], do: [{ repeat: 'hop', do: ['right'] }, 'down'] }], tiles: [1, 2, 3],
    prompt: 'Which number finishes the walk?', explain: `${Cap(say(a + b))} squares along, ${say(a)} done, so ${b}.`,
  })),
  'nums-read': (r) => reading(r, (q) => {
    const list = Array.from({ length: int(q, 2, 3) }, () => int(q, 0, 2));
    return { level: field(q, { w: int(q, 4, 6), h: int(q, 3, 4), start: [0, 0] }), program: [{ each: 'n', in: list, do: [{ repeat: 'n', do: ['right'] }, ...(q() < 0.7 ? ['down'] : [])] }], prompt: 'Read each number in turn. Tap where I stop.' };
  }),

  // Drawing
  'draw-line': () => product(range(2, 5), [0, 1]).map(([n, extra]) => ({
    level: map(line('right', n), { paint: true, pad: [0, 0, extra, 0] }), program: [{ repeat: null, do: ['right'] }], tiles: near(n),
    prompt: 'Draw the whole line. How many steps?', explain: `${Cap(say(n))} steps paint ${say(n)} more squares, with nothing extra.`,
  })),
  'draw-corner': () => product(range(1, 3), range(2, 3)).map(([a, b]) => ({
    level: map(segs('right', a, 'down', b), { paint: true }), program: [{ repeat: a, do: ['right'] }, { repeat: b, do: [null] }], tiles: ['down', 'up', 'left'],
    prompt: 'Finish the corner.', explain: `${Cap(say(a))} along and ${say(b)} down. The faint squares are the plan.`,
  })),
  'draw-read': () => product(range(2, 3), range(1, 3), [[1, 1], [1, 0]]).map(([a, b, [third]]) => {
    const moves = third ? segs('right', a, 'down', b, 'left', 1) : segs('right', a, 'down', b);
    return {
      level: map(moves, { paint: true }), program: third ? [{ repeat: a, do: ['right'] }, { repeat: b, do: ['down'] }, 'left'] : [{ repeat: a, do: ['right'] }, { repeat: b, do: ['down'] }],
      prompt: 'Follow the shape as I paint it. Tap where I stop.',
    };
  }),
  'draw-ring': () => product(range(2, 4), range(2, 4)).map(([a, b]) => ({
    level: map(segs('right', a, 'down', b, 'left', a, 'up', b), { paint: true }), program: ['right', 'down', 'left', 'up'].map((d) => ({ repeat: null, do: [d] })), tiles: [...new Set([a, b, Math.max(a, b) - 1])].sort((x, y) => x - y),
    prompt: 'A ring to draw. How long is each side?', explain: `${a} along, ${b} down, ${a} back, ${b} up. Each side starts where the last one ended.`,
  })),
  'draw-ring-list': () => [2, 3, 4].map((n) => ({
    level: map(segs('right', n, 'down', n, 'left', n, 'up', n), { paint: true }), program: [{ each: 'way', in: ['right', 'down', 'left', 'up'], do: [{ repeat: null, do: [{ go: 'way' }] }] }], tiles: [2, 3, 4],
    prompt: 'A square, and the list is set. How long is a side?', explain: `${Cap(say(n))}. One number changes and the whole shape grows.`,
  })),
  'draw-ring-order': () => product(range(2, 4), range(2, 4)).map(([a, b]) => ({
    level: map(segs('right', a, 'down', b, 'left', a, 'up', b), { paint: true }), program: [a, b, a, b].map((n) => ({ repeat: n, do: [null] })), tiles: ['right', 'down', 'left', 'up'],
    prompt: 'Now the sides. In what order do they go?', explain: 'Each side starts where the last one ended, all the way round the ring.',
  })),
  'draw-stairs': () => product(range(2, 4), CORNERS).map(([k, [a, b]]) => ({
    level: map(Array.from({ length: k }, () => [a, b]).flat(), { paint: true }), program: [{ repeat: k, do: [null, null] }], tiles: [a, b, OPP[b]],
    prompt: 'A staircase. Two steps inside the loop.', explain: `${Cap(a)} then ${b}, ${say(k)} rounds. Each round is one stair.`,
  })),
  'draw-param': () => product(range(2, 5), range(1, 3)).map(([n, t]) => ({
    level: map(segs('right', n, 'down', t), { paint: true }), program: [{ define: 'line', params: ['n'], do: [{ repeat: 'n', do: ['right'] }] }, { call: 'line', args: [null] }, ...line('down', t)], tiles: near(n),
    prompt: 'A block that draws a line. How long?', explain: `line(${n}). One more would walk past the shape.`,
  })),
  'draw-spiral': () => [2, 3, 4].map((n) => ({
    level: map(segs('right', n, 'down', n - 1, 'left', n - 2), { paint: true }), program: [{ set: 'n', to: null }, { each: 'way', in: ['right', 'down', 'left'], do: [{ repeat: 'n', do: [{ go: 'way' }] }, { change: 'n', by: -1 }] }], tiles: [2, 3, 4],
    prompt: 'n shrinks each side. Where does it start?', explain: `Start at ${n}: ${[n, n - 1, n - 2].join(', ')}. A shrinking value makes a spiral.`,
  })),
  'read-spiral': () => [2, 3, 4].map((n) => ({
    level: map(segs('right', n, 'down', n - 1, 'left', n - 2), { paint: true }), program: [{ set: 'n', to: n }, { each: 'way', in: ['right', 'down', 'left'], do: [{ repeat: 'n', do: [{ go: 'way' }] }, { change: 'n', by: -1 }] }],
    prompt: 'Follow n as it shrinks. Tap where I stop.',
  })),
};

/** A candidate as it ships: its explanation told from a run, checked by the course's own problem(). */
function finishCoding({ level, program, tiles, want, prompt, explain, lead, view }) {
  if (level[0].length > 7 || level.length > 5) return null;
  const open = holes(program).length > 0;
  const base = { level, program, ...(tiles && { tiles }), ...(want && { want }), prompt };
  const item = { id: 'x', type: open ? 'build' : 'predict', ...base };
  if (open && !solve(item)) return null;
  const told = story(level, open ? fill(program, solve(item)) : program, want);
  const entry = { ...base, explain: explain ?? (lead ? `${lead} ${told}` : told) };
  return codingProblem({ ...item, ...(view && { view }), explain: entry.explain }) ? null : entry;
}

/** Up to MAX of a family's candidates, spread evenly over program sizes so every item finds its size. */
function choose(name, candidates, finish, size) {
  const r = seeded(name);
  const seen = new Set();
  const buckets = new Map();
  for (const c of shuffled([...candidates], r)) {
    const key = JSON.stringify(c);
    if (seen.has(key)) continue;
    seen.add(key);
    const b = size(c);
    buckets.set(b, [...(buckets.get(b) ?? []), c]);
  }
  const out = [];
  const lists = [...buckets.values()];
  while (out.length < MAX && lists.some((l) => l.length)) {
    for (const l of lists) {
      if (out.length >= MAX) break;
      let e = null;
      while (l.length && !e) e = finish(l.shift());
      if (e) out.push(e);
    }
  }
  return out;
}

export const buildCoding = () => Object.fromEntries(Object.entries(CODING).map(([name, make]) =>
  [name, choose(name, make(seeded(name)), finishCoding, (c) => `${parts(c.program).length} ${c.level.length * c.level[0].length > 10} ${c.tiles?.filter((t) => typeof t === 'number')}`)]));

// ---- Maths: fresh numbers. toQuiz still works out each answer from the sum ----

const pairTiles = (r, pairs) => shuffled(pairs.flat().map(String), r);
const andPairs = (pairs) => pairs.map(([a, b]) => `${a} and ${b}`).join(', ');
const lowest = (n, d) => { const g = (a, b) => (b ? g(b, a % b) : a); const k = g(n, d); return `${n / k}/${d / k}`; };
const PERCENTS = [[50, '1/2', 'a half'], [25, '1/4', 'a quarter'], [10, '1/10', 'a tenth'], [20, '1/5', 'a fifth'], [75, '3/4', 'three quarters']];
const dollars = (list) => list.map((v) => `$${v}`);

export const MATHS = {
  'ten-gaps': () => range(1, 9).map((n) => ({
    picture: { frame: n }, sum: `10 - ${n}`, prompt: 'How many more dots would fill the frame?',
    options: [10 - n - 1, 10 - n, 10 - n + 1].map(String), explain: `${n} dots and ${10 - n} gaps: ${n} and ${10 - n} make 10.`,
  })),
  'make-ten': (r) => range(1, 12).map(() => {
    const pairs = shuffled([[1, 9], [2, 8], [3, 7], [4, 6]], r).slice(0, 3);
    return { make: 10, tiles: pairTiles(r, pairs), prompt: 'Tap two numbers that make 10. Clear the lot.', explain: `${andPairs(pairs)}. Ten every time.` };
  }),
  'make-hundred': (r) => range(1, 12).map(() => {
    const pairs = shuffled([[10, 90], [20, 80], [30, 70], [40, 60], [15, 85], [25, 75], [35, 65], [45, 55]], r).slice(0, 3);
    return { make: 100, tiles: pairTiles(r, pairs), prompt: 'Now pairs that make 100.', explain: `${andPairs(pairs)}.` };
  }),
  give: () => product([7, 8, 9], range(4, 9)).map(([a, b]) => ({
    show: `${a} + ${b}`, prompt: `Give ${10 - a} of the ${b} to the ${a} to make 10. Then add what is left.`,
    explain: `${a} + ${10 - a} is 10, with ${b - (10 - a)} left over: ${a + b}.`,
  })),
  'make-first': () => product([7, 8, 9], range(4, 9)).map(([a, b]) => ({
    show: `${a} + ${b}`, prompt: 'Make 10 first, then add the rest.', explain: `${a} + ${10 - a} is 10, with ${b - (10 - a)} left over: ${a + b}.`,
  })),
  'add-line': () => product([6, 7, 8, 9], range(3, 9)).filter(([a, b]) => (a + b) % 2 === 0 && a + b > 10).map(([a, b]) => ({
    show: `${a} + ${b}`, min: 0, max: 20, ticks: 10, prompt: 'Where does it land? Drag the marker and let go.',
    explain: `${a} + ${10 - a} makes 10, and ${b - (10 - a)} more is ${a + b}.`,
  })),
  'hop-up': () => product([2, 3, 4, 5, 6, 7], [6, 7, 8, 9], [5, 6, 7, 8]).filter(([, u, b]) => u + b > 10).map(([t, u, b]) => {
    const a = t * 10 + u, next = (t + 1) * 10;
    return { show: `${a} + ${b}`, prompt: `Hop to ${next} first, then the rest.`, explain: `${a} + ${next - a} is ${next}, then ${b - (next - a)} more: ${a + b}.` };
  }),
  'hop-up-pick': () => product([2, 3, 4, 5, 6, 7], [6, 7, 8, 9], [5, 6, 7, 8]).filter(([, u, b]) => u + b > 10).map(([t, u, b]) => {
    const a = t * 10 + u, next = (t + 1) * 10;
    return { show: `${a} + ${b}`, prompt: 'Tap the answer.', options: [a + b - 2, a + b, a + b + 2].map(String), explain: `${a} + ${next - a} is ${next}, then ${b - (next - a)} more: ${a + b}.` };
  }),
  'hop-down': () => product([3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5], [6, 7, 8, 9]).filter(([, u, b]) => b > u).map(([t, u, b]) => {
    const a = t * 10 + u, tens = t * 10;
    return { show: `${a} - ${b}`, prompt: `Taking away works too: hop down to ${tens} first.`, explain: `${a} - ${u} is ${tens}, then ${b - u} more down: ${a - b}.` };
  }),
  double: () => product([1, 2, 3, 4], [5, 6, 7, 8, 9]).map(([t, u]) => ({
    show: `${t * 10 + u} × 2`, prompt: 'Double it: the tens, then the ones.', explain: `${t * 10} doubled is ${t * 20} and ${u} doubled is ${u * 2}: ${(t * 10 + u) * 2}.`,
  })),
  halve: () => product([2, 4, 6, 8], [2, 4, 6, 8]).map(([t, u]) => ({
    show: `${t * 10 + u} ÷ 2`, prompt: 'Halve it: the tens, then the ones.', explain: `Half of ${t * 10} is ${t * 5} and half of ${u} is ${u / 2}: ${(t * 10 + u) / 2}.`,
  })),
  'times-four': () => [12, 13, 14, 15, 16, 18, 25, 35, 45].map((n) => ({
    show: `${n} × 4`, prompt: 'Double, then double again.', explain: `${n}, ${n * 2}, ${n * 4}.`,
  })),
  'times-eight': () => [15, 35, 45, 11, 12, 13, 14, 75].map((n) => ({
    show: `${n} × 8`, prompt: 'Double three times.', explain: `${n}, ${n * 2}, ${n * 4}, ${n * 8}.`,
  })),
  'halve-double': () => [12, 14, 18, 22, 24, 26, 28, 32, 36].map((n) => ({
    show: `${n} × 5`, prompt: 'Halve one number, double the other. Which has the same answer?',
    options: [`${n / 2} × 10`, `${n * 2} × 10`, `${n / 2} × 5`], explain: `Half of ${n} is ${n / 2} and double 5 is 10. ${n / 2} × 10 is ${n * 5}, an easy one.`,
  })),

  'pct-grid': () => [10, 20, 30, 60, 70, 80, 90].map((n) => ({
    picture: { grid: n }, prompt: 'What percent is shaded?', options: [`${n / 10}%`, `${n}%`, `${100 - n}%`],
    explain: `${n / 10} full row${n > 10 ? 's' : ''} of 10 is ${n} squares out of 100: ${n}%.`,
  })),
  'pct-line-tens': () => range(1, 9).map((k) => ({
    sum: String(k * 10), min: 0, max: 100, ticks: 10, unit: '%', prompt: `Drag the marker to ${k * 10}% and let go.`, explain: `${k * 10}% is ${k * 10} out of 100: ${k} hop${k > 1 ? 's' : ''} of 10.`,
  })),
  'pct-line-parts': () => [[4, 1], [4, 2], [4, 3], [5, 1], [5, 2], [5, 3], [5, 4]].map(([ticks, k]) => ({
    sum: String((100 * k) / ticks), min: 0, max: 100, ticks, unit: '%', prompt: `Drag to ${(100 * k) / ticks}%.`, explain: `${(100 * k) / ticks}% is ${say(k)} hop${k > 1 ? 's' : ''} of ${say(ticks)} along.`,
  })),
  'pct-fraction': () => PERCENTS.map(([p, f, name]) => ({
    show: `${p}%`, prompt: `Which is the same as ${p}%?`, options: [f, `1/${p}`, p === 50 ? '1/5' : '1/2'], explain: `${p} out of 100 is ${name}.`,
  })),
  'tenth-of': () => [30, 40, 70, 80, 90, 120, 150, 180, 240, 320, 450, 600].map((n) => ({
    show: `10% of ${n}`, prompt: 'A tenth of it.', explain: `A tenth of ${n} is ${n / 10}.`,
  })),
  'half-of': () => [24, 28, 32, 36, 48, 52, 58, 64, 72, 86, 94].map((n) => ({
    show: `50% of ${n}`, prompt: 'Half of it.', explain: `Half of ${n} is ${n / 2}.`,
  })),
  'twenty-of': () => [20, 40, 50, 60, 70, 80, 90, 120, 150].map((n) => ({
    show: `20% of ${n}`, prompt: '20% is 10%, doubled.', explain: `10% of ${n} is ${n / 10}, and double that is ${n / 5}.`,
  })),
  'five-of': () => [40, 80, 120, 160, 240, 280, 320, 400].map((n) => ({
    show: `5% of ${n}`, prompt: '5% is half of 10%.', options: [n / 40, n / 20, n / 10].map(String), explain: `10% of ${n} is ${n / 10}, and half of that is ${n / 20}.`,
  })),
  tip: () => [20, 40, 80, 100, 120, 140, 160, 200].map((n) => ({
    show: `15% of $${n}`, prompt: 'What is the tip? 10%, plus half of that.', explain: `10% is ${n / 10} and half of that is ${n / 20}: $${(n * 15) / 100}.`,
  })),
  'quarter-off': () => [20, 40, 60, 100, 120, 160, 200, 240].map((n) => ({
    show: `25% off $${n}`, sum: `${n} - 25% of ${n}`, prompt: 'What do you pay? 25% is a quarter.', explain: `A quarter of ${n} is ${n / 4} off, so you pay $${n - n / 4}.`,
  })),
  'twenty-off': () => [30, 40, 60, 70, 80, 90, 100, 120].map((n) => ({
    show: `20% off $${n}`, sum: `${n} - 20% of ${n}`, prompt: 'What do you pay?', options: dollars([n - n / 5 - 10, n - n / 5, n - n / 5 + 5]),
    explain: `10% of ${n} is ${n / 10}, so 20% is ${n / 5} off: $${n - n / 5}.`,
  })),
  'pct-pairs': (r) => range(1, 12).map(() => {
    const three = shuffled(PERCENTS, r).slice(0, 3);
    return { tiles: shuffled(three.flatMap(([p, f]) => [`${p}%`, f]), r), prompt: 'Match each percent to its fraction.', explain: `${three.map(([p, , name]) => `${p}% is ${name}`).join(', ')}.` };
  }),

  'bar-pick': () => [[1, 4], [3, 5], [2, 3], [1, 5], [4, 5], [1, 6], [5, 6], [2, 5], [1, 8], [3, 8]].map(([n, d]) => ({
    picture: { bar: [n, d] }, prompt: 'How much is shaded?', options: [`${d - n}/${d}`, `${n}/${d}`, `${d}/${n}`], explain: `${n} of ${d} equal parts: ${n}/${d}.`,
  })),
  'bar-build': () => [[1, 4], [3, 4], [2, 3], [1, 5], [3, 5], [4, 5], [1, 6], [5, 6], [3, 8], [7, 8]].map(([n, d]) => ({
    picture: { bar: [n, d] }, extra: String([...'123456789'].find((c) => c !== String(n) && c !== String(d))),
    prompt: 'Build the fraction that is shaded.', explain: `${n} of ${d} equal parts: ${n}/${d}.`,
  })),
  'same-amount': () => [[3, 6], [2, 6], [4, 6], [2, 8], [4, 8], [6, 8], [2, 10], [4, 10], [5, 10]].map(([n, d]) => {
    const f = lowest(n, d);
    return { picture: { bar: [n, d] }, prompt: 'Which is the same amount?', options: [f, `1/${d}`, `${n}/${d * 2}`], explain: `${n} of ${d} parts is the same as ${f} of the bar.` };
  }),
  'same-pairs': (r) => range(1, 12).map(() => {
    const three = shuffled([['1/2', '3/6'], ['1/3', '2/6'], ['3/4', '6/8'], ['2/3', '4/6'], ['1/4', '2/8'], ['2/5', '4/10']], r).slice(0, 3);
    return { tiles: shuffled(three.flat(), r), prompt: 'Match the fractions that are the same amount.', explain: `${three.map(([a, b]) => `${a} is ${b}`).join(', ')}.` };
  }),
  'biggest-unit': () => [[2, 3, 4], [2, 3, 5], [2, 4, 5], [3, 4, 6], [3, 5, 6], [4, 5, 6], [2, 5, 8], [3, 6, 8], [4, 6, 8]].map(([a, b, c]) => ({
    goal: 'biggest', picture: { bars: [[1, a], [1, b], [1, c]] }, prompt: 'Which shaded part is biggest?', options: [`1/${a}`, `1/${b}`, `1/${c}`],
    explain: `Fewer parts means bigger parts: 1/${a} beats 1/${b} and 1/${c}.`,
  })),
  'biggest-bars': () => [[[1, 3], [3, 4], [2, 5]], [[1, 2], [3, 5], [1, 4]], [[2, 3], [1, 2], [1, 5]], [[1, 2], [3, 4], [3, 5]], [[2, 5], [1, 3], [1, 2]], [[4, 5], [2, 3], [1, 2]], [[1, 4], [2, 5], [1, 3]]].map((bars) => {
    const big = bars.reduce((a, b) => (a[0] / a[1] >= b[0] / b[1] ? a : b));
    return { goal: 'biggest', picture: { bars }, prompt: 'Which is biggest? Look at the bars.', options: bars.map(([n, d]) => `${n}/${d}`), explain: `${big[0]}/${big[1]} reaches furthest along its bar.` };
  }),
  'frac-line': () => [[1, 2], [1, 4], [3, 4], [1, 3], [2, 3], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6]].map(([n, d]) => ({
    show: `${n}/${d}`, min: 0, max: 1, ticks: d === 2 ? 4 : d, prompt: `Drag the marker to ${n}/${d}.`,
    explain: d === 2 ? 'Two hops of four: halfway.' : `${Cap(say(n))} hop${n > 1 ? 's' : ''} of ${say(d)}.`,
  })),
  'frac-past': () => [[3, 2], [5, 4], [7, 4], [4, 3], [5, 3]].map(([n, d]) => ({
    show: `${n}/${d}`, min: 0, max: 2, ticks: 2 * d, prompt: `Past 1 now: drag to ${n}/${d}.`, explain: `${n}/${d} is one whole and ${n - d}/${d} more.`,
  })),
};

const finishMaths = (type) => (e) => (mathsProblem({ id: 'x', type, ...e }) ? null : e);
const MATHS_TYPES = { 'ten-gaps': 'pick', 'make-ten': 'pairs', 'make-hundred': 'pairs', 'add-line': 'line', 'hop-up-pick': 'pick', 'halve-double': 'pick', 'pct-grid': 'pick', 'pct-line-tens': 'line', 'pct-line-parts': 'line', 'pct-fraction': 'pick', 'five-of': 'pick', 'twenty-off': 'pick', 'pct-pairs': 'pairs', 'bar-pick': 'pick', 'same-amount': 'pick', 'same-pairs': 'pairs', 'biggest-unit': 'pick', 'biggest-bars': 'pick', 'frac-line': 'line', 'frac-past': 'line' };

export const buildMaths = () => Object.fromEntries(Object.entries(MATHS).map(([name, make]) =>
  [name, choose(name, make(seeded(name)), finishMaths(MATHS_TYPES[name] ?? 'build'), () => 0)]));

/** One entry a line: readable diffs, and no more bytes than needed. */
export const toFile = (pool) => `{\n${Object.entries(pool).map(([name, list]) =>
  `${JSON.stringify(name)}: [\n${list.map((e) => JSON.stringify(e)).join(',\n')}\n]`).join(',\n')}\n}\n`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const [file, pool] of [['coding', buildCoding()], ['maths', buildMaths()]]) {
    const path = new URL(`../src/data/${file}-variants.json`, import.meta.url);
    writeFileSync(path, toFile(pool));
    console.log(`${file}: ${Object.keys(pool).length} families, ${Object.values(pool).flat().length} entries, ${Math.round(toFile(pool).length / 1024)} KB`);
  }
}
