import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dayDetail, session } from '../src/focus/practice.js';
import { countOf, total } from '../src/practice/timeline.js';
import { emptyProgress, migrate, writeJournal } from '../src/progress.js';
import { subjects } from '../src/subjects.js';

const course = JSON.parse(readFileSync('src/data/focus.json', 'utf8'));

test('a session is one timed phase whose minutes grow along the path, and your own time wins', () => {
  const minutes = course.units.flatMap((u) => u.lessons.flatMap((l) => l.items)).filter((i) => i.type === 'session').map((i) => i.minutes);
  assert.deepEqual(minutes, [10, 15, 25]);
  assert.equal(total(session(10)), 600);
  assert.equal(total(session(25, {})), 1500);
  assert.equal(total(session(10, { minutes: 45 })), 2700, 'a set time holds on every lesson');
  assert.equal(total(session(10, { minutes: 3 })), 600, 'out of range is ignored');
  assert.equal(total(session(10, { minutes: '45' })), 600, 'so is anything not a whole number');
});

test('the timer reads in minutes and seconds', () => {
  const [p] = session(10);
  assert.equal(countOf(p, 600), '10:00');
  assert.equal(countOf(p, 545), '9:05');
  assert.equal(countOf(p, 1), '0:01');
  assert.equal(countOf({ seconds: 8 }, 3), 3, 'other phases still count seconds');
});

test('what it was for stays in the journal, shown back safely, never in the log', () => {
  const p = writeJournal(emptyProgress(), { focus: '  <b>Essay</b> ' }, new Date(2026, 9, 30));
  assert.deepEqual(p.journal, { '2026-10-30': { focus: '<b>Essay</b>' } });
  assert.deepEqual(p.log, []);
  assert.ok(migrate(JSON.parse(JSON.stringify(p))), 'the shape loads back without a new version');
  assert.match(dayDetail(p, '2026-10-30'), /Focused on<\/span> &#60;b&#62;Essay&#60;\/b&#62;/);
  assert.equal(dayDetail(p, '2026-10-29'), '');
  assert.equal(dayDetail({}, '2026-10-30'), '');
  const s = subjects.find((x) => x.habit === 'focus');
  assert.equal(s.dayDetail, dayDetail);
  assert.equal(s.kind, 'practice');
  assert.equal(s.again.lesson, 'focus3');
});
