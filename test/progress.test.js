import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, finishSession, currentStreak, dueKeys, light } from '../src/progress.js';

const day = (d, h = 12) => new Date(2026, 9, d, h);
const roundTrip = (p) => JSON.parse(JSON.stringify(p)); // as it comes back out of localStorage

test('streak counts consecutive days, once per day', () => {
  let p = emptyProgress();
  p = finishSession(p, 'a', [], day(1));
  p = roundTrip(finishSession(p, 'b', [], day(1, 20)));
  assert.equal(p.streak.count, 1);
  p = finishSession(p, 'c', [], day(2, 0));
  assert.equal(currentStreak(p, day(3)), 2, 'still alive the day after');
  assert.equal(currentStreak(p, day(4)), 0, 'a missed day ends it');
  p = finishSession(p, 'd', [], day(4));
  assert.equal(p.streak.count, 1);
});

test('streak crosses a month boundary', () => {
  const p = finishSession(finishSession(emptyProgress(), 'a', [], new Date(2026, 8, 30)), 'b', [], new Date(2026, 9, 1));
  assert.equal(p.streak.count, 2);
});

test('lessons unlock, reviews do not, xp rewards first-time answers', () => {
  const p = finishSession(emptyProgress(), null, [{ key: 'x', correct: true }, { key: 'y', correct: false }], day(1));
  assert.deepEqual(p.done, {});
  assert.equal(p.xp, 12);
  assert.ok(finishSession(p, 'chess:l1', [], day(1)).done['chess:l1']);
});

test('a missed item comes back sooner than a solved one, and both come back', () => {
  const p = roundTrip(finishSession(emptyProgress(), 'l', [{ key: 'miss', correct: false }, { key: 'hit', correct: true }], day(1)));
  assert.ok(new Date(p.cards.miss.due) < new Date(p.cards.hit.due));
  assert.deepEqual(dueKeys(p, day(1)), []);
  assert.deepEqual(dueKeys(p, day(28)), ['miss', 'hit']);
});

test('the light is soft before the first lesson, bright when today is done, ember after a gap', () => {
  assert.equal(light(emptyProgress(), day(1)), 'soft');
  const p = finishSession(emptyProgress(), 'a', [], day(1));
  assert.equal(light(p, day(1, 23)), 'bright');
  assert.equal(light(p, day(2)), 'soft');
  assert.equal(light(p, day(3)), 'ember');
});
