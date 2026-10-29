import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayName, restDays, sessionLine } from '../src/habitview.js';

test('a session reads as one line', () => {
  assert.equal(sessionLine({ title: 'Forks', right: 7, of: 8, mins: 6 }), 'Forks · 7 of 8 right first try · 6 min');
  assert.equal(sessionLine({ title: 'Review', right: 5, of: 6, mins: 2 }), 'Review · 5 of 6 recalled · 2 min');
  assert.equal(sessionLine({ title: 'Breathing', mins: 2, feel: 'calmer' }), 'Breathing · 2 min · felt calmer');
  assert.equal(sessionLine({ title: 'The board', right: 0, of: 0, mins: 0 }), 'The board');
});

test('a forgiven date marks the day before it as a rest day', () => {
  assert.deepEqual([...restDays({ forgiven: ['2026-10-01', '2026-11-01'] })], ['2026-09-30', '2026-10-31']);
  assert.equal(restDays(undefined).size, 0);
});

test('days are named from today back', () => {
  const now = new Date(2026, 9, 30, 9); // Friday
  assert.equal(dayName('2026-10-30', now), 'Today');
  assert.equal(dayName('2026-10-29', now), 'Yesterday');
  assert.equal(dayName('2026-10-27', now), 'Tuesday');
});
