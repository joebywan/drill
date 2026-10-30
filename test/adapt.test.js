import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEEP, easier, flying, misses, noteAnswer, struggling } from '../src/adapt.js';
import { emptyProgress, migrate } from '../src/progress.js';
import { echoes, warmUps } from '../src/repeat.js';
import { merge } from '../src/sync/merge.js';
import { subjects } from '../src/subjects.js';
import unitHelp from '../src/data/help.json' with { type: 'json' };

const log = (...rights) => rights.map((right, i) => ({ key: `c:${i}`, right, ms: 1000, at: `2026-01-01T00:00:0${i}Z` }));
const all = () => true;

test('two misses in the last four answers of a unit is struggling; older ones have faded', () => {
  assert.equal(struggling(log(false, false), all), true);
  assert.equal(struggling(log(false, true, true, false), all), true);
  assert.equal(struggling(log(false, false, true, true, true, true), all), false);
  assert.equal(struggling(log(false), all), false);
  assert.equal(struggling(undefined, all), false);
  assert.equal(struggling(log(false, false), () => false), false, 'another unit');
});

test('eight right in a row is flying; one miss in them is not', () => {
  assert.equal(flying(log(...Array(8).fill(true)), all), true);
  assert.equal(flying(log(...Array(7).fill(true)), all), false);
  assert.equal(flying(log(false, ...Array(7).fill(true)), all), false);
});

test('the log keeps the newest answers only, and a bad one never loses a save', () => {
  let p = emptyProgress();
  for (let i = 0; i < KEEP + 5; i++) p = noteAnswer(p, { key: `k${i}`, right: true, ms: 1 });
  assert.equal(p.answers.length, KEEP);
  assert.equal(p.answers.at(-1).key, `k${KEEP + 4}`);
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(p))).answers, p.answers);
  const bad = migrate({ ...JSON.parse(JSON.stringify(emptyProgress())), answers: 'nope' });
  assert.ok(bad);
  assert.equal(bad.answers, undefined);
});

test('repeats favour what was missed', () => {
  const missed = misses([{ key: 'c:b', right: false }, { key: 'c:b', right: false }, { key: 'c:a', right: true }]);
  assert.deepEqual(missed, { 'c:b': 2 });
  const cards = { 'c:a': { due: '2026-01-01' }, 'c:b': { due: '2026-02-01' } };
  assert.deepEqual(warmUps(cards, all, [], 1, missed), ['c:b']);
  const items = [{ id: 'a', type: 'x' }, { id: 'b', type: 'x' }];
  const got = echoes({ vary: (i) => i }, items, () => 0.9, 1, (i) => missed[`c:${i.id}`] ?? 0);
  assert.equal(got[0].source.id, 'b');
});

test('stepping back finds the nearest marked item before, or nothing', () => {
  const list = [{ id: 'a', type: 'x' }, { id: 't', type: 'teach' }, { id: 'b', type: 'x' }];
  assert.equal(easier(list, list[2]).id, 'a');
  assert.equal(easier(list, list[0]), null);
});

test('every Learn unit has a second explanation, and no explanation is for a unit that has gone', () => {
  for (const s of subjects.filter((x) => x.kind === 'learn')) {
    const titles = s.units.map((u) => u.title);
    for (const t of titles) assert.ok(unitHelp[s.id]?.[t], `${s.id}: ${t}`);
    assert.deepEqual(Object.keys(unitHelp[s.id]).sort(), [...titles].sort());
  }
});

test('sync merges both logs, each answer once', () => {
  const base = JSON.parse(JSON.stringify(emptyProgress()));
  const one = { key: 'a', right: true, ms: 1, at: '2026-01-01T00:00:00.000Z' };
  const two = { key: 'b', right: false, ms: 1, at: '2026-01-02T00:00:00.000Z' };
  const m = merge({ ...base, answers: [one, two] }, { ...base, answers: [one] });
  assert.deepEqual(m.answers, [one, two]);
});
