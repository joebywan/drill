import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// node's mock clock moves Date to the end of a tick() before firing timers, so step a second at a time.
const run = (ms) => { for (let i = 0; i < ms; i += 1000) mock.timers.tick(Math.min(1000, ms - i)); };
import { EXHALE, INHALE, breaths, hugTaps, scan, sighs } from '../src/calm/routines.js';
import { phaseAt, timeline, total } from '../src/practice/timeline.js';

const course = JSON.parse(readFileSync('src/data/calm.json', 'utf8'));
const lessons = course.units.flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u.title })));
const items = lessons.flatMap((l) => l.items);

test('breathing is 4 in and 8 out, and the cycles grow along the path: 3, 5, 6', () => {
  assert.deepEqual([INHALE, EXHALE], [4, 8]);
  const cycles = items.filter((i) => i.type === 'breathe').map((i) => i.cycles);
  assert.deepEqual(cycles, [3, 5, 6]);
  const p = breaths(3);
  assert.deepEqual(p.map((x) => `${x.phase}${x.seconds}`), ['in4', 'out8', 'in4', 'out8', 'in4', 'out8']);
  assert.equal(total(breaths(6)), 72);
});

test('every session is short: 1 to 4 minutes', () => {
  for (const i of items) {
    const s = { breathe: () => total(breaths(i.cycles)), sigh: () => total(sighs(i.cycles)), hug: () => total(hugTaps(i.taps)),
      scan: () => total(scan(course.zones, i.seconds)) }[i.type]?.() ?? null;
    if (s != null) assert.ok(s >= 30 && s <= 240, `${i.id}: ${s}s`);
  }
});

test('the sigh is a long breath in, a short top-up and a long sigh out; cycles grow 3, 5', () => {
  assert.deepEqual(sighs(2).map((x) => `${x.phase}${x.seconds}`), ['in3', 'top1', 'sigh6', 'in3', 'top1', 'sigh6']);
  assert.deepEqual(items.filter((i) => i.type === 'sigh').map((i) => i.cycles), [3, 5]);
});

test('the butterfly hug taps left, right, left… once a second; taps grow 40, 60', () => {
  assert.deepEqual(hugTaps(4).map((x) => x.side), ['left', 'right', 'left', 'right']);
  assert.equal(total(hugTaps(40)), 40);
  assert.deepEqual(items.filter((i) => i.type === 'hug').map((i) => i.taps), [40, 60]);
});

test('the Calm path: breathing, grounding, the body scan, then sighing and the butterfly hug', () => {
  assert.deepEqual(course.units.map((u) => u.title), ['Breathing', 'Grounding', 'Body scan', 'Sighing', 'Butterfly hug']);
});

test('the body scan goes feet to head, 15-20 s a zone', () => {
  assert.equal(course.zones[0].name, 'Feet');
  assert.equal(course.zones.at(-1).name, 'Top of the head');
  assert.equal(course.zones.length, 8);
  for (const i of items.filter((x) => x.type === 'scan')) assert.ok(i.seconds >= 15 && i.seconds <= 20, i.id);
});

test('grounding counts down 5, 4, 3, 2, 1', () => {
  assert.deepEqual(course.senses.map((s) => s.count), [5, 4, 3, 2, 1]);
});

test('each technique is taught once, in its first lesson, then practised', () => {
  for (const u of course.units) {
    const teach = u.lessons.map((l) => l.items.filter((i) => i.type === 'teach').length);
    assert.deepEqual(teach, [1, ...Array(u.lessons.length - 1).fill(0)], u.title);
  }
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, 'item ids are unique');
});

test('phaseAt finds the phase, and the end', () => {
  const p = breaths(2);
  assert.deepEqual(phaseAt(p, 0), { index: 0, into: 0, left: 4000, done: false });
  assert.deepEqual(phaseAt(p, 4000), { index: 1, into: 0, left: 8000, done: false });
  assert.deepEqual(phaseAt(p, 23999).index, 3);
  assert.equal(phaseAt(p, 24000).done, true);
});

test('timeline plays each phase on time, pauses, and ends once', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const seen = [];
    let ended = 0;
    const ticks = [];
    const t = timeline(breaths(2), { onPhase: (p, i) => seen.push(`${i}${p.phase}`), onTick: (s) => ticks.push(s), onEnd: () => ended++ });
    assert.deepEqual(seen, ['0in']);
    run(3000);
    assert.deepEqual(ticks, [4, 3, 2, 1]);
    run(1000);
    assert.deepEqual(seen, ['0in', '1out']);
    t.pause();
    assert.equal(t.paused, true);
    run(60000); // a long pause moves nothing on
    assert.deepEqual(seen, ['0in', '1out']);
    t.resume();
    run(7999);
    assert.deepEqual(seen, ['0in', '1out']);
    run(1);
    assert.deepEqual(seen, ['0in', '1out', '2in']);
    run(12000);
    assert.equal(ended, 1);
    run(60000);
    assert.equal(ended, 1);
  } finally {
    mock.timers.reset();
  }
});

test('a timeline paused mid-phase picks up where it was', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    let ended = false;
    const t = timeline(breaths(1), { onEnd: () => { ended = true; } });
    run(2500);
    t.pause();
    run(5000);
    t.resume();
    run(9499);
    assert.equal(ended, false);
    run(1);
    assert.equal(ended, true);
  } finally {
    mock.timers.reset();
  }
});

test('new Calm units only go on the end, so a saved progress never loses an open lesson', async () => {
  const { emptyProgress, unitsOf } = await import('../src/progress.js');
  const ADDED = ['Sighing', 'Butterfly hug']; // units added after learners already had Calm
  const now = { id: 'calm', units: course.units };
  const before = { id: 'calm', units: course.units.filter((u) => !ADDED.includes(u.title)) };
  const ids = before.units.flatMap((u) => u.lessons.map((l) => `calm:${l.id}`));
  const state = (subject, p) => Object.fromEntries(unitsOf(p, subject).flatMap((u) => u.nodes).map((n) => [n.id, n.state]));
  // Every combination of lessons done in the course as it was.
  for (let mask = 0; mask < 2 ** ids.length; mask++) {
    const p = { ...emptyProgress(), done: Object.fromEntries(ids.filter((_, i) => mask & (1 << i)).map((id) => [id, '2026-10-01'])) };
    const was = state(before, p), is = state(now, p);
    for (const id of ids) assert.equal(is[id], was[id], `${id} with ${Object.keys(p.done)}`);
  }
});
