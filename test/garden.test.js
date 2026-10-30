import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, finishPractice, finishSession, migrate } from '../src/progress.js';
import { RULES, STAGES, award, garden, mood, stage } from '../src/garden/model.js';
import { subjects } from '../src/subjects.js';

const day = (d, h = 12) => new Date(2026, 9, d, h);
const practise = (p, habit, days, from = 1) => {
  for (let d = from; d < from + days; d++) p = finishPractice(p, habit, null, day(d));
  return p;
};

test('stages: seed, then later stages take more days, with a hint towards the next', () => {
  assert.deepEqual(stage(0), { stage: 0, name: 'seed', next: { name: 'sprout', in: 1, progress: 0 } });
  assert.equal(stage(1).name, 'sprout');
  assert.deepEqual(stage(9).next, { name: 'young', in: 5, progress: 4 / 9 });
  assert.deepEqual(stage(30), { stage: 4, name: 'full grown', next: null });
  assert.equal(stage(5000).stage, 4);
  const gaps = STAGES.slice(1).map((s, i) => s.at - STAGES[i].at);
  assert.ok(gaps.every((g, i) => i === 0 || g > gaps[i - 1]), 'each stage takes longer than the last');
});

test('growth never goes backwards', () => {
  for (let d = 1; d < 400; d++) {
    assert.ok(stage(d).stage >= stage(d - 1).stage, `day ${d}`);
    const { next } = stage(d);
    if (next) assert.ok(next.progress >= 0 && next.progress < 1 && next.in > 0, `day ${d}`);
  }
});

test('a plant grows from days practised, not the streak', () => {
  let p = practise(emptyProgress(), 'calm', 5); // sapling
  p = finishPractice(p, 'calm', null, day(20)); // the streak starts again
  const calm = garden(p, day(20)).plants.find((x) => x.habit === 'calm');
  assert.equal(p.habits.calm.count, 1);
  assert.equal(calm.days, 6);
  assert.equal(calm.name, 'sapling');
});

test('the mood follows the light: sunlit once anything is done, resting only when all are ember', () => {
  assert.equal(mood(emptyProgress(), day(1)), 'morning');
  let p = finishPractice(emptyProgress(), 'calm', null, day(1));
  p = finishSession(p, 'a', [], day(2));
  assert.equal(mood(p, day(2)), 'sunlit', 'Learning is done, Calm is not');
  assert.equal(mood(p, day(3)), 'morning', 'Learning is soft, Calm ember');
  assert.equal(mood(p, day(10)), 'resting');
  assert.equal(mood(practise(emptyProgress(), 'calm', 1), day(10)), 'resting', 'Learning never started does not count');
});

test('achievements: a flower per finished unit, a butterfly at 7 in a row, birds at 30 days, a bee for a new habit', () => {
  const calm = subjects.find((s) => s.id === 'calm');
  const [unit] = calm.units;
  let p = emptyProgress();
  for (const l of unit.lessons) p = finishPractice(p, 'calm', `calm:${l.id}`, day(1));
  let { progress, newly } = award(p, day(1));
  assert.deepEqual(newly.map((r) => r.id).sort(), [`bee:calm`, `flower:calm:${unit.title}`]);
  assert.deepEqual(progress.garden.earned, { 'bee:calm': '2026-10-01', [`flower:calm:${unit.title}`]: '2026-10-01' });
  assert.deepEqual(award(progress, day(1)).newly, [], 'earned once');
  progress = practise(progress, 'calm', 6, 2);
  assert.deepEqual(award(progress, day(7)).newly.map((r) => r.id), ['butterfly:calm']);
  assert.equal(award(practise(emptyProgress(), 'learn', 1), day(1)).newly.length, 0, 'no bee for Learning');
  const thirty = practise(emptyProgress(), 'move', 30);
  assert.ok(award(thirty, day(30)).newly.some((r) => r.id === 'birds:move'));
  const g = garden(award(thirty, day(30)).progress, day(30)).plants.find((x) => x.habit === 'move');
  assert.deepEqual(g.visitors.map((v) => v.gift).sort(), ['bee', 'birds', 'butterfly']);
  assert.deepEqual(g.flowers, []);
});

test('earned is permanent: a streak starting again or a trimmed log takes nothing back', () => {
  let { progress: p } = award(practise(emptyProgress(), 'calm', 30), day(30));
  const earned = { ...p.garden.earned };
  assert.ok(earned['butterfly:calm'] && earned['birds:calm']);
  p = finishPractice(p, 'calm', null, new Date(2028, 0, 1)); // long gap: the streak is 1, the log trimmed
  assert.equal(p.habits.calm.count, 1);
  assert.equal(p.log.length, 1);
  p = award(p, new Date(2028, 0, 1)).progress;
  assert.deepEqual(p.garden.earned, earned);
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(p))).garden.earned, earned, 'and survives a save');
});

test('nothing in the garden model lowers a stage or removes an earned item', () => {
  // Every kind of session, in a long and gappy order, through the real finish functions.
  let p = emptyProgress();
  let before = { stages: {}, earned: {} };
  const ids = subjects.map((s) => ({ s, ls: s.units.flatMap((u) => u.lessons.map((l) => `${s.id}:${l.id}`)) }));
  for (let i = 0; i < 300; i++) {
    const now = new Date(2026, 0, 1 + Math.floor(i * 1.7) + (i % 37 === 0 ? 20 : 0));
    const { s, ls } = ids[i % ids.length];
    const lesson = i % 3 ? ls[(i / ids.length | 0) % ls.length] : null;
    p = s.kind === 'learn' ? finishSession(p, lesson, [], now) : finishPractice(p, s.habit, lesson, now);
    p = award(p, now).progress;
    for (const id of Object.keys(before.earned)) assert.equal(p.garden.earned[id], before.earned[id], `${id} at ${i}`);
    const g = garden(p, now);
    for (const plant of g.plants) assert.ok(plant.stage >= (before.stages[plant.habit] ?? 0), `${plant.habit} at ${i}`);
    before = { earned: { ...p.garden.earned }, stages: Object.fromEntries(g.plants.map((x) => [x.habit, x.stage])) };
  }
  assert.ok(Object.keys(p.garden.earned).length > 10, 'the walk earned things');
});

test('every rule has a unique id, a known gift and a pure test', () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  const p = emptyProgress();
  const frozen = JSON.stringify(p);
  for (const r of RULES) {
    assert.ok(['flower', 'butterfly', 'birds', 'bee'].includes(r.gift), r.id);
    assert.equal(r.test(p), false, r.id);
  }
  assert.equal(JSON.stringify(p), frozen);
});
