import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STEPS } from '../src/break/routines.js';
import { phaseAt, total } from '../src/practice/timeline.js';
import { POSES } from '../src/cast/clover.js';
import { subjects } from '../src/subjects.js';

const course = JSON.parse(readFileSync('src/data/break.json', 'utf8'));

test('the screen break is six steps in order, about two minutes', () => {
  assert.deepEqual(STEPS.map((s) => s.name), ['Look far away', 'Slow blinks', 'Shoulder rolls', 'Neck tilts', 'Stand and stretch', 'Sit tall']);
  assert.equal(total(STEPS), 120);
  for (const s of STEPS) assert.ok(s.seconds >= 10 && s.seconds <= 30 && s.line, s.name);
});

test('every step has a pose Clover demonstrates, a short cue and a few lines of guidance', () => {
  for (const s of STEPS) {
    assert.ok(POSES.includes(s.pose), s.name);
    assert.ok(Number.isInteger(s.loops) && s.loops >= 1 && s.seconds / s.loops >= 3 && !('reps' in s), `${s.name}: a slow loop`);
    assert.ok(s.line.length <= 80, s.name);
    assert.ok(s.how.length >= 2 && s.how.every((t) => t.length > 10 && t.length <= 100), s.name);
  }
  assert.deepEqual(STEPS.map((s) => s.pose), ['look-far', 'blink', 'shoulder-roll', 'neck-tilt', 'reach-up', 'sit-tall']);
  const coach = subjects.find((x) => x.habit === 'break').coach;
  assert.equal(coach.name, 'Clover');
  assert.equal(coach.demonstrates, true);
});

test('it starts with 20 seconds of looking at least 6 metres away', () => {
  assert.equal(STEPS[0].seconds, 20);
  assert.match(STEPS[0].line, /at least 6 metres away/);
  assert.equal(phaseAt(STEPS, 19999).index, 0);
  assert.equal(phaseAt(STEPS, 20000).index, 1);
  assert.equal(phaseAt(STEPS, 120000).done, true);
});

test('taught once in the first lesson, then just the break; one short unit', () => {
  assert.equal(course.units.length, 1);
  assert.equal(course.units[0].title, 'Screen break');
  const [first, ...rest] = course.units[0].lessons;
  assert.deepEqual(first.items.map((i) => i.type), ['teach', 'steps']);
  assert.equal(first.items[0].help, true);
  assert.ok(rest.length >= 1 && rest.every((l) => l.items.every((i) => i.type === 'steps')));
});
