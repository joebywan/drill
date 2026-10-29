import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, emptyProgress, finishSession, finishPractice, writeJournal, noteFeel, currentStreak, dueKeys, habitDays, light, migrate, needsRepair, startedHabits } from '../src/progress.js';

const day = (d, h = 12) => new Date(2026, 9, d, h);
const roundTrip = (p) => JSON.parse(JSON.stringify(p)); // as it comes back out of localStorage

test('streak counts consecutive days, once per day', () => {
  let p = emptyProgress();
  p = finishSession(p, 'a', [], day(1));
  p = roundTrip(finishSession(p, 'b', [], day(1, 20)));
  assert.equal(p.habits.learn.count, 1);
  p = finishSession(p, 'c', [], day(2, 0));
  assert.equal(currentStreak(p, day(3)), 2, 'alive the day after');
});

test('one missed day is forgiven without asking', () => {
  let p = finishSession(finishSession(emptyProgress(), 'a', [], day(1)), 'b', [], day(2));
  assert.equal(currentStreak(p, day(4)), 2, 'holds through the missed day');
  p = finishSession(p, 'c', [], day(4));
  assert.equal(p.habits.learn.count, 3);
  assert.deepEqual(p.habits.learn.forgiven, ['2026-10-04']);
});

test('a second gap in the same week needs a review, and a lesson waits for it', () => {
  let p = finishSession(finishSession(emptyProgress(), 'a', [], day(1)), 'b', [], day(3)); // day 2 forgiven
  assert.equal(needsRepair(p, day(5)), true, 'day 4 missed, the allowance is used');
  const lessonOnly = finishSession(p, 'c', [], day(5));
  assert.deepEqual(lessonOnly.habits.learn, p.habits.learn, 'a lesson leaves it waiting');
  assert.equal(light(lessonOnly, day(5)), 'ember');
  p = finishSession(lessonOnly, null, [], day(5));
  assert.equal(p.habits.learn.count, 3);
  assert.equal(light(p, day(5)), 'bright');
});

test('a gap of up to three days is repaired by a review; four is too long', () => {
  const p = finishSession(emptyProgress(), 'a', [], day(1));
  assert.equal(finishSession(p, null, [], day(5)).habits.learn.count, 2, 'days 2-4 missed, repaired');
  assert.equal(currentStreak(p, day(6)), 0, 'days 2-5 missed');
  assert.equal(finishSession(p, null, [], day(6)).habits.learn.count, 1);
});

test('streak crosses a month boundary', () => {
  const p = finishSession(finishSession(emptyProgress(), 'a', [], new Date(2026, 8, 30)), 'b', [], new Date(2026, 9, 1));
  assert.equal(p.habits.learn.count, 2);
});

test('lessons unlock, reviews do not', () => {
  const answers = [{ key: 'x', correct: true }, { key: 'y', correct: false }];
  assert.deepEqual(finishSession(emptyProgress(), null, answers, day(1)).done, {});
  assert.ok(finishSession(emptyProgress(), 'chess:l1', answers, day(1)).done['chess:l1']);
});

test('a session keeps the placement and the version', () => {
  const p = finishSession({ ...emptyProgress(), start: 'Forks' }, 'chess:l1', [], day(1));
  assert.equal(p.start, 'Forks');
  assert.equal(p.version, VERSION);
});

test('migrate brings every older shape up to the current one', () => {
  const card = finishSession(emptyProgress(), null, [{ key: 'x', correct: true }], day(1)).cards.x;
  // The first build: xp, and a streak with no forgiven days.
  const first = { xp: 40, streak: { count: 3, last: '2026-10-01' }, done: { 'chess:l1': true }, cards: { x: card } };
  const p = migrate(roundTrip(first));
  assert.equal(p.version, VERSION);
  assert.equal('xp' in p, false, 'old points are dropped');
  assert.deepEqual(p.habits.learn, { count: 3, last: '2026-10-01', forgiven: [] });
  assert.deepEqual(p.done, first.done);
  assert.deepEqual(p.cards, roundTrip(first.cards));
  // Today's unversioned shape, without xp, keeps its placement.
  const v0 = { streak: { count: 0, last: null, forgiven: [] }, done: {}, cards: {}, start: 'Forks' };
  assert.deepEqual(migrate(v0), { version: VERSION, habits: { learn: v0.streak }, log: [], done: {}, cards: {}, journal: {}, start: 'Forks' });
  // Version 1: the one streak becomes Learning's, and there is no log yet.
  const v1 = { ...v0, version: 1, streak: { count: 4, last: '2026-10-29', forgiven: [] } };
  assert.deepEqual(migrate(v1).habits, { learn: v1.streak });
  // Version 2: habits and a log, but no journal yet; it gains an empty one and keeps the rest.
  const v2 = { version: 2, habits: { learn: v1.streak, calm: { count: 1, last: '2026-10-29', forgiven: [] } },
    log: [{ date: '2026-10-29', habit: 'calm', title: 'Breathing', mins: 2 }], done: { 'calm:breathe1': true }, cards: {} };
  assert.deepEqual(migrate(roundTrip(v2)), { ...v2, version: VERSION, journal: {} });
  // The current shape passes through unchanged, and so does one from a newer build.
  assert.deepEqual(migrate(roundTrip(p)), p);
  assert.deepEqual(migrate({ ...p, version: VERSION + 1, extra: 1 }), { ...p, version: VERSION + 1, extra: 1 });
});

test('migrate refuses anything that is not progress, so an import never replaces good progress', () => {
  const good = emptyProgress();
  const v1 = { version: 1, streak: { count: 0, last: null, forgiven: [] }, done: {}, cards: {} };
  const bad = [
    null, 'text', 42, [], {}, { streak: {} },
    { ...v1, streak: undefined },
    { ...v1, streak: { count: -1, last: null } },
    { ...v1, streak: { count: 1.5, last: null } },
    { ...v1, streak: { count: '3', last: null } },
    { ...v1, streak: { count: 1, last: 'yesterday' } },
    { ...v1, streak: { count: 1, last: null, forgiven: 'no' } },
    { ...good, done: [] },
    { ...good, cards: null },
    { ...good, habits: undefined },
    { ...good, habits: { calm: { count: -2, last: null } } },
    { ...good, log: 'none' },
    { ...good, log: [{ date: 'today', habit: 'learn', title: 'x' }] },
    { ...good, cards: { x: { due: 'never' } } },
    { ...good, cards: { x: 1 } },
    { ...good, start: 3 },
    { ...good, journal: [] },
    { ...good, journal: { today: { good: 'x' } } },
    { ...good, journal: { '2026-10-30': 'x' } },
    { ...good, journal: { '2026-10-30': { good: 3 } } },
  ];
  for (const b of bad) assert.equal(migrate(b), null, JSON.stringify(b));
  assert.deepEqual(migrate(good), good);
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

test('each habit keeps its own streak, and practice repairs its own gap', () => {
  let p = finishSession(emptyProgress(), 'chess:a', [], day(1), { title: 'Forks', mins: 5 });
  p = finishPractice(p, 'calm', 'calm:breathe1', day(1), { title: 'Breathing', mins: 2 });
  p = finishPractice(p, 'calm', null, day(2));
  assert.equal(currentStreak(p, day(2), 'calm'), 2);
  assert.equal(currentStreak(p, day(2)), 1, 'calm does not keep Learning going');
  assert.equal(light(p, day(2), 'calm'), 'bright');
  assert.equal(light(p, day(2)), 'soft');
  assert.equal(p.done['calm:breathe1'], true);
  // Days 3 and 4 missed (the forgiven allowance only covers one): a practice session repairs it.
  assert.equal(needsRepair(p, day(5), 'calm'), true);
  assert.equal(finishPractice(p, 'calm', null, day(5)).habits.calm.count, 3);
});

test('the log records what was done, and keeps a year', () => {
  let p = finishSession(emptyProgress(), 'chess:a', [{ key: 'x', correct: true }, { key: 'y', correct: false }], day(1), { title: 'Forks', mins: 6 });
  p = finishPractice(p, 'calm', null, day(1), { title: 'Breathing', mins: 2 });
  p = noteFeel(p, 'calm', 'calmer');
  assert.deepEqual(p.log, [
    { date: '2026-10-01', habit: 'learn', title: 'Forks', mins: 6, right: 1, of: 2 },
    { date: '2026-10-01', habit: 'calm', title: 'Breathing', mins: 2, feel: 'calmer' },
  ]);
  const later = finishPractice(p, 'calm', null, new Date(2027, 9, 2, 9));
  assert.deepEqual(later.log.map((e) => e.date), ['2027-10-02'], 'sessions over a year old are dropped');
});

test('habits show once started, and the habit view lists each day', () => {
  let p = emptyProgress();
  assert.deepEqual(startedHabits(p, ['learn', 'calm']), ['learn']);
  p = finishPractice(p, 'calm', null, day(3), { title: 'Grounding', mins: 3 });
  assert.deepEqual(startedHabits(p, ['learn', 'calm']), ['learn', 'calm']);
  const week = habitDays(p, 'calm', 7, day(4));
  assert.deepEqual(week.map((d) => d.date), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(week.map((d) => d.sessions.length), [0, 0, 0, 0, 0, 1, 0]);
});

test('Reflect lines are kept by day, blanks left out, and a second visit adds to the first', () => {
  const now = new Date(2026, 9, 30, 20);
  let p = writeJournal(emptyProgress(), { good: ' Tea in the sun ', learned: '', tomorrow: 'Call Sam' }, now);
  assert.deepEqual(p.journal, { '2026-10-30': { good: 'Tea in the sun', tomorrow: 'Call Sam' } });
  p = writeJournal(p, { learned: 'Honey keeps' }, now);
  assert.deepEqual(p.journal['2026-10-30'], { good: 'Tea in the sun', tomorrow: 'Call Sam', learned: 'Honey keeps' });
  // Nothing written keeps nothing, and the text never goes in the log.
  const q = emptyProgress();
  assert.equal(writeJournal(q, {}, now), q);
  assert.equal(writeJournal(q, null, now), q);
  const done = writeJournal(finishPractice(q, 'reflect', 'reflect:reflect1', now, { title: 'Reflect', mins: 1 }), { good: 'A walk' }, now);
  assert.deepEqual(done.log, [{ date: '2026-10-30', habit: 'reflect', title: 'Reflect', mins: 1 }]);
  assert.equal(done.habits.reflect.count, 1);
  assert.deepEqual(migrate(roundTrip(done)), done);
});
