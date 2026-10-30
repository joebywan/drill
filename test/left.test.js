import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, currentStreak, emptyProgress, finishPractice, finishSession, habitDays, leavePractice, light, logToday, migrate, showsIntro, startedHabits } from '../src/progress.js';
import { garden } from '../src/garden/model.js';

const day = (d, h = 12) => new Date(2026, 9, d, h);
const roundTrip = (v) => JSON.parse(JSON.stringify(v));

test('every new log entry keeps its local hour: lessons, practices and one-tap logs', () => {
  let p = finishSession(emptyProgress(), 'chess:a', [{ key: 'x', correct: true }], day(1, 7), { title: 'Forks', mins: 4 });
  p = finishPractice(p, 'calm', 'calm:breathe1', day(1, 13), { title: 'Breathing', mins: 2 });
  p = logToday(p, 'walk', 'Walked', day(1, 23));
  assert.deepEqual(p.log.map((e) => e.hour), [7, 13, 23]);
  p = finishPractice(p, 'calm', null, day(2, 0));
  assert.equal(p.log.at(-1).hour, 0, 'midnight is hour 0');
});

test('a practice closed part-way goes in `left`, with how far it got, and never the log', () => {
  const p = leavePractice(emptyProgress(), 'calm', 'calm:breathe1', 3, 12, day(1, 21), { title: 'The long out-breath' });
  assert.deepEqual(p.left, [{ date: '2026-10-01', hour: 21, habit: 'calm', lessonId: 'calm:breathe1', title: 'The long out-breath', step: 3, of: 12 }]);
  assert.deepEqual(p.log, []);
  // Closed on the teach card: nothing ran, and the routine wasn't built, so its length is unknown.
  assert.deepEqual(leavePractice(p, 'move', 'move:wake1', 0, null, day(1)).left.at(-1),
    { date: '2026-10-01', hour: 12, habit: 'move', lessonId: 'move:wake1', title: 'Practice', step: 0, of: null });
});

test('`left` keeps a year, like the log, and leaving never prunes the log', () => {
  let p = finishPractice(emptyProgress(), 'calm', null, day(1));
  p = leavePractice(p, 'calm', 'calm:breathe2', 1, 12, day(1));
  p = leavePractice(p, 'calm', 'calm:breathe2', 2, 12, new Date(2027, 9, 2, 9));
  assert.deepEqual(p.left.map((e) => e.date), ['2027-10-02'], 'over a year old is dropped');
  assert.equal(p.log.length, 1);
});

test('a left practice changes no streak, day count, habit view, garden or first visit', () => {
  const before = finishPractice(emptyProgress(), 'calm', 'calm:breathe1', day(1));
  const after = leavePractice(before, 'calm', 'calm:breathe2', 5, 12, day(2));
  assert.deepEqual(after.habits, before.habits);
  assert.deepEqual(after.log, before.log);
  assert.deepEqual(habitDays(after, 'calm', 7, day(2)), habitDays(before, 'calm', 7, day(2)));
  assert.equal(light(after, day(2), 'calm'), light(before, day(2), 'calm'));
  assert.equal(currentStreak(after, day(2), 'calm'), 1);
  assert.deepEqual(garden(after, day(2)), garden(before, day(2)));
  // Someone whose only visit was a practice left part-way still sees nothing started.
  const fresh = leavePractice(emptyProgress(), 'move', 'move:wake1', 2, 9, day(1));
  assert.deepEqual(startedHabits(fresh, ['learn', 'move']), ['learn']);
  assert.equal(fresh.habits.move, undefined);
  assert.equal(showsIntro(fresh), true);
});

test('migrate v8 to v9: older saves gain an empty `left`; v9 keeps it and the hours; junk is refused', () => {
  assert.equal(VERSION, 9);
  const v8 = { ...roundTrip(finishPractice(emptyProgress(), 'calm', null, day(1))), version: 8 };
  delete v8.left;
  delete v8.log[0].hour;
  assert.deepEqual(migrate(roundTrip(v8)), { ...v8, version: VERSION, left: [] });
  const v9 = roundTrip(leavePractice(finishPractice(emptyProgress(), 'calm', null, day(1, 6)), 'calm', 'calm:sigh1', 0, 6, day(1, 22)));
  assert.deepEqual(migrate(roundTrip(v9)), v9, 'the file export round-trips `left` and `hour`');
  const left = v9.left[0];
  for (const bad of [
    { left: {} },
    { left: [{ ...left, hour: 24 }] },
    { left: [{ ...left, hour: 1.5 }] },
    { left: [{ ...left, hour: undefined }] },
    { left: [{ ...left, step: 7 }] },
    { left: [{ ...left, step: -1 }] },
    { left: [{ ...left, of: 0, step: 0 }] },
    { left: [{ ...left, step: 1, of: null }] },
    { left: [{ ...left, lessonId: 3 }] },
    { left: [{ ...left, date: 'today' }] },
    { log: [{ ...v9.log[0], hour: -1 }] },
    { log: [{ ...v9.log[0], hour: '6' }] },
  ]) assert.equal(migrate({ ...v9, ...bad }), null, JSON.stringify(bad));
});
