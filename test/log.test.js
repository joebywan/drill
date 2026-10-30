import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, emptyProgress, finishPractice, light, logToday, migrate, startedHabits, track, unlogToday } from '../src/progress.js';
import { HABITS, OWN_ICONS, OWN_PLANTS, PRESETS, habitsFor } from '../src/subjects.js';
import { RULES, award, garden, mood, rules } from '../src/garden/model.js';
import { KINDS } from '../src/garden/art.js';

const day = (d, h = 12) => new Date(2026, 9, d, h);
const roundTrip = (v) => JSON.parse(JSON.stringify(v));
const ids = (p) => habitsFor(p).map((h) => h.id);

test('habitsFor: the built-in habits, then presets and the learner\'s own in the order added', () => {
  assert.deepEqual(ids(emptyProgress()), HABITS.map((h) => h.id), 'nothing is tracked by default');
  assert.deepEqual(ids(null), HABITS.map((h) => h.id));
  let p = track(emptyProgress(), { id: 'read' });
  p = track(p, { name: 'Stretch', icon: '🧘', plant: 'fern' });
  p = track(p, { id: 'walk' });
  assert.deepEqual(ids(p), [...HABITS.map((h) => h.id), 'read', 'own-1', 'walk']);
  const [read, own, walk] = habitsFor(p).slice(HABITS.length);
  assert.deepEqual(read, { ...PRESETS[1], hidden: false, kind: 'log' });
  assert.equal(walk.did, 'I walked today');
  assert.deepEqual(own, { id: 'own-1', name: 'Stretch', icon: '🧘', plant: 'fern', did: 'Done today', title: 'Stretch', hidden: false, own: true, kind: 'log' });
  for (const h of HABITS) assert.equal(habitsFor(p).find((x) => x.id === h.id).kind, undefined, 'built-ins unchanged');
});

test('habitsFor skips what it cannot show, and falls back to a known icon and plant', () => {
  const p = { ...emptyProgress(), tracked: [{ id: 'calm', name: 'Not Calm' }, { id: 'nameless' }, { id: 'own-3', name: 'Tea', icon: '💣', plant: 'triffid' }] };
  const mine = habitsFor(p).slice(HABITS.length);
  assert.deepEqual(mine.map((h) => h.id), ['own-3'], 'a built-in id and an entry with no name are skipped');
  assert.equal(mine[0].icon, OWN_ICONS[0]);
  assert.equal(mine[0].plant, OWN_PLANTS[0]);
  assert.equal(habitsFor(p).filter((h) => h.id === 'calm').length, 1);
});

test('every preset and own plant is a drawing the garden has, and presets have plants of their own', () => {
  for (const k of [...OWN_PLANTS, ...PRESETS.map((x) => x.plant)]) assert.ok(KINDS.includes(k), k);
  assert.equal(new Set(PRESETS.map((x) => x.plant)).size, PRESETS.length);
  assert.equal(new Set(PRESETS.map((x) => x.id)).size, PRESETS.length);
});

test('track: new own ids never reuse one, renaming merges, hiding keeps the entry', () => {
  let p = track(emptyProgress(), { name: '  Stretch  ' });
  p = track(p, { name: 'Tea' });
  assert.deepEqual(p.tracked.map((t) => [t.id, t.name]), [['own-1', 'Stretch'], ['own-2', 'Tea']]);
  p = track(p, { id: 'own-1', name: 'Long stretch', plant: 'rose' });
  assert.deepEqual(p.tracked[0], { id: 'own-1', name: 'Long stretch', plant: 'rose' });
  p = track(p, { id: 'own-1', hidden: true });
  assert.equal(p.tracked[0].name, 'Long stretch');
  assert.equal(habitsFor(p).find((h) => h.id === 'own-1').hidden, true, 'hidden, still known');
  p = track(p, { name: 'x'.repeat(80) });
  assert.equal(p.tracked.at(-1).id, 'own-3');
  assert.equal(p.tracked.at(-1).name.length, 30);
  p = track(p, { id: 'own-2', name: '   ' });
  assert.equal(p.tracked[1].name, 'Tea', 'a blank rename keeps the name');
  assert.ok(migrate(roundTrip(p)), 'what track makes, migrate accepts');
});

test('logToday is one tap a day through the finish path: streak, days, log and award', () => {
  let p = track(emptyProgress(), { id: 'walk' });
  p = logToday(p, 'walk', 'Walked', day(1));
  assert.deepEqual(p.habits.walk, { count: 1, last: '2026-10-01', forgiven: [], days: 1 });
  assert.deepEqual(p.log, [{ date: '2026-10-01', habit: 'walk', title: 'Walked', mins: 0, was: null }]);
  assert.equal(logToday(p, 'walk', 'Walked', day(1, 20)), p, 'a second tap the same day changes nothing');
  assert.equal(light(p, day(1), 'walk'), 'bright');
  const { newly } = award(p, day(1));
  assert.deepEqual(newly.map((r) => r.id), ['bee:walk']);
  assert.equal(newly[0].text, 'A bee found Walk');
  // It follows the same forgiving rules as any habit.
  p = logToday(p, 'walk', 'Walked', day(3));
  assert.equal(p.habits.walk.count, 2, 'one missed day forgiven');
  assert.equal(p.habits.walk.days, 2);
});

test('unlogToday puts back exactly what today\'s tap did', () => {
  let p = track(emptyProgress(), { id: 'walk' });
  for (const d of [1, 2, 4]) p = logToday(p, 'walk', 'Walked', day(d)); // day 3 forgiven
  const before = roundTrip(p);
  const tapped = logToday(p, 'walk', 'Walked', day(5));
  assert.equal(tapped.habits.walk.days, 4);
  const undone = unlogToday(tapped, 'walk', day(5, 22));
  assert.deepEqual(undone, before, 'streak, forgiven days, days and log all as before');
  // And again after an undo: the tap counts once.
  const again = logToday(undone, 'walk', 'Walked', day(5));
  assert.deepEqual(again, tapped);
});

test('unlogToday only works the same day, only on a log tap, and never touches the garden', () => {
  let p = track(emptyProgress(), { id: 'walk' });
  p = logToday(p, 'walk', 'Walked', day(1));
  p = award(p, day(1)).progress;
  assert.equal(unlogToday(p, 'walk', day(2)), p, 'yesterday stays');
  assert.equal(unlogToday(p, 'read', day(1)), p, 'another habit has nothing to undo');
  const calm = finishPractice(p, 'calm', null, day(1));
  assert.equal(unlogToday(calm, 'calm', day(1)), calm, 'a practice session is not undone');
  const undone = unlogToday(p, 'walk', day(1));
  assert.equal(undone.habits.walk, undefined, 'a first tap undone leaves no streak');
  assert.deepEqual(undone.log, []);
  assert.deepEqual(undone.garden.earned, p.garden.earned, 'earned stays earned');
  assert.ok(undone.garden.earned['bee:walk']);
  assert.deepEqual(award(logToday(undone, 'walk', 'Walked', day(1)), day(1)).newly, [], 'nothing arrives twice');
});

test('undo never lowers days below what they were before today, across a long run', () => {
  let p = track(emptyProgress(), { name: 'Stretch' });
  for (let d = 1; d <= 60; d++) {
    if (d % 4 === 0) continue;
    const now = new Date(2026, 0, d, 9);
    const before = p.habits['own-1']?.days || 0;
    p = logToday(p, 'own-1', 'Stretch', now);
    if (d % 3 === 0) {
      p = unlogToday(p, 'own-1', now);
      assert.equal(p.habits['own-1']?.days || 0, before, `day ${d}`);
      p = logToday(p, 'own-1', 'Stretch', now);
    }
    assert.equal(p.habits['own-1'].days, before + 1, `day ${d}`);
  }
});

test('migrate: v4 gains an empty tracked list; tracked and log taps survive a save', () => {
  const v4 = { version: 4, habits: { learn: { count: 0, last: null, forgiven: [], days: 0 } }, log: [], done: {}, cards: {}, journal: {}, garden: { earned: {} } };
  assert.deepEqual(migrate(roundTrip(v4)), { ...v4, version: VERSION, tracked: [] });
  assert.equal(VERSION, 5);
  let p = track(track(emptyProgress(), { id: 'water' }), { name: '<b>Stretch</b>', icon: '🎵', plant: 'mushroom' });
  p = logToday(logToday(p, 'water', 'Drank water', day(1)), 'own-1', '<b>Stretch</b>', day(1));
  assert.deepEqual(migrate(roundTrip(p)), p);
  assert.deepEqual(unlogToday(migrate(roundTrip(p)), 'water', day(1)).habits.water, undefined, 'undo still works after a reload');
});

test('migrate refuses a bad tracked list or a bad undo record, so an import never brings one in', () => {
  const good = emptyProgress();
  const bad = [
    { tracked: 'walk' }, { tracked: [null] }, { tracked: [{ id: 'Walk' }] }, { tracked: [{ id: 'a b' }] },
    { tracked: [{ id: '"><script>' }] }, { tracked: [{ id: 'x'.repeat(41) }] },
    { tracked: [{ id: 'walk' }, { id: 'walk' }] }, { tracked: [{ id: 'own-1', name: '' }] },
    { tracked: [{ id: 'own-1', name: 'x'.repeat(31) }] }, { tracked: [{ id: 'own-1', name: 5 }] },
    { tracked: [{ id: 'own-1', name: 'a', icon: 'x'.repeat(17) }] }, { tracked: [{ id: 'own-1', name: 'a', hidden: 'yes' }] },
    { log: [{ date: '2026-10-01', habit: 'walk', title: 'Walked', was: { count: -1, last: null } }] },
  ];
  for (const b of bad) assert.equal(migrate({ ...good, ...b }), null, JSON.stringify(b));
  assert.ok(migrate({ ...good, tracked: [{ id: 'own-1', name: 'a', icon: '⭐', plant: 'fern', hidden: true }] }));
});

test('rules and the garden follow the habit list: own habits earn visitors, hidden ones keep their plant', () => {
  assert.deepEqual(rules(emptyProgress()).map((r) => r.id), RULES.map((r) => r.id), 'RULES are the built-in habits\'');
  let p = track(emptyProgress(), { name: 'Stretch', plant: 'mushroom' });
  for (let d = 1; d <= 30; d++) p = logToday(p, 'own-1', 'Stretch', day(d));
  const { progress, newly } = award(p, day(30));
  assert.deepEqual(newly.map((r) => r.id).sort(), ['bee:own-1', 'birds:own-1', 'butterfly:own-1']);
  assert.equal(newly.find((r) => r.gift === 'bee').text, 'A bee found Stretch');
  assert.ok(startedHabits(progress, ids(progress)).includes('own-1'));
  const plant = garden(progress, day(30)).plants.find((x) => x.habit === 'own-1');
  assert.equal(plant.plant, 'mushroom');
  assert.equal(plant.name, 'full grown');
  assert.equal(plant.visitors.length, 3);
  assert.equal(garden(progress, day(30)).plants.find((x) => x.habit === 'learn').plant, undefined);
  const renamed = track(progress, { id: 'own-1', name: 'Morning stretch' });
  assert.equal(garden(renamed, day(30)).plants.find((x) => x.habit === 'own-1').visitors.find((v) => v.gift === 'bee').text, 'A bee found Morning stretch');
  const hidden = track(progress, { id: 'own-1', hidden: true });
  assert.ok(garden(hidden, day(30)).plants.some((x) => x.habit === 'own-1'), 'hiding keeps the plant');
  assert.equal(mood(progress, day(30)), 'sunlit', 'a log tap lights the garden');
  assert.deepEqual(award(hidden, day(31)).newly, []);
});
