import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlace, listAt, moveTo, newState, place, placed, reachOf, takeOut, wordsOf } from '../src/builder.js';

// Word chips and a chip with arms: nothing here knows what a chip means.
const chips = [{ face: 'a' }, { face: 'b', uses: 1 }, { face: 'loop', arms: [''] }, { face: 'if', arms: ['', 'else'] }];

test('chips go in at the cursor, and the cursor moves past them', () => {
  const s = newState();
  place(s, chips, 0);
  place(s, chips, 1);
  assert.deepEqual(s.tree, [{ chip: 0 }, { chip: 1 }]);
  assert.deepEqual(s.cursor, { path: [], at: 2 });
});

test('a chip with arms takes the cursor inside; tapping a list moves it there', () => {
  const s = newState();
  place(s, chips, 2);
  place(s, chips, 0);
  assert.deepEqual(s.tree, [{ chip: 2, arms: [[{ chip: 0 }]] }]);
  moveTo(s, []);
  place(s, chips, 3);
  moveTo(s, [1, 1]);
  place(s, chips, 1);
  assert.deepEqual(listAt(s.tree, [1, 1]), [{ chip: 1 }]);
  assert.deepEqual(placed(s.tree), [2, 0, 3, 1]);
});

test('taking a chip out leaves the cursor in its gap, so the next one inserts there', () => {
  const s = newState();
  for (const c of [0, 1, 0]) place(s, chips, c);
  takeOut(s, [], 1);
  place(s, chips, 2);
  assert.deepEqual(s.tree.map((n) => n.chip), [0, 2, 0]);
});

test('taking out a chip with arms takes what it holds, and the limits read the whole tree', () => {
  const s = newState();
  place(s, chips, 2);
  place(s, chips, 1);
  assert.equal(canPlace(s, chips, 1), false, 'uses');
  assert.equal(canPlace(s, chips, 0, 2), false, 'limit');
  assert.equal(canPlace(s, chips, 0, 3), true);
  takeOut(s, [], 0);
  assert.deepEqual(s.tree, []);
  assert.deepEqual(s.cursor, { path: [], at: 0 });
  assert.equal(canPlace(s, chips, 1), true);
});

test('a part-written answer: chips fill the holes in order, tapping one empties it, fixed text stays', () => {
  const s = newState([{ text: 'let' }, { hole: true }, { text: '=' }, { hole: true }]);
  place(s, chips, 0);
  place(s, chips, 1);
  assert.deepEqual(wordsOf(s.tree, chips), ['let', 'a', '=', 'b']);
  assert.equal(canPlace(s, chips, 0), false, 'no hole left');
  takeOut(s, [], 1);
  assert.deepEqual(wordsOf(s.tree, chips, '___'), ['let', '___', '=', 'b']);
  assert.equal(canPlace(s, chips, 0), true);
  place(s, chips, 0);
  assert.deepEqual(placed(s.tree), [0, 1]);
});

test('a thumb target reaches toward 44px into empty space, and only halfway to another tappable thing', () => {
  const box = (top, left, h = 28, w = 28) => ({ top, left, bottom: top + h, right: left + w });
  assert.deepEqual(reachOf([box(100, 100)], 0), { up: 8, down: 8, left: 8, right: 8 }, 'alone: 44px each way');
  assert.deepEqual(reachOf([box(100, 100, 44, 44)], 0), { up: 0, down: 0, left: 0, right: 0 }, 'already big enough');
  // A row below 4px away, overlapping sideways: each stops at the middle of the gap.
  const rows = [box(100, 100), box(132, 110)];
  assert.equal(reachOf(rows, 0).down, 2);
  assert.equal(reachOf(rows, 1).up, 2);
  assert.equal(reachOf(rows, 0).up, 8, 'nothing above');
  // Touching: no reach that way at all. Side by side 6px apart: 3px each.
  assert.equal(reachOf([box(100, 100), box(128, 100)], 0).down, 0);
  const pair = [box(100, 100), box(100, 134)];
  assert.deepEqual([reachOf(pair, 0).right, reachOf(pair, 1).left], [3, 3]);
  // A neighbour that reaches nowhere itself (a loop's head): all the way to it.
  assert.equal(reachOf([box(100, 100), { ...box(132, 110), fixed: true }], 0).down, 4);
  // Far off to the side, something below is not in the way.
  assert.equal(reachOf([box(100, 100), box(132, 300)], 0).down, 8);
});
