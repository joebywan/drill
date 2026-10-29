import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, finishSession, currentStreak, dueKeys, light, needsRepair } from '../src/progress.js';

const day = (d, h = 12) => new Date(2026, 9, d, h);
const roundTrip = (p) => JSON.parse(JSON.stringify(p)); // as it comes back out of localStorage

test('streak counts consecutive days, once per day', () => {
  let p = emptyProgress();
  p = finishSession(p, 'a', [], day(1));
  p = roundTrip(finishSession(p, 'b', [], day(1, 20)));
  assert.equal(p.streak.count, 1);
  p = finishSession(p, 'c', [], day(2, 0));
  assert.equal(currentStreak(p, day(3)), 2, 'alive the day after');
});

test('one missed day is forgiven without asking', () => {
  let p = finishSession(finishSession(emptyProgress(), 'a', [], day(1)), 'b', [], day(2));
  assert.equal(currentStreak(p, day(4)), 2, 'holds through the missed day');
  p = finishSession(p, 'c', [], day(4));
  assert.equal(p.streak.count, 3);
  assert.deepEqual(p.streak.forgiven, ['2026-10-04']);
});

test('a second gap in the same week needs a review, and a lesson waits for it', () => {
  let p = finishSession(finishSession(emptyProgress(), 'a', [], day(1)), 'b', [], day(3)); // day 2 forgiven
  assert.equal(needsRepair(p, day(5)), true, 'day 4 missed, the allowance is used');
  const lessonOnly = finishSession(p, 'c', [], day(5));
  assert.deepEqual(lessonOnly.streak, p.streak, 'a lesson leaves it waiting');
  assert.equal(light(lessonOnly, day(5)), 'ember');
  p = finishSession(lessonOnly, null, [], day(5));
  assert.equal(p.streak.count, 3);
  assert.equal(light(p, day(5)), 'bright');
});

test('a gap of up to three days is repaired by a review; four is too long', () => {
  const p = finishSession(emptyProgress(), 'a', [], day(1));
  assert.equal(finishSession(p, null, [], day(5)).streak.count, 2, 'days 2-4 missed, repaired');
  assert.equal(currentStreak(p, day(6)), 0, 'days 2-5 missed');
  assert.equal(finishSession(p, null, [], day(6)).streak.count, 1);
});

test('streak crosses a month boundary', () => {
  const p = finishSession(finishSession(emptyProgress(), 'a', [], new Date(2026, 8, 30)), 'b', [], new Date(2026, 9, 1));
  assert.equal(p.streak.count, 2);
});

test('lessons unlock, reviews do not, and recall pays more than a first try', () => {
  const answers = [{ key: 'x', correct: true }, { key: 'y', correct: false }];
  const review = finishSession(emptyProgress(), null, answers, day(1));
  assert.deepEqual(review.done, {});
  assert.equal(review.xp, 5, '5 per item recalled');
  const lesson = finishSession(emptyProgress(), 'chess:l1', answers, day(1));
  assert.ok(lesson.done['chess:l1']);
  assert.equal(lesson.xp, 7, '5 for the lesson, 2 per first-try right');
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
  assert.equal(light(p, day(30)), 'ember', 'never dark, however long the gap');
});
