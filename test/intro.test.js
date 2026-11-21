import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, emptyProgress, finishPractice, meetsCoach, metCoach, migrate, offersPlacement, placeAt, showsIntro, startHere, track, waits } from '../src/progress.js';
import { coursesFor, habitsFor, ordered, subjects } from '../src/subjects.js';

const roundTrip = (v) => JSON.parse(JSON.stringify(v));
const ids = (list) => list.map((h) => h.id);

test('ordered puts the picks first, in the order picked, and keeps the rest as they were', () => {
  const p = track(track(emptyProgress(), { id: 'walk' }), { id: 'water' });
  const all = habitsFor(p);
  assert.deepEqual(ordered(all), all);
  assert.deepEqual(ordered(all, []), all);
  assert.deepEqual(ids(ordered(all, ['water', 'calm'])), ['water', 'calm', 'learn', 'break', 'reflect', 'move', 'winddown', 'focus', 'walk']);
  assert.deepEqual(ids(ordered(all, ['learn'])), ids(all));
  assert.deepEqual(ids(ordered(all, ['gone', 'move'])), ['move', ...ids(all).filter((id) => id !== 'move')], 'an id not in the list is passed over');
  assert.equal(ordered(all, ['move', 'calm']).length, all.length);
});

test('the intro shows on a first visit only: once answered or skipped, or with anything done, never', () => {
  assert.equal(showsIntro(emptyProgress()), true);
  assert.equal(showsIntro({ ...emptyProgress(), picked: [] }), false, 'skipped');
  assert.equal(showsIntro({ ...emptyProgress(), picked: ['calm'] }), false, 'answered');
  assert.equal(showsIntro(finishPractice(emptyProgress(), 'calm', null)), false, 'a session');
  assert.equal(showsIntro({ ...emptyProgress(), done: { 'chess:l1': true } }), false, 'a lesson');
  assert.equal(showsIntro(track(emptyProgress(), { id: 'walk' })), false, 'a tracked habit');
});

test('migrate v6 to v7: an existing save is marked as past the intro; v7 keeps its picks', () => {
  const v6 = { version: 6, habits: { learn: { count: 0, last: null, forgiven: [], days: 0 } }, log: [], done: {}, cards: {},
    journal: {}, garden: { earned: {} }, tracked: [] };
  const p = migrate(roundTrip(v6));
  assert.deepEqual(p, { ...v6, version: VERSION, picked: [], timings: {}, left: [], wings: [] });
  assert.equal(showsIntro(p), false, 'someone who used Wingbeat before never sees the intro');
  assert.equal(showsIntro(migrate(roundTrip(emptyProgress()))), true, 'a fresh save still does');
  const picked = { ...emptyProgress(), picked: ['walk', 'learn'] };
  assert.deepEqual(migrate(roundTrip(picked)), picked);
  for (const bad of ['calm', [1], ['<b>'], ['calm', 'calm']]) assert.equal(migrate({ ...emptyProgress(), picked: bad }), null, JSON.stringify(bad));
});

test("a course's coach is met once, before its first lesson, and never by someone already on the course", () => {
  const subject = { id: 'coding', coach: { hello: { line: 'Hi' } } };
  assert.equal(meetsCoach(emptyProgress(), subject), true);
  assert.equal(meetsCoach(metCoach(emptyProgress(), 'coding'), subject), false);
  assert.equal(meetsCoach({ ...emptyProgress(), done: { 'coding:steps-0': true } }, subject), false);
  assert.equal(meetsCoach({ ...emptyProgress(), done: { 'chess:l1': true } }, subject), true, 'another course');
  assert.equal(meetsCoach(emptyProgress(), { id: 'calm', coach: {} }), false, 'a coach with no hello');
});

test("the intro's picks hide the rest the way + Habit does: a built-in or a course, kept, never none", () => {
  const p = track(track(track(emptyProgress(), { id: 'reflect', hidden: true }), { id: 'maths', hidden: true }), { id: 'walk' });
  const all = habitsFor(p);
  assert.equal(all.find((h) => h.id === 'reflect').hidden, true);
  assert.equal(all.find((h) => h.id === 'calm').hidden, undefined);
  assert.deepEqual(ids(all), ['learn', 'calm', 'break', 'reflect', 'move', 'winddown', 'focus', 'walk'], 'a course id is not a habit');
  assert.deepEqual(roundTrip(migrate(roundTrip(p))).tracked, p.tracked, 'kept through a save');
  const courses = subjects.filter((s) => s.kind === 'learn');
  assert.deepEqual(ids(coursesFor(p, courses)), ids(courses).filter((id) => id !== 'maths'));
  assert.deepEqual(ids(coursesFor(track(p, { id: 'maths', hidden: false }), courses)), ids(courses), 'shown again');
  const none = courses.reduce((q, s) => track(q, { id: s.id, hidden: true }), emptyProgress());
  assert.deepEqual(coursesFor(none, courses), courses, 'never an empty row');
  assert.deepEqual(coursesFor(emptyProgress(), courses), courses, 'a save from before shows what it showed');
});

test('a course that follows another waits for that much of it, unless the learner chooses to start here or already has', () => {
  const js = subjects.find((s) => s.id === 'javascript');
  for (const ts of subjects.filter((s) => s.follows)) {
    assert.equal(waits(emptyProgress(), ts, js), true, ts.id);
    const done = (n) => ({ ...emptyProgress(), done: Object.fromEntries(js.units.slice(0, n).flatMap((u) => u.lessons.filter((l) => !l.mix)).map((l) => [`javascript:${l.id}`, true])) });
    assert.equal(waits(done(ts.follows.units - 1), ts, js), true, 'one unit short');
    assert.equal(waits(done(ts.follows.units), ts, js), false, 'that much done, checkpoints or not');
    assert.equal(waits(startHere(emptyProgress(), ts.id), ts, js), false, 'I know JavaScript: start here');
    assert.equal(waits(placeAt(emptyProgress(), ts.id, ts.units[0].title), ts, js), false, 'a save from before, with the title in start');
    assert.equal(waits(placeAt(emptyProgress(), ts.id, ts.units[1].title), ts, js), false, 'its own skip ahead');
    assert.equal(waits(placeAt(emptyProgress(), ts.id, null), ts, js), true, 'dismissing its skip ahead is not choosing to start');
    assert.equal(waits({ ...emptyProgress(), done: { [`${ts.id}:${ts.units[0].lessons[0].id}`]: true } }, ts, js), false, 'already started');
  }
  assert.equal(waits(emptyProgress(), js, js), false, 'a course that follows nothing never waits');
});

test('"start here" is not a placement answer: the course still offers its own Skip ahead', () => {
  for (const ts of subjects.filter((s) => s.follows)) {
    const here = startHere(emptyProgress(), ts.id);
    assert.equal(offersPlacement(here, ts), true, ts.id);
    assert.equal(offersPlacement(placeAt(here, ts.id, null), ts), false, 'dismissed');
    assert.equal(offersPlacement(placeAt(emptyProgress(), ts.id, ts.units[0].title), ts), false, 'the old way asked it once');
  }
});

test('migrate keeps `started`, reading it leniently', () => {
  const p = startHere(emptyProgress(), 'typescript');
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(p))).started, { typescript: true });
  assert.equal('started' in migrate({ ...p, started: 'yes' }), false);
  assert.deepEqual(migrate({ ...p, started: { typescript: true, 'Bad Id': true, testing: 1 } }).started, { typescript: true });
});
