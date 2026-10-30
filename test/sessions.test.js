import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../tools/sessions.js';

test('sessions stay short: a typical lesson, and one that is going badly', () => {
  const rows = simulate(2);
  assert.equal(rows.length, 21, 'seven courses, three learners');
  for (const { course, learner, lessons, checkpoints } of rows) {
    const who = `${course}, ${learner}`;
    assert.ok(lessons.max <= 24, `${who}: a lesson of ${lessons.max} screens`);
    assert.ok(checkpoints.max <= 15, `${who}: a checkpoint of ${checkpoints.max} screens`);
    if (learner === 'all right') {
      assert.ok(lessons.mean <= 13.5, `${who}: ${lessons.mean} on average`);
      assert.equal(checkpoints.max, 8, 'nothing extra for someone flying through');
    }
  }
});
