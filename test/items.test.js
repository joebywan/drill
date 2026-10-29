import { test } from 'node:test';
import assert from 'node:assert/strict';
import forks from '../src/data/forks.json' with { type: 'json' };
import chess from '../src/data/chess.json' with { type: 'json' };
import { answer, attacked, explanation, grade, kind, problem } from '../src/chess/items.js';

const all = [forks, ...chess.units].flatMap((u) => u.lessons.flatMap((l) => l.items));

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

test('an illegal pick option is caught', () => {
  assert.match(problem({ ...byId['fork-0-pick'], options: ['Nc7+', 'Nb8'] }), /Invalid move/);
});

test('a puzzle with no written explanation explains with its line', () => {
  const { explain, ...bare } = byId['fork-0-find'];
  assert.equal(explanation(bare), 'The line: Nc7+.');
});
