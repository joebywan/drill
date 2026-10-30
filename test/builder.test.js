import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlace, listAt, moveTo, newState, place, placed, takeOut, wordsOf } from '../src/builder.js';

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
