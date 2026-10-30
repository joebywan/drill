import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dayDetail, session } from '../src/focus/practice.js';
import { countOf, total } from '../src/practice/timeline.js';
import { emptyProgress, focusLines, migrate, writeJournal } from '../src/progress.js';
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

test('every focus line of the day stays in the journal, shown back safely, never in the log', () => {
  const day = new Date(2026, 9, 30);
  let p = writeJournal(emptyProgress(), { focus: ['  <b>Essay</b> '] }, day);
  p = writeJournal(p, { focus: ['Reading'] }, day);
  p = writeJournal(p, { good: 'Tea' }, day); // Reflect's lines sit beside them
  assert.deepEqual(p.journal, { '2026-10-30': { focus: ['<b>Essay</b>', 'Reading'], good: 'Tea' } });
  assert.deepEqual(p.log, []);
  assert.ok(migrate(JSON.parse(JSON.stringify(p))), 'the list loads back without a new version');
  const html = dayDetail(p, '2026-10-30');
  assert.match(html, /Focused on<\/span> &#60;b&#62;Essay&#60;\/b&#62;<\/li><li><span>Focused on<\/span> Reading/);
  assert.equal(dayDetail(p, '2026-10-29'), '');
  assert.equal(dayDetail({}, '2026-10-30'), '');
  assert.equal(writeJournal(p, { focus: ['  '] }, day), p, 'a blank line keeps nothing');
  const s = subjects.find((x) => x.habit === 'focus');
  assert.equal(s.dayDetail, dayDetail);
  assert.equal(s.kind, 'practice');
  assert.equal(s.again.lesson, 'focus3');
});

test('a single focus string saved before lists reads as a list of one, and the next session adds to it', () => {
  const old = { ...emptyProgress(), journal: { '2026-10-30': { focus: 'Tax forms' } } };
  assert.ok(migrate(JSON.parse(JSON.stringify(old))));
  assert.deepEqual(focusLines(old.journal['2026-10-30']), ['Tax forms']);
  assert.match(dayDetail(old, '2026-10-30'), /Focused on<\/span> Tax forms/);
  const p = writeJournal(old, { focus: ['Study'] }, new Date(2026, 9, 30));
  assert.deepEqual(p.journal['2026-10-30'].focus, ['Tax forms', 'Study']);
  assert.equal(migrate({ ...old, journal: { '2026-10-30': { focus: [3] } } }), null, 'anything but text is refused');
});
