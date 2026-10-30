import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOES, KEEP, easier, flying, helpFor, misses, nextGo, noteAnswer, struggling, warmedLast } from '../src/adapt.js';
import { emptyProgress, migrate } from '../src/progress.js';
import { echoes, warmUps } from '../src/repeat.js';
import { merge } from '../src/sync/merge.js';
import { subjects } from '../src/subjects.js';
import unitHelp from '../src/data/help.json' with { type: 'json' };
import lessonHelp from '../src/data/lesson-help.json' with { type: 'json' };

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

test('a hinted right answer is logged, and counts as a miss', () => {
  const hinted = { key: 'c:h', right: true, hinted: true };
  const p = noteAnswer(emptyProgress(), { key: 'c:h', right: true, ms: 1, hinted: true, warm: false });
  assert.equal(p.answers[0].hinted, true);
  assert.equal('warm' in p.answers[0], false);
  assert.equal(struggling([hinted], all), false);
  assert.equal(struggling([hinted, hinted], all), true);
  assert.equal(struggling([hinted, hinted, ...log(false)], all), true);
  assert.equal(struggling([...log(false), hinted], all), true);
  assert.equal(flying([...log(...Array(7).fill(true)), hinted], all), false);
  assert.deepEqual(misses([hinted]), { 'c:h': 1 });
});

test('a warm-up is remembered in the log for the next lesson', () => {
  const answers = [{ key: 'c:a', warm: true }, { key: 'c:b' }, { key: 'x:d', warm: true }, { key: 'c:e', warm: true }];
  assert.deepEqual(warmedLast(answers, (k) => k.startsWith('c:'), 2), ['c:a', 'c:e']);
});

test('finishing on evidence: right first time ends it, one miss needs one right, more need two in a row', () => {
  const play = (...answers) => {
    let state = {};
    let goes = 0;
    for (const a of answers) {
      goes++;
      state = nextGo(state, a);
      if (!state) return goes;
    }
    return 'still going';
  };
  assert.equal(play(true), 1);
  assert.equal(play(false, true), 2);
  assert.equal(play(false, false, true), 'still going');
  assert.equal(play(false, false, true, true), 4);
  assert.equal(GOES, 4, 'two misses then two right has to fit in GOES');
  assert.equal(play(false, false, false, false), GOES, 'capped: never a loop');
  assert.equal(play(false, false, true, false), GOES);
  assert.equal(nextGo({}, false, 2).goes, 2);
  assert.equal(nextGo({ goes: 2, slips: 1 }, false, 2), null, 'DRILL_PLAIN gives a miss one more go');
});

test('lesson help wins over unit help, and only for lessons that exist', () => {
  assert.equal(helpFor('chess', 'How pieces move', 'moves-2'), lessonHelp.chess['moves-2']);
  assert.equal(helpFor('chess', 'How pieces move', 'nope'), unitHelp.chess['How pieces move']);
  for (const [id, lessons] of Object.entries(lessonHelp)) {
    const known = subjects.find((s) => s.id === id).units.flatMap((u) => u.lessons.map((l) => l.id));
    for (const lesson of Object.keys(lessons)) assert.ok(known.includes(lesson), lesson);
  }
  assert.ok(Object.keys(lessonHelp.coding).length && Object.keys(lessonHelp.maths).length);
});

test('sync merges both logs, each answer once', () => {
  const base = JSON.parse(JSON.stringify(emptyProgress()));
  const one = { key: 'a', right: true, ms: 1, at: '2026-01-01T00:00:00.000Z' };
  const two = { key: 'b', right: false, ms: 1, at: '2026-01-02T00:00:00.000Z' };
  const m = merge({ ...base, answers: [one, two] }, { ...base, answers: [one] });
  assert.deepEqual(m.answers, [one, two]);
});
