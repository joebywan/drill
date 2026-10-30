import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIMINGS, setTiming, timed } from '../src/practice/timings.js';
import { VERSION, emptyProgress, migrate } from '../src/progress.js';
import { breaths, hugTaps, scan, sighs } from '../src/calm/routines.js';
import { phases, summary } from '../src/move/routines.js';
import { STEPS, breakSteps } from '../src/break/routines.js';
import { total } from '../src/practice/timeline.js';
import course from '../src/data/move.json' with { type: 'json' };

const roundTrip = (v) => JSON.parse(JSON.stringify(v));

test('timed: the defaults hold until a valid override replaces one', () => {
  const d = { breaths: 3, inhale: 4, exhale: 8 };
  assert.deepEqual(timed('calm', d, undefined), d);
  assert.deepEqual(timed('calm', d, {}), d);
  assert.deepEqual(timed('calm', d, { inhale: 6 }), { ...d, inhale: 6 });
  assert.deepEqual(timed('calm', { inhale: 4 }, { inhale: 6, exhale: 10 }), { inhale: 6 }, 'only the routine\'s own keys');
});

test('timed: a value out of range, not whole, or of the wrong type falls back to the default', () => {
  for (const bad of [0, -4, 1, 11, 4.5, '6', null, NaN, Infinity, [6], { v: 6 }, true]) {
    assert.equal(timed('calm', { inhale: 4 }, { inhale: bad }).inhale, 4, JSON.stringify(bad));
  }
  assert.equal(timed('calm', { inhale: 4 }, { inhale: 2 }).inhale, 2, 'the bottom of the range is fine');
  assert.equal(timed('calm', { inhale: 4 }, { inhale: 10 }).inhale, 10, 'and the top');
  assert.equal(timed('move', { reps: 8 }, { reps: 1000 }).reps, 8, 'no absurd rep counts');
  assert.equal(timed('nope', { reps: 8 }, { reps: 5 }).reps, 8, 'an unknown habit has nothing to set');
  assert.equal(timed('calm', { x: 1 }, 'junk').x, 1);
});

test('every timing has a sane range, a label, and a default or a place to start', () => {
  for (const [habit, all] of Object.entries(TIMINGS)) for (const [key, r] of Object.entries(all)) {
    const at = `${habit}.${key}`;
    assert.ok(r.label && Number.isInteger(r.min) && r.min >= 1 && r.max > r.min, at);
    const start = r.def ?? r.from;
    assert.ok(Number.isInteger(start) && start >= r.min && start <= r.max, at);
  }
  assert.ok(TIMINGS.calm.inhale.min >= 2 && TIMINGS.calm.inhale.max <= 10);
});

test('setTiming keeps an override, and drops one set back to its fixed default', () => {
  assert.deepEqual(setTiming({}, 'calm', 'inhale', 6), { inhale: 6 });
  assert.deepEqual(setTiming({ inhale: 6, exhale: 10 }, 'calm', 'inhale', 4), { exhale: 10 });
  assert.deepEqual(setTiming(undefined, 'calm', 'breaths', 5), { breaths: 5 }, 'a path value has no fixed default, so it is kept');
});

test('Calm: the path grows until someone sets their own, and then their own holds', () => {
  assert.equal(breaths(3).length, 6);
  assert.equal(breaths(6, {}).length, 12, 'the path\'s growth applies with nothing set');
  assert.deepEqual(breaths(3, { inhale: 6 }).slice(0, 2).map((p) => p.seconds), [6, 8]);
  assert.equal(breaths(3, { breaths: 10 }).length, 20);
  assert.deepEqual(sighs(1, { sighOut: 9 }).map((p) => p.seconds), [3, 1, 9]);
  assert.equal(sighs(3, { sighs: 2, inhale: 9 }).length, 6, 'breathing\'s own timings leave the sigh alone');
  assert.equal(hugTaps(40, { taps: 20 }).length, 20);
  assert.equal(total(scan([{}, {}], 15, { scan: 30 })), 60);
  assert.equal(breaths(3, { inhale: 99 })[0].seconds, 4, 'out of range: the default');
});

test('Move and the screen break go through the same overrides', () => {
  const set = [{ move: 'neck-tilt', seconds: 30 }, { move: 'squat', reps: 5 }];
  assert.deepEqual(phases(set, course.moves).map((x) => `${x.kind}${x.seconds}`), ['move30', 'rest10', 'move20']);
  const mine = phases(set, course.moves, { seconds: 45, reps: 10, rest: 20 });
  assert.deepEqual(mine.map((x) => `${x.kind}${x.seconds}`), ['move45', 'rest20', 'move40']);
  assert.equal(mine[2].reps, 10);
  assert.equal(summary(set, course.moves, { reps: 10 }), '2 moves · 10 squats');
  assert.deepEqual(breakSteps(), STEPS.map((s) => ({ ...s })));
  assert.ok(breakSteps({ seconds: 30 }).every((s) => s.seconds === 30));
});

test('migrate v7 to v8: older saves gain empty timings; v8 keeps its own; junk is none', () => {
  assert.equal(VERSION, 8);
  const v7 = { version: 7, habits: { learn: { count: 0, last: null, forgiven: [], days: 0 } }, log: [], done: {}, cards: {},
    journal: {}, garden: { earned: {} }, tracked: [], picked: [] };
  assert.deepEqual(migrate(roundTrip(v7)), { ...v7, version: VERSION, timings: {} });
  const mine = { ...emptyProgress(), timings: { calm: { inhale: 6 }, move: { reps: 12 } } };
  assert.deepEqual(migrate(roundTrip(mine)), mine);
  for (const bad of [null, 5, 'x', [1]]) assert.deepEqual(migrate({ ...emptyProgress(), timings: bad }).timings, {}, JSON.stringify(bad));
  // A bad value inside is kept as stored but never used: the routine falls back to the default.
  const odd = migrate({ ...emptyProgress(), timings: { calm: { inhale: -3 } } });
  assert.equal(breaths(1, odd.timings.calm)[0].seconds, 4);
});

test('nextUp: the next lesson is the first open one, from the placement start on, else `again`', async () => {
  const { nextUp, unitsOf } = await import('../src/progress.js');
  const { subjects } = await import('../src/subjects.js');
  const calm = subjects.find((s) => s.id === 'calm');
  const brk = subjects.find((s) => s.id === 'break');
  const up = (p, s) => nextUp(unitsOf(p, s), s.again);
  assert.equal(up(emptyProgress(), calm).current.id, 'calm:breathe1');
  assert.equal(up({ ...emptyProgress(), done: { 'calm:breathe1': 1 } }, calm).current.id, 'calm:breathe2');
  const chess = subjects.find((s) => s.placement);
  const placed = { ...emptyProgress(), start: { [chess.id]: chess.units[1].title } };
  assert.equal(up(placed, chess).current.id, `${chess.id}:${chess.units[1].lessons[0].id}`, 'from the placement start');
  const allDone = { ...emptyProgress(), done: { 'break:break1': 1, 'break:break2': 1 } };
  assert.deepEqual([up(allDone, brk).current, up(allDone, brk).repeat.id], [undefined, 'break:break2'], 'a finished path repeats `again`');
});

test('pathTimings: growing values come from the next lesson, else the nearest one that has them', async () => {
  const { pathTimings } = await import('../src/practice/timings.js');
  const calm = (await import('../src/data/calm.json', { with: { type: 'json' } })).default;
  const lessons = calm.units.flatMap((u) => u.lessons);
  const at = (id) => lessons.findIndex((l) => l.id === id);
  const first = pathTimings('calm', lessons, 0);
  assert.deepEqual(first, { breaths: 3, sighs: 3, scan: 15, taps: 40 }, 'fixed values (inhale) are not here; the rest look ahead');
  assert.equal(pathTimings('calm', lessons, at('breathe2')).breaths, 5);
  assert.equal(pathTimings('calm', lessons, at('scan2')).breaths, 6, 'past the breathing lessons: the last one before');
  assert.equal(pathTimings('calm', lessons, -1).breaths, 3, 'no next lesson reads as the first');
  const move = pathTimings('move', course.units.flatMap((u) => u.lessons), 0);
  assert.deepEqual(move, { reps: 8, seconds: 30 }, "Move's live in each routine's set");
  assert.deepEqual(setTiming({ breaths: 4 }, 'calm', 'breaths', 3, 3), {}, 'stepping back to the growing value keeps it growing');
  assert.deepEqual(setTiming({}, 'calm', 'breaths', 4, 3), { breaths: 4 });
  assert.deepEqual(pathTimings('break', [], 0), { seconds: TIMINGS.break.seconds.from }, 'nothing on the path: `from`');
});

test('a `varies` value starts from the middle of the routine\'s own values, and setting it is always kept', async () => {
  const { pathTimings, spread } = await import('../src/practice/timings.js');
  const { subjects } = await import('../src/subjects.js');
  const brk = subjects.find((s) => s.habit === 'break');
  assert.ok(TIMINGS.break.seconds.varies);
  assert.deepEqual(brk.varied.seconds, STEPS.map((s) => s.seconds), 'the subject hands over the routine\'s own seconds');
  assert.deepEqual(spread(brk.varied.seconds), [15, 25]);
  assert.equal(pathTimings('break', [], 0, brk.varied).seconds, 20);
  assert.equal(pathTimings('break', [], 0, { seconds: [10, 25] }).seconds, 20, 'the middle lands on the step (17.5 → 20)');
  assert.deepEqual(setTiming({}, 'break', 'seconds', 20, 20), { seconds: 20 }, '20 for every step is not the steps as written');
});
