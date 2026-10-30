import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, emptyProgress, finishPractice, migrate, showsIntro, track } from '../src/progress.js';
import { habitsFor, ordered } from '../src/subjects.js';

const roundTrip = (v) => JSON.parse(JSON.stringify(v));
const ids = (list) => list.map((h) => h.id);

test('ordered puts the picks first, in the order picked, and keeps the rest as they were', () => {
  const p = track(track(emptyProgress(), { id: 'walk' }), { id: 'water' });
  const all = habitsFor(p);
  assert.deepEqual(ordered(all), all);
  assert.deepEqual(ordered(all, []), all);
  assert.deepEqual(ids(ordered(all, ['water', 'calm'])), ['water', 'calm', 'learn', 'break', 'reflect', 'move', 'focus', 'walk']);
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
  assert.deepEqual(p, { ...v6, version: VERSION, picked: [], timings: {} });
  assert.equal(showsIntro(p), false, 'someone who used Drill before never sees the intro');
  assert.equal(showsIntro(migrate(roundTrip(emptyProgress()))), true, 'a fresh save still does');
  const picked = { ...emptyProgress(), picked: ['walk', 'learn'] };
  assert.deepEqual(migrate(roundTrip(picked)), picked);
  for (const bad of ['calm', [1], ['<b>'], ['calm', 'calm']]) assert.equal(migrate({ ...emptyProgress(), picked: bad }), null, JSON.stringify(bad));
});
