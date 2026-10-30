import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkpoint, echoes, fresh, marked, warmUps, withCheckpoint } from '../src/repeat.js';
import { subjects } from '../src/subjects.js';
import { problem as chessProblem } from '../src/chess/items.js';

const chess = subjects.find((s) => s.id === 'chess');
const random = () => 0.3;

test('warm-ups are the course cards closest to slipping, never from this lesson', () => {
  const cards = { 'c:a': { due: '2026-01-03' }, 'c:b': { due: '2026-01-01' }, 'c:c': { due: '2026-01-02' }, 'x:d': { due: '2025-01-01' } };
  assert.deepEqual(warmUps(cards, (k) => k.startsWith('c:'), ['c:b']), ['c:c', 'c:a']);
  assert.deepEqual(warmUps({}, () => true, []), []);
});

test('echoes skip teach cards and anything with no worthwhile repeat', () => {
  const subject = { vary: (i) => (i.id === 'no' ? null : { ...i, fresh: true }) };
  const items = [{ id: 't', type: 'teach' }, { id: 'no', type: 'x' }, { id: 'a', type: 'x' }];
  assert.deepEqual(echoes(subject, items, random).map((e) => [e.source.id, e.item.fresh]), [['a', true]]);
  assert.deepEqual(echoes({}, items, random), [], 'a subject with no vary');
  assert.equal(fresh({}, items[2]), items[2]);
});

test('a unit gains a checkpoint of its marked items; a tiny unit does not', () => {
  const big = { lessons: [{ id: 'a', items: Array(3).fill({ type: 'x' }) }, { id: 'b', items: [{ type: 'teach' }, { type: 'x' }] }] };
  const unit = withCheckpoint(big);
  assert.equal(unit.lessons.at(-1).mix, true);
  assert.equal(unit.lessons.at(-1).items.length, 4);
  assert.ok(unit.lessons.at(-1).items.every(marked));
  assert.equal(withCheckpoint({ lessons: [{ id: 'a', items: [{ type: 'x' }] }] }).lessons.length, 1);
  assert.equal(checkpoint({}, unit.lessons.at(-1).items, random, 2).length, 2);
});

test('every chess stars puzzle mirrors into a puzzle that can still be solved, in plain words', () => {
  const stars = chess.units.flatMap((u) => u.lessons.flatMap((l) => l.items)).filter((i) => i.type === 'stars');
  assert.ok(stars.length > 10);
  for (const item of stars) {
    const m = chess.vary(item);
    assert.equal(chessProblem(m), null, item.id);
    assert.equal(m.demo, undefined);
    assert.notDeepEqual(m.stars, item.stars, item.id);
  }
  assert.equal(chess.vary({ type: 'find', fen: '' }), null);
  assert.equal(chess.vary({ fen: '', moves: [] }), null, 'a real-game puzzle');
});
