import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import data from '../src/data/mate.json' with { type: 'json' };
import { defence, forcedMate } from '../src/chess/prover.js';
import { TIERS, dailyIndex, entry, mistake, teach } from '../src/chess/mate.js';
import { uci } from '../src/chess/puzzle.js';
import { HINT, LEVELS, bestMove, evaluate, thinking } from '../src/chess/engine.js';
import { RUN_MS, VALUE, attackers, hunted, play, start, wave } from '../src/chess/capture.js';
import { load, targets } from '../src/chess/items.js';

/** A small seeded generator, so a failure replays. */
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 2 ** 32; };
const sample = (list, n) => list.filter((_, i) => i % Math.ceil(list.length / n) === 0);

test('Mate keeps its CC0 notice and every line loads in chess.js', () => {
  assert.match(data.notice, /CC0/);
  assert.match(readFileSync('docs/chess-positions/NOTICE.md', 'utf8'), /CC0/);
  for (const n of TIERS) {
    assert.equal(data[n].length, 1500);
    for (const line of data[n]) new Chess(entry(line).fen);
  }
});

test('Mate positions replay: the proved key, the best defence, then checkmate on the board', () => {
  for (const n of TIERS) for (const line of sample(data[n], n === 4 ? 25 : 60)) {
    const { fen } = entry(line);
    const first = forcedMate(fen, n);
    assert.equal(first.inMoves, n, fen);
    assert.equal(first.keys.length, 1, fen);
    const g = new Chess(fen);
    for (let left = n; ; left--) {
      const res = forcedMate(g.fen(), left);
      assert.ok(res, `${fen}: mate kept with ${left} left`);
      g.move(uci(res.keys[0]));
      if (g.isCheckmate()) break;
      assert.ok(left > 1, `${fen}: out of moves`);
      g.move(uci(defence(g.fen(), left - 1)));
    }
    assert.ok(g.isCheckmate(), fen);
  }
});

test('the prover agrees with a plain search on chess.js', () => {
  const plain = (g, d) => g.moves().some((m) => {
    g.move(m);
    const ok = g.isCheckmate() || (d > 1 && !g.isDraw() && g.moves().length && g.moves().every((r) => { g.move(r); const k = plain(g, d - 1); g.undo(); return k; }));
    g.undo();
    return ok;
  });
  const fens = [...sample(data[2], 10).map((l) => entry(l).fen),
    'k7/8/8/K7/8/8/8/3R4 w - - 0 1', '7k/8/8/5K2/8/8/8/R7 w - - 0 1', '4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'r3k3/8/8/8/8/8/4Q3/R3K2R w KQq - 0 1', '8/8/8/2k5/3Pp3/8/8/4K3 b - d3 0 1'];
  for (const fen of fens) for (const d of [1, 2]) assert.equal(!!forcedMate(fen, d), plain(new Chess(fen), d), `${fen} in ${d}`);
});

test('the defender picks the reply that escapes, and a move that gives up the mate is proved', () => {
  // The tutorial's ladder: Kb6 mates in 2; Rd7 lets the king out, as Kb8 shows.
  assert.deepEqual(forcedMate('k7/8/8/K7/8/8/8/3R4 w - - 0 1', 2), { keys: ['a5b6'], inMoves: 2 });
  const afterRook = 'k7/3R4/8/K7/8/8/8/8 b - - 1 1';
  const r = defence(afterRook, 1);
  const g = new Chess(afterRook);
  g.move(uci(r));
  assert.equal(forcedMate(g.fen(), 1), null);
  assert.match(mistake('k7/8/8/K7/8/8/8/3R4 w - - 0 1', 'd1d7', 1), /no forced mate/);
  assert.equal(defence('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 1), null, 'stalemate: no reply');
});

test('Hints nudge, then explain in words with no notation', () => {
  const one = teach('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', { keys: ['a1a8'], inMoves: 1 });
  assert.equal(one.from, 'a1');
  assert.match(one.explain, /^Rook to a8 is checkmate/);
  const two = teach('k7/8/8/K7/8/8/8/3R4 w - - 0 1', forcedMate('k7/8/8/K7/8/8/8/3R4 w - - 0 1', 2));
  assert.equal(two.nudge, 'Look at the king on a5.');
  assert.match(two.explain, /^King to b6 is quiet.*only one reply/);
});

test('the daily board depends on the date and tier alone', () => {
  assert.equal(dailyIndex('2026-10-31', 2, 1500), dailyIndex('2026-10-31', 2, 1500));
  const days = Array.from({ length: 30 }, (_, i) => dailyIndex(`2026-11-${String(i + 1).padStart(2, '0')}`, 3, 1500));
  assert.ok(new Set(days).size > 25);
  assert.ok(days.every((d) => d >= 0 && d < 1500));
});

const FIXED = () => 0.5; // no blunder, no noise pull

test('the engine plays mate in one at every level', () => {
  for (const level of LEVELS) {
    const san = bestMove(new Chess('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'), level, FIXED);
    assert.equal(san, 'Ra8#', JSON.stringify(level));
  }
});

test('the engine takes a hanging queen and only ever plays legal moves', () => {
  assert.equal(bestMove(new Chess('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1'), LEVELS[3]), 'exd5');
  const g = new Chess();
  const rng = seeded(7);
  for (let i = 0; i < 40 && !g.isGameOver(); i++) {
    const san = bestMove(g, LEVELS[i % 2], rng);
    assert.ok(g.moves().includes(san), san);
    g.move(san);
  }
  assert.equal(bestMove(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), LEVELS[0]), null);
  assert.equal(bestMove(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), HINT), null);
});

test('evaluation counts material from the side to move', () => {
  assert.ok(evaluate(new Chess('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1')) > 800);
  assert.ok(evaluate(new Chess('4k3/8/8/8/8/8/8/Q3K3 b - - 0 1')) < -800);
});

test('the engine thinks in slices: the page gets turns, and it can be cancelled', async () => {
  const beat = setInterval(() => { beats++; }, 1);
  let beats = 0;
  const g = new Chess();
  const t = thinking(g, { ...LEVELS[2], ms: 300 });
  const san = await t.result;
  clearInterval(beat);
  assert.ok(g.moves().includes(san));
  assert.ok(beats > 5, `timers ran ${beats} times`);
  const c = thinking(g, LEVELS[3]);
  c.cancel();
  assert.equal(g.history().length, 0, 'the game itself is untouched');
});

test('Scramble starts with one or two of your pieces, no kings, and a wave of enemies', () => {
  for (let i = 0; i < 40; i++) {
    const { fen } = start(seeded(i));
    const pieces = load(fen).board().flat().filter(Boolean);
    const mine = pieces.filter((p) => p.color === 'w');
    assert.ok(mine.length >= 1 && mine.length <= 2);
    assert.ok(pieces.every((p) => p.type !== 'k'));
    assert.equal(pieces.filter((p) => p.color === 'b').length, wave(0));
    assert.equal(attackers(fen, hunted(fen)).length, 0, 'no arrival attacks the hunted piece');
    assert.equal(fen.split(' ')[1], 'w');
  }
  assert.equal(RUN_MS, 90000);
});

const FEN = (rows) => `${rows} w - - 0 1`;

test('Scramble: illegal moves are refused, captures score by value and chain', () => {
  const state = { fen: FEN('8/8/8/8/p2n4/8/8/R7'), score: 0, chain: 0, taken: 0 };
  assert.equal(play(state, { from: 'a1', to: 'b2' }, seeded(1)), null);
  const took = play(state, { from: 'a1', to: 'a4' }, seeded(1));
  assert.equal(took.took, 'p');
  assert.equal(took.gain, VALUE.p);
  assert.equal(took.state.chain, 1);
  // A second capture in a row is worth double (a knight: 3 x 2), a quiet move ends the chain.
  const chained = play({ fen: FEN('8/8/8/8/8/8/n7/R7'), score: 1, chain: 1, taken: 1 }, { from: 'a1', to: 'a2' }, seeded(2));
  assert.equal(chained.gain, 6);
  assert.equal(chained.state.score, 7);
  const quiet = play({ fen: FEN('n7/8/8/8/8/8/8/1R6'), score: 0, chain: 2, taken: 0 }, { from: 'b1', to: 'b2' }, seeded(3));
  assert.equal(quiet.state.chain, 0);
});

test('Scramble: enemies arrive as you take them, and a safe move draws no hit', () => {
  const r = play({ fen: FEN('8/8/8/8/8/8/p7/R7'), score: 0, chain: 0, taken: 0 }, { from: 'a1', to: 'a2' }, seeded(4));
  const enemies = load(r.state.fen).board().flat().filter((p) => p?.color === 'b');
  assert.equal(enemies.length, wave(1));
});

test('Scramble: an enemy that can take your best piece does, and it comes back safe', () => {
  // The rook steps onto a line the black rook covers; the knight is left alone.
  const state = { fen: FEN('r7/7p/7p/8/8/8/8/1R4N1'), score: 4, chain: 2, taken: 0 };
  const r = play(state, { from: 'b1', to: 'a1' }, seeded(5));
  assert.deepEqual(r.hit, { from: 'a8', to: 'a1' });
  assert.equal(r.state.chain, 0);
  assert.equal(r.state.score, 4, 'a hit costs time, never gain');
  const pieces = load(r.state.fen).board().flat().filter(Boolean);
  assert.equal(pieces.filter((p) => p.color === 'w').length, 2, 'the caught rook is back');
  const rook = pieces.find((p) => p.color === 'w' && p.type === 'r');
  assert.equal(attackers(r.state.fen, rook.square).length, 0);
  assert.equal(load(r.state.fen).get('a1').color, 'b');
  // Your less valuable piece is never hunted: the knight on an attacked square draws nothing.
  const safe = play({ fen: FEN('n7/8/1N6/8/8/8/8/7R'), score: 0, chain: 0, taken: 0 }, { from: 'h1', to: 'h2' }, seeded(6));
  assert.equal(safe.hit, null);
});

test('Scramble moves are chess.js moves: a long random run never breaks', () => {
  const rng = seeded(11);
  let s = start(rng);
  for (let i = 0; i < 300; i++) {
    const g = load(s.fen);
    const mine = g.board().flat().filter((p) => p?.color === 'w');
    assert.ok(mine.length >= 1, `move ${i}: ${s.fen}`);
    const p = mine[Math.floor(rng() * mine.length)];
    const to = targets(s.fen, p.square);
    if (!to.length) continue;
    const r = play(s, { from: p.square, to: to[Math.floor(rng() * to.length)] }, rng);
    assert.ok(r);
    s = r.state;
    assert.ok(g.board().flat().every((x) => x?.type !== 'k'));
    assert.ok(load(s.fen).board().flat().filter((x) => x?.color === 'b').length <= 7);
  }
});
