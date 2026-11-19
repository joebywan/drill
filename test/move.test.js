import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REST, phases, summary } from '../src/move/routines.js';
import { countOf, total } from '../src/practice/timeline.js';
import { POSES, clover } from '../src/cast/clover.js';

const course = JSON.parse(readFileSync('src/data/move.json', 'utf8'));
const units = Object.fromEntries(course.units.map((u) => [u.title, u.lessons.flatMap((l) => l.items)]));
const routines = Object.values(units).flat().filter((i) => i.type === 'routine');

test('each exercise is one timed phase, with a rest between', () => {
  const set = [{ move: 'neck-tilt', seconds: 30 }, { move: 'squat', reps: 5 }];
  const p = phases(set, course.moves);
  assert.deepEqual(p.map((x) => `${x.kind}${x.seconds}`), ['move30', `rest${REST}`, 'move20']);
  assert.deepEqual(p.map((x) => x.n), [1, undefined, 2]);
  assert.equal(p[2].reps, 5);
  assert.equal(p[2].of, 2);
  assert.deepEqual(p[1].how, course.moves.squat.how); // a rest looks ahead
  assert.equal(summary(set, course.moves), '2 moves · 5 squats');
  assert.equal(summary([...set, { move: 'squat', reps: 3 }], course.moves), '3 moves · 8 squats');
});

test('a rep phase counts reps up, a timed one counts seconds down', () => {
  const squats = { seconds: 20, reps: 5 };
  assert.deepEqual([20, 17, 16, 5, 1].map((s) => countOf(squats, s)), [1, 1, 2, 4, 5]);
  assert.equal(countOf({ seconds: 30 }, 12), 12);
});

test('every move has a name, plain how-to lines and a pose the coach can demonstrate', () => {
  for (const [id, m] of Object.entries(course.moves)) {
    assert.ok(m.name && m.how.length, id);
    assert.ok(POSES.includes(m.pose), `${id}: ${m.pose}`);
  }
  for (const r of routines) for (const x of r.set) {
    assert.ok(course.moves[x.move], `${r.id}: ${x.move}`);
    if (x.reps) assert.ok(course.moves[x.move].unit, `${x.move} needs a unit for the summary`);
  }
});

test('every session is 2 to 5 minutes', () => {
  for (const r of routines) {
    const s = total(phases(r.set, course.moves));
    assert.ok(s >= 120 && s <= 300, `${r.id}: ${s}s`);
  }
});

test('reps grow along the Strength path by turning up: squats 5, 8, 10', () => {
  const most = (move, unit = 'Strength') => units[unit].filter((i) => i.set).map((i) => Math.max(...i.set.filter((x) => x.move === move).map((x) => x.reps)));
  assert.deepEqual(most('squat'), [5, 8, 10]);
  assert.deepEqual(most('wall-push'), [5, 8, 10]);
  // The new units' rep moves grow gently too.
  assert.deepEqual(most('sit-to-stand', 'Seated'), [3, 4, 5]);
  assert.deepEqual(most('heel-raise', 'Balance'), [5, 8, 10]);
  assert.deepEqual(most('side-leg-lift', 'Balance'), [3, 4, 5]);
  // The others grow by time instead: never shorter than the lesson before.
  for (const unit of ['Wake up', 'Stretch', 'Back and neck', 'Seated', 'Balance']) {
    const mins = units[unit].filter((i) => i.set).map((i) => total(phases(i.set, course.moves)));
    assert.deepEqual(mins, [...mins].sort((a, b) => a - b), unit);
  }
});

test('each unit is taught once, in its first lesson, then practised', () => {
  assert.deepEqual(course.units.map((u) => u.title), ['Wake up', 'Strength', 'Stretch', 'Back and neck', 'Seated', 'Balance']);
  for (const u of course.units) {
    const teach = u.lessons.map((l) => l.items.filter((i) => i.type === 'teach').length);
    assert.deepEqual(teach, [1, ...Array(u.lessons.length - 1).fill(0)], u.title);
    assert.equal(u.lessons[0].items[0].help, true, `${u.title}: the safety line is on its first lesson`);
  }
  const ids = Object.values(units).flat().map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'item ids are unique');
});

const moves = (unit) => [...new Set(units[unit].filter((i) => i.set).flatMap((i) => i.set.map((x) => x.move)))];

test('Seated is all on a chair: Clover sits on one for every move', () => {
  const chair = /data-part="seat" style="[^"]*scale\(1, 1\)/;
  for (const id of moves('Seated')) assert.match(clover('guide', course.moves[id].pose), chair, id);
  assert.doesNotMatch(clover('guide', 'squat'), chair);
});

test('Balance keeps a hand on a wall or chair back, and Clover holds the wall', () => {
  assert.match(units.Balance[0].text.join(' '), /keep a hand on it or near it/);
  const wall = /data-part="wall" style="[^"]*scale\(1, 1\)/;
  for (const id of moves('Balance')) {
    assert.match(course.moves[id].how[0], /wall or a chair back/, id);
    assert.match(clover('guide', course.moves[id].pose), wall, id);
  }
});
