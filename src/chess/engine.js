import { Chess } from 'chess.js';

/**
 * Rosa's game: a small search on chess.js (negamax with alpha-beta, capture search at the leaves,
 * material and a simple positional eval). chess.js does about 6,000 positions a second here, so
 * `think` is a generator that yields often and `thinking` runs it in slices, leaving the page live.
 * Each level is a depth, a time limit, some noise on the scores and a chance of a random move.
 */
export const LEVELS = [
  { depth: 1, ms: 300, noise: 180, blunder: 0.2, quiesce: false, helps: true },
  { depth: 2, ms: 800, noise: 60, blunder: 0.05, quiesce: false, helps: true },
  { depth: 3, ms: 1500, noise: 15, blunder: 0, quiesce: true },
  { depth: 4, ms: 3000, noise: 0, blunder: 0, quiesce: true },
];
/** What a hint plays like: sound, with no noise. */
export const HINT = { depth: 2, ms: 800, noise: 0, blunder: 0, quiesce: true };

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;
const SLICE_MS = 10;
const OUT_OF_TIME = Symbol('time');

/** The position for the side to move, in centipawns. */
export function evaluate(g) {
  let score = 0, left = 0;
  const all = g.board();
  for (const row of all) for (const p of row) if (p && p.type !== 'p' && p.type !== 'k') left += VALUE[p.type];
  all.forEach((row, r) => row.forEach((p, f) => {
    if (!p) return;
    const centre = 3.5 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5)); // 0.5 at the edge to 3.5 in the middle
    let v = VALUE[p.type];
    if (p.type === 'p') v += ((p.color === 'w' ? 6 - r : r - 1) * 8) + (centre >= 2.5 ? 12 : 0);
    else if (p.type === 'n' || p.type === 'b') v += centre * 8;
    else if (p.type === 'k') v += left < 2000 ? centre * 8 : -centre * 12; // hides until the endgame
    score += p.color === 'w' ? v : -v;
  }));
  return g.turn() === 'w' ? score : -score;
}

// SAN says enough to order moves cheaply: mates, promotions, captures by the small piece, checks.
const rank = (san) => (san.endsWith('#') ? 0 : san.includes('=') ? 1 : san.includes('x') ? (san[0] < 'a' ? 3 : 2) : san.endsWith('+') ? 4 : 5);
const ordered = (moves) => moves.map((m) => [rank(m), m]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

function* search(g, depth, alpha, beta, ply, clock, level) {
  if (Date.now() > clock.deadline) throw OUT_OF_TIME;
  if (Date.now() > clock.slice) { yield; clock.slice = Date.now() + SLICE_MS; }
  if (ply && g.isDraw()) return 0;
  const moves = g.moves();
  if (!moves.length) return g.inCheck() ? ply - MATE : 0;
  if (depth <= 0) {
    const stand = evaluate(g);
    if (!level.quiesce || depth < -3) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const noisy = ordered(moves.filter((m) => m.includes('x') || m.includes('=')));
    let best = stand;
    for (const m of noisy) {
      g.move(m);
      const s = -(yield* search(g, depth - 1, -beta, -alpha, ply + 1, clock, level));
      g.undo();
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = -Infinity;
  for (const m of ordered(moves)) {
    g.move(m);
    const s = -(yield* search(g, depth - 1, -beta, -alpha, ply + 1, clock, level));
    g.undo();
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

/** A copy that keeps the game's history, so a repetition counts. */
function copy(game) {
  const start = game.getHeaders().FEN;
  const g = start ? new Chess(start) : new Chess();
  for (const m of game.history()) g.move(m);
  return g;
}

/** A generator: yields while it works, returns the move in SAN, or null with no legal move. */
export function* think(game, level, rng = Math.random) {
  const g = copy(game);
  const moves = g.moves();
  if (!moves.length) return null;
  if (level.blunder && rng() < level.blunder) return moves[Math.floor(rng() * moves.length)];
  const clock = { deadline: Date.now() + level.ms, slice: Date.now() + SLICE_MS };
  let root = ordered(moves).map((m) => ({ m, s: 0 }));
  try {
    for (let d = 1; d <= level.depth; d++) {
      const next = [];
      let alpha = -Infinity;
      for (const r of root) {
        g.move(r.m);
        // Noise needs true scores to compare, so a noisy level searches each move with the full window.
        const s = -(yield* search(g, d - 1, -Infinity, level.noise ? Infinity : -alpha, 1, clock, level));
        g.undo();
        next.push({ m: r.m, s });
        if (s > alpha) alpha = s;
      }
      root = next.sort((a, b) => b.s - a.s);
      if (root[0].s >= MATE - 100) break; // a mate found stays the shortest
    }
  } catch (e) {
    if (e !== OUT_OF_TIME) throw e; // else: the last finished depth stands
  }
  if (!level.noise) return root[0].m;
  // A mate is never noised away: a mate on the board is always played.
  if (root[0].s >= MATE - 100) return root[0].m;
  return root.map((r) => ({ m: r.m, s: r.s + (rng() - 0.5) * level.noise })).sort((a, b) => b.s - a.s)[0].m;
}

/** The whole search at once, for tests. */
export function bestMove(game, level, rng) {
  const it = think(game, level, rng);
  let step;
  do step = it.next(); while (!step.done);
  return step.value;
}

/** `think` in slices between timers: { result: a promise of the move, cancel() }. */
export function thinking(game, level, rng) {
  const it = think(game, level, rng);
  let timer, cancelled = false;
  const result = new Promise((resolve, reject) => {
    const slice = () => {
      if (cancelled) return;
      try {
        const step = it.next();
        if (step.done) resolve(step.value); else timer = setTimeout(slice);
      } catch (e) { reject(e); }
    };
    timer = setTimeout(slice);
  });
  return { result, cancel: () => { cancelled = true; clearTimeout(timer); } };
}
