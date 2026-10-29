import { test } from 'node:test';
import assert from 'node:assert/strict';
import basics from '../src/data/basics.json' with { type: 'json' };
import forks from '../src/data/forks.json' with { type: 'json' };
import chess from '../src/data/chess.json' with { type: 'json' };
import { answer, attacked, explanation, grade, hop, kind, meets, problem, solutions, starPath, words } from '../src/chess/items.js';

const all = [...basics.units, forks, ...chess.units].flatMap((u) => u.lessons.flatMap((l) => l.items));

test('every item in the course passes the rules check', () => {
  for (const item of all) assert.equal(problem(item), null, item.id);
});

test('item ids are unique across the whole course', () => {
  assert.equal(new Set(all.map((i) => i.id)).size, all.length);
});

test('every marked item has an explanation', () => {
  for (const item of all.filter((i) => kind(i) !== 'teach')) assert.ok(explanation(item), item.id);
});

test('attacked() finds the enemy pieces a knight hits, and nothing else', () => {
  assert.deepEqual(attacked('7k/3q1r2/6p1/4N3/8/8/8/6K1 w - - 0 1', 'e5'), ['d7', 'f7', 'g6']);
});

const byId = Object.fromEntries(all.map((i) => [i.id, i]));

test('tap is graded as a set, in any order, with no extras', () => {
  const tap = byId['fork-0-tap'];
  assert.ok(grade(tap, ['g6', 'd7', 'f7']));
  assert.ok(!grade(tap, ['d7', 'f7']));
  assert.ok(!grade(tap, ['d7', 'f7', 'g6', 'h8']));
});

test('true/false is decided by the board, not by the author', () => {
  const tf = byId['fork-0-tf'];
  assert.equal(answer(tf), true);
  assert.equal(answer({ ...tf, targets: ['h8', 'a8'] }), false);
  assert.ok(grade(tf, true) && !grade(tf, false));
});

test('a move item accepts any move that meets the goal, and only legal ones', () => {
  const fork = byId['fork-1-pick'];
  assert.equal(meets(fork, 'Nf7+').correct, true);
  assert.equal(meets(fork, 'Ne6').correct, false);
  assert.equal(meets(fork, { from: 'g5', to: 'g7' }).legal, false);
  assert.deepEqual(solutions(fork).map((m) => m.san), ['Nf7+']);
});

test('a move goal the position cannot meet is caught', () => {
  assert.equal(problem({ ...byId['fork-1-pick'], targets: ['h8', 'a1'] }), 'no legal move meets the goal');
});

test('tap can ask for a named square or every square a piece reaches', () => {
  assert.deepEqual(answer({ type: 'tap', rule: 'name', answer: 'e4' }), ['e4']);
  assert.deepEqual(answer({ type: 'tap', rule: 'moves', fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', square: 'a1' }),
    ['a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'c1', 'd1']);
});

test('ends asks only for the furthest square along each line', () => {
  const rook = { type: 'tap', rule: 'ends', fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', square: 'a1' };
  assert.deepEqual(answer(rook), ['a8', 'd1']);
  const knight = { type: 'tap', rule: 'ends', fen: '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', square: 'd4' };
  assert.equal(answer(knight).length, 8, 'every knight jump is its own direction');
});

test('true/false can claim check and mate, judged by the board', () => {
  assert.equal(answer({ type: 'truefalse', claim: 'check', fen: '4k3/8/8/8/8/8/8/4R1K1 b - - 0 1' }), true);
  assert.equal(answer({ type: 'truefalse', claim: 'mate', fen: '4k3/8/8/8/8/8/8/4R1K1 b - - 0 1' }), false);
});

test('moves read as words', () => {
  assert.equal(words('Nxf7+'), 'Knight takes on f7, check');
  assert.equal(words('e8=Q#'), 'Pawn to e8, becomes a queen, checkmate');
  assert.equal(words('O-O-O'), 'Castles queenside');
});

test('a puzzle with no written explanation explains with its line', () => {
  const { explain, ...bare } = byId['fork-0-find'];
  assert.equal(explanation(bare), 'The line: Knight to c7, check.');
});

test('a fork claim the board does not back up is caught', () => {
  assert.equal(problem({ ...byId['fork-1-find-a'], targets: ['g8', 'a8'] }), 'the move misses a target');
});

const rook = { type: 'stars', fen: 'R7/8/8/8/8/8/8/8 w - - 0 1', stars: ['h8', 'h1'], moves: 2 };

test('a stars move keeps the turn with the player, and illegal ones are refused', () => {
  const { fen, played } = hop(rook.fen, { from: 'a8', to: 'h8' });
  assert.equal(played.san, 'Rh8');
  assert.equal(fen.split(' ')[1], 'w', 'the other side never gets a move');
  assert.ok(hop(fen, { from: 'h8', to: 'h1' }), 'and the rook can go again');
  assert.equal(hop(rook.fen, { from: 'a8', to: 'b6' }), null);
});

test('stars are collected by landing on them, within the move budget', () => {
  const path = starPath(rook);
  assert.deepEqual(path.map((m) => m.to), ['h8', 'h1']);
  let fen = rook.fen;
  const left = new Set(rook.stars);
  for (const m of path) { fen = hop(fen, m).fen; left.delete(m.to); }
  assert.equal(left.size, 0);
  assert.equal(starPath({ ...rook, moves: 1 }), null, 'two stars on different lines need two moves');
  assert.match(problem({ ...rook, moves: 1 }), /can't all be collected in 1 moves/);
  assert.equal(problem(rook), null);
});

test('a stars item is checked for its own pieces on stars and an illegal demo', () => {
  assert.match(problem({ ...rook, stars: ['a8'] }), /own piece/);
  assert.match(problem({ ...rook, demo: ['a8', 'b6'] }), /demo/);
  assert.equal(problem({ ...rook, demo: ['a8', 'a1', 'h1'] }), null);
});

test('a stars item with no written explanation explains with a way that works', () => {
  assert.equal(explanation(rook), 'One way: Rook to h8, then Rook to h1.');
});
