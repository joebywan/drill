import { test } from 'node:test';
import { EVENTS } from '../src/garden/events.js';
import assert from 'node:assert/strict';
import { emptyProgress, finishPractice, finishSession, migrate } from '../src/progress.js';
import { LANDMARKS, LIFE, LIFE_WORDS, RULES, STAGES, award, listed, courseStage, creatures, garden, gardenDays, grown, guide, mood, raisers, stage } from '../src/garden/model.js';
import { SPECIES } from '../src/cast/butterfly.js';
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

test('achievements: a flower per finished unit, an egg on the first day, a bee for a new habit', () => {
  const calm = subjects.find((s) => s.id === 'calm');
  const [unit] = calm.units;
  let p = emptyProgress();
  for (const l of unit.lessons) p = finishPractice(p, 'calm', `calm:${l.id}`, day(1));
  let { progress, newly } = award(p, day(1));
  assert.deepEqual(newly.map((r) => r.id).sort(), [`bee:calm`, 'egg:calm', `flower:calm:${unit.title}`]);
  assert.deepEqual(progress.garden.earned, { 'bee:calm': '2026-10-01', 'egg:calm': '2026-10-01', [`flower:calm:${unit.title}`]: '2026-10-01' });
  assert.deepEqual(award(progress, day(1)).newly, [], 'earned once');
  progress = practise(progress, 'calm', 6, 2);
  assert.deepEqual(award(progress, day(7)).newly.map((r) => r.id), ['hatched:calm', 'skin:daisy', 'garden:path'], 'and 7 days bring the path, and a daisy for Lumi');
  assert.equal(award(practise(emptyProgress(), 'learn', 1), day(1)).newly.length, 0, 'no bee and no egg for Learning itself');
  const g = garden(award(practise(emptyProgress(), 'move', 30), day(30)).progress, day(30)).plants.find((x) => x.habit === 'move');
  assert.deepEqual(g.visitors.map((v) => v.gift), ['bee']);
  assert.deepEqual(g.creatures.map((c) => [c.stage, c.species.name, c.on]), [['butterfly', 'Wanderer', '2026-10-30']]);
  assert.deepEqual(g.flowers, []);
});

test('landmarks: the whole garden\'s days, added across habits, bring one new piece each', () => {
  assert.equal(gardenDays(emptyProgress()), 0);
  let p = practise(practise(emptyProgress(), 'calm', 2), 'move', 1); // 3 days between them
  assert.equal(gardenDays(p), 3);
  const { progress, newly } = award(p, day(3));
  assert.ok(newly.some((r) => r.id === 'garden:path' && r.habit === null));
  assert.deepEqual(garden(progress, day(3)).landmarks.map((l) => l.gift), ['path']);
  const all = award(practise(emptyProgress(), 'calm', 90), day(90)).progress;
  assert.deepEqual(garden(all, day(90)).landmarks.map((l) => l.gift), LANDMARKS.map((l) => l.gift), 'in the order they arrive');
  assert.equal(new Set(LANDMARKS.map((l) => l.gift)).size, LANDMARKS.length, 'each one different');
  assert.ok(LANDMARKS.every((l, i) => !i || l.at > LANDMARKS[i - 1].at), 'one at a time');
});

test('each habit\'s visitors are their own species, and a retired birds:<habit> is kept but not drawn', () => {
  let p = practise(practise(emptyProgress(), 'calm', 8), 'move', 8);
  p = award(p, day(8)).progress;
  const g = garden(p, day(8));
  const sp = (h) => g.plants.find((x) => x.habit === h).visitors.map((v) => v.species);
  assert.notDeepEqual(sp('calm'), sp('move'));
  const old = { ...p, garden: { earned: { ...p.garden.earned, 'birds:calm': '2026-09-01' } } };
  assert.ok(garden(old, day(8)).plants.every((x) => x.visitors.every((v) => v.gift !== 'birds')));
  assert.equal(award(old, day(8)).progress.garden.earned['birds:calm'], '2026-09-01', 'never removed');
});

test('earned is permanent: a streak starting again or a trimmed log takes nothing back', () => {
  let { progress: p } = award(practise(emptyProgress(), 'calm', 30), day(30));
  const earned = { ...p.garden.earned };
  assert.ok(earned['emerged:calm'] && earned['garden:fence']);
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
    assert.ok(['flower', ...LIFE, 'bee', 'ladybird', ...LANDMARKS.map((l) => l.gift), ...EVENTS.map((e) => e.gift), 'skin'].includes(r.gift), r.id);
    assert.equal(r.test(p), false, r.id);
  }
  assert.equal(JSON.stringify(p), frozen);
});

// --- Raised butterflies: fixed progress, every boundary.
const course = (n) => ({ id: 'c', units: Array.from({ length: n }, (_, u) => ({ lessons: [{ id: `u${u}a` }, { id: `u${u}b` }] })) });
const finishedUnits = (c, d, extra = false) => ({ ...emptyProgress(), done: Object.fromEntries(c.units.slice(0, d).flatMap((u) => u.lessons.map((l) => [`c:${l.id}`, true]))
  .concat(extra && d < c.units.length ? [[`c:${c.units[d].lessons[0].id}`, true]] : [])) });

test('a 3-unit course moves one stage a unit: egg, caterpillar, chrysalis, butterfly', () => {
  const c = course(3);
  assert.equal(grown(emptyProgress(), c).stage, -1, 'no creature before a finished lesson');
  assert.equal(grown(finishedUnits(c, 0, true), c).stage, 0, 'an egg once a lesson is finished');
  assert.deepEqual(grown(finishedUnits(c, 0, true), c).next, { stage: 1, in: 1, unit: 'unit' });
  assert.deepEqual([1, 2, 3].map((d) => grown(finishedUnits(c, d), c).stage), [1, 2, 3]);
  assert.deepEqual(grown(finishedUnits(c, 1), c).next, { stage: 2, in: 1, unit: 'unit' });
  assert.equal(grown(finishedUnits(c, 3), c).next, null);
});

test('an 18-unit course: caterpillar from 1 to 16, bigger every unit, chrysalis at 17, butterfly at 18', () => {
  const c = course(18);
  assert.deepEqual([0, 1, 16, 17, 18].map((d) => courseStage(18, d)), [0, 1, 1, 2, 3]);
  const at = (d) => grown(finishedUnits(c, d), c);
  assert.equal(at(0).stage, -1);
  assert.equal(grown(finishedUnits(c, 0, true), c).stage, 0);
  for (let d = 2; d <= 16; d++) assert.ok(at(d).stage === 1 && at(d).growth > at(d - 1).growth, `bigger at ${d}`);
  assert.equal(at(1).growth, 0);
  assert.equal(at(16).growth, 1);
  assert.deepEqual(at(15).next, { stage: 2, in: 2, unit: 'unit' });
  assert.equal(LIFE_WORDS.next(at(15).next), '2 more units to its chrysalis');
  assert.equal(at(17).stage, 2);
  assert.equal(at(18).stage, 3);
});

test('a habit goes by days practised at its plant\'s stages: 1, 5, 14 and 30', () => {
  const calm = raisers(emptyProgress()).find((r) => r.id === 'calm');
  const on = (d) => grown(practise(emptyProgress(), 'calm', d), calm);
  assert.equal(grown(emptyProgress(), calm).stage, -1);
  assert.deepEqual([1, 4, 5, 13, 14, 29, 30, 31].map((d) => on(d).stage), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.ok(on(13).growth > on(5).growth, 'the caterpillar grows until 14');
  assert.deepEqual(on(2).next, { stage: 1, in: 3, unit: 'day' });
  assert.equal(LIFE_WORDS.next(on(2).next), '3 more days to hatching');
  assert.equal(LIFE_WORDS.next(on(29).next), '1 more day to emerging');
});

test('a stage never goes back, and an emerged butterfly is recorded once, with its date', () => {
  const chess = subjects.find((s) => s.id === 'chess');
  let p = emptyProgress();
  for (const u of chess.units) for (const l of u.lessons) p = finishSession(p, `chess:${l.id}`, [], day(3));
  let newly;
  ({ progress: p, newly } = award(p, day(3)));
  assert.deepEqual(newly.filter((r) => r.raiser).map((r) => r.id), ['emerged:chess'], 'stages skipped at once announce only the latest');
  assert.ok(['egg', 'hatched', 'chrysalis', 'emerged'].every((k) => p.garden.earned[`${k}:chess`] === '2026-10-03'), 'but every one is kept');
  assert.equal(newly.find((r) => r.id === 'emerged:chess').text, 'Your Chess butterfly is out: a Chequered Swallowtail');
  assert.ok(award(p, day(9)).newly.every((r) => r.raiser !== 'chess'), 'once');
  // Progress that says less (a course growing a unit, a done lesson cleared) keeps the butterfly.
  const less = { ...p, done: {} };
  const c = creatures(less).find((x) => x.id === 'chess');
  assert.deepEqual([c.stage, c.on, c.habit], ['butterfly', '2026-10-03', 'learn']);
  assert.equal(award(less, day(10)).progress.garden.earned['emerged:chess'], '2026-10-03');
  // Courses sit on the Learning plant.
  assert.deepEqual(garden(p, day(3)).plants.find((x) => x.habit === 'learn').creatures.map((x) => x.id), ['chess']);
});

test('the field guide has every species once: raised, being raised, or what would raise it', () => {
  let p = practise(emptyProgress(), 'calm', 30);
  p = practise(p, 'move', 6);
  p = award(p, day(30)).progress;
  const g = guide(p);
  assert.equal(g.length, SPECIES.length);
  const of = (id) => g.find((e) => e.species.raisedBy === id);
  assert.deepEqual([of('calm').creature.stage, of('calm').by], ['butterfly', 'Calm']);
  assert.deepEqual([of('move').creature.stage, of('move').creature.next], ['caterpillar', { stage: 2, in: 8, unit: 'day' }]);
  assert.deepEqual([of('maths').creature, of('maths').by], [null, 'Maths']);
  assert.equal(of('walk').by, 'Walk');
  assert.equal(of('own').by, null);
  assert.equal(LIFE_WORDS.by(null), 'Raised by a habit of your own');
  assert.equal(LIFE_WORDS.raising(of('move').creature), 'Move is raising a Wanderer');
  assert.equal(LIFE_WORDS.raising(of('calm').creature), 'Calm raised a Common Brown');
});

test('arrivals: the biggest moment first (a stage, then a skin, a landmark, a visitor, a flower), and an end screen lists only so many', () => {
  // A whole Maths course at once: ten flowers, the chrysalis passed, the butterfly out, and Lumi's daisy and costume.
  const maths = subjects.find((s) => s.id === 'maths');
  let p = emptyProgress();
  for (const u of maths.units) for (const l of u.lessons) p = finishSession(p, `maths:${l.id}`, [], day(1));
  p = practise(p, 'calm', 14, 2);
  const { newly } = award(p, day(15));
  const ids = newly.map((r) => r.id);
  assert.deepEqual(ids.slice(0, 3), ['emerged:maths', 'chrysalis:calm', 'skin:daisy']);
  const kind = (id) => id.split(':')[0];
  const order = ['emerged', 'chrysalis', 'skin', 'garden', 'bee', 'flower'];
  assert.deepEqual(ids.map(kind).filter((k, i, a) => a.indexOf(k) === i), order.filter((k) => ids.some((id) => kind(id) === k)), 'grouped in that order');
  assert.ok(ids.indexOf('garden:path') < ids.indexOf('bee:calm') && ids.indexOf('bee:calm') < ids.findIndex((id) => id.startsWith('flower:')));
  const lesson = listed(newly);
  assert.deepEqual(lesson.shown.map((r) => r.id), ids.slice(0, 3), 'three lines after a lesson, skins included');
  assert.equal(lesson.more, newly.length - 3);
  assert.deepEqual(listed(newly, 2).shown.map((r) => r.id), ['emerged:maths', 'chrysalis:calm'], 'two above "How do you feel?"');
  assert.deepEqual(listed(newly.slice(0, 2), 2), { shown: newly.slice(0, 2), more: 0 }, 'no "more" line when everything fits');
});
