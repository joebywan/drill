import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import course from '../src/data/chess.json' with { type: 'json' };
import { needed, startPuzzle, tryMove } from '../src/chess/puzzle.js';

const puzzles = course.units.flatMap((u) => u.lessons.flatMap((l) => l.items));

test('every shipped puzzle is solved by playing its own line', () => {
  for (const p of puzzles) {
    const s = startPuzzle(p);
    let result;
    while (s.ply < p.moves.length) {
      const m = p.moves[s.ply];
      result = tryMove(s, m.slice(0, 2), m.slice(2, 4));
      assert.notEqual(result, 'wrong', `${p.id} rejected its own move ${m}`);
      if (result === 'solved') break;
    }
    assert.equal(result, 'solved', `${p.id} never finished`);
  }
});

test('course ids are unique and every lesson is full', () => {
  const ids = puzzles.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const u of course.units) for (const l of u.lessons) assert.equal(l.items.length, 8, l.id);
});

// Two mates on the board: Re8# is stored, Rd8# must be accepted too.
const twoMates = { id: 't', fen: '7k/p5pp/8/8/8/8/8/3RR1K1 b - - 0 1', moves: ['a7a6', 'e1e8'] };

test('the stored move solves', () => {
  assert.equal(tryMove(startPuzzle(twoMates), 'e1', 'e8'), 'solved');
});

test('any other checkmate solves', () => {
  const s = startPuzzle(twoMates);
  assert.equal(tryMove(s, 'd1', 'd8'), 'solved');
  assert.ok(new Chess(s.game.fen()).isCheckmate(), 'independent check: the position is mate');
});

test('a legal non-mating move and an illegal move are both wrong and change nothing', () => {
  const s = startPuzzle(twoMates);
  const fen = s.game.fen();
  assert.equal(tryMove(s, 'g1', 'g2'), 'wrong');
  assert.equal(tryMove(s, 'e1', 'a5'), 'wrong');
  assert.equal(s.game.fen(), fen);
});

test('a line that needs a rook accepts the rook, and says so for any other piece', () => {
  const puzzle = { fen: '7k/2P5/8/1K6/8/8/8/8 b - - 0 1', moves: ['h8h7', 'c7c8r'] };
  const s = startPuzzle(puzzle);
  const before = s.game.fen();
  for (const piece of ['q', 'b', 'n']) {
    assert.equal(tryMove(s, 'c7', 'c8', piece), 'piece', piece);
    assert.equal(s.game.fen(), before, 'the board stays put');
    assert.equal(needed(s), 'r');
  }
  assert.equal(tryMove(s, 'c7', 'c8', 'r'), 'solved');
});

test('a promotion that mates counts whatever the line had stored', () => {
  const puzzle = { fen: '6k1/4P3/6K1/8/8/8/8/7r b - - 0 1', moves: ['h1h2', 'e7e8q'] };
  assert.equal(tryMove(startPuzzle(puzzle), 'e7', 'e8', 'r'), 'solved'); // a rook mates too
  assert.equal(tryMove(startPuzzle(puzzle), 'e7', 'e8', 'n'), 'piece');
});
