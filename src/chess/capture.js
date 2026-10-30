import { hop, load, handBack } from './items.js';

/**
 * Scramble, Drill's own capture game: no kings, a clock, your one or two pieces against black ones
 * that keep arriving. Enemies only ever move to take your most valuable piece, right after your
 * move, and the piece they catch costs time rather than the run: it lands on a safe square and
 * the clock drops. Pure, with the legal moves from chess.js and `rng` passed in; the screen is in games.js.
 */
export const RUN_MS = 90000;
export const HIT_MS = 10000;
export const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const LOADOUTS = [['r', 'n'], ['b', 'n'], ['r', 'b'], ['q']];
const FILES = 'abcdefgh';
const ALL = [...FILES].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));
const oneOf = (list, rng) => list[Math.floor(rng() * list.length)];
const put = (fen, piece, color, square) => { const g = load(fen); g.put({ type: piece, color }, square); return g.fen(); };

/** Black pieces that can take on `square` now. */
export const attackers = (fen, square) => load(handBack(fen, 'b')).moves({ verbose: true }).filter((m) => m.to === square);

/** Where your most valuable piece stands: the one the enemy hunts. */
export function hunted(fen) {
  const mine = load(fen).board().flat().filter((p) => p?.color === 'w');
  return mine.reduce((best, p) => (VALUE[p.type] > VALUE[best.type] ? p : best), mine[0])?.square;
}

const enemies = (fen) => load(fen).board().flat().filter((p) => p?.color === 'b').length;
const empty = (fen) => { const g = load(fen); return ALL.filter((s) => !g.get(s)); };
/** How many enemies stand on the board, growing as the run goes on. */
export const wave = (taken) => Math.min(6, 3 + Math.floor(taken / 5));
const pool = (taken) => (taken < 4 ? ['p', 'p', 'n'] : taken < 10 ? ['p', 'n', 'b', 'r'] : ['p', 'n', 'b', 'r', 'q']);

/** One new enemy somewhere it doesn't attack the hunted piece, so an arrival is never an unfair hit. */
function spawn(fen, taken, rng) {
  const type = oneOf(pool(taken), rng);
  const best = hunted(fen);
  const squares = empty(fen).filter((s) => type !== 'p' || (s[1] >= '3' && s[1] <= '7'));
  for (let i = squares.length; i > 0; i--) { // shuffled, so the first that fits is random
    const s = squares.splice(Math.floor(rng() * i), 1)[0];
    const next = put(fen, type, 'b', s);
    if (!attackers(next, best).length) return next;
  }
  return fen;
}

export function start(rng = Math.random) {
  const set = oneOf(LOADOUTS, rng);
  let fen = '8/8/8/8/8/8/8/8 w - - 0 1';
  set.forEach((p, i) => { fen = put(fen, p, 'w', `${'cf'[i]}1`); });
  for (let i = 0; i < wave(0); i++) fen = spawn(fen, 0, rng);
  return { fen, score: 0, chain: 0, taken: 0 };
}

/**
 * Plays your move: null if the rules don't allow it. Otherwise the new state, what was taken and
 * for how much score, `arrived`, and `hit` { from, to } if an enemy then caught the hunted piece.
 */
export function play(state, move, rng = Math.random) {
  const result = hop(state.fen, { ...move, promotion: 'q' });
  if (!result) return null;
  const took = result.played.captured || null;
  let { fen } = result;
  const chain = took ? state.chain + 1 : 0;
  const taken = state.taken + (took ? 1 : 0);
  const gain = took ? VALUE[took] * Math.min(chain, 3) : 0;
  while (enemies(fen) < wave(taken)) {
    const next = spawn(fen, taken, rng);
    if (next === fen) break;
    fen = next;
  }
  const best = hunted(fen);
  const hunter = attackers(fen, best)[0];
  let hit = null;
  if (hunter) {
    const victim = load(fen).get(best).type;
    const g = load(handBack(fen, 'b'));
    g.move({ from: hunter.from, to: best, promotion: 'q' });
    fen = handBack(g.fen(), 'w');
    fen = landing(fen, victim, rng);
    hit = { from: hunter.from, to: best };
  }
  return { state: { fen, score: state.score + gain, chain: hit ? 0 : chain, taken }, took, gain, hit };
}

/** Your caught piece comes back where nothing attacks it. */
function landing(fen, type, rng) {
  const squares = empty(fen);
  for (let i = squares.length; i > 0; i--) {
    const s = squares.splice(Math.floor(rng() * i), 1)[0];
    const next = put(fen, type, 'w', s);
    if (!attackers(next, s).length) return next;
  }
  return fen; // ponytail: no safe square on a board of six enemies never happens in play; the piece just waits out
}
