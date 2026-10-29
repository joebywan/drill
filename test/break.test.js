import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STEPS } from '../src/break/routines.js';
import { phaseAt, total } from '../src/practice/timeline.js';

const course = JSON.parse(readFileSync('src/data/break.json', 'utf8'));

test('the screen break is six steps in order, about two minutes', () => {
  assert.deepEqual(STEPS.map((s) => s.name), ['Look far away', 'Slow blinks', 'Shoulder rolls', 'Neck tilts', 'Stand and stretch', 'Sit tall']);
  assert.equal(total(STEPS), 120);
  for (const s of STEPS) assert.ok(s.seconds >= 10 && s.seconds <= 30 && s.line, s.name);
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
