import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayDetail, lookBack, middleFor, promptsFor, readBack } from '../src/reflect/practice.js';
import { subjects } from '../src/subjects.js';
import { emptyProgress, migrate, writeJournal } from '../src/progress.js';
import { summary } from '../src/widget.js';

test("a day's own lines show in the habit view, safely, and an empty day adds nothing", () => {
  const progress = { journal: { '2026-10-30': { good: 'Tea <b>in</b> the sun', tomorrow: 'Call Sam' } } };
  const html = dayDetail(progress, '2026-10-30');
  assert.match(html, /Good<\/span> Tea &#60;b&#62;in&#60;\/b&#62; the sun/);
  assert.match(html, /Tomorrow<\/span> Call Sam/);
  assert.doesNotMatch(html, /Learned/);
  assert.equal(dayDetail(progress, '2026-10-29'), '');
  assert.equal(dayDetail({}, '2026-10-30'), '');
  assert.equal(subjects.find((s) => s.habit === 'reflect').dayDetail, dayDetail);
});

test("every practice path that can run out keeps a lesson on home, and it's a real one", () => {
  for (const s of subjects.filter((x) => x.kind === 'practice')) {
    assert.ok(s.again?.label, `${s.id} has an again label`);
    assert.ok(s.units.some((u) => u.lessons.some((l) => l.id === s.again.lesson)), `${s.id}: ${s.again.lesson}`);
  }
});

const at = (d) => new Date(`${d}T12:00:00`);
const kept = (journal) => ({ ...emptyProgress(), journal });

test('the middle prompt comes from the pool by date, the ends never change, and a day has one', () => {
  const [a, b, c] = promptsFor('2026-11-20');
  assert.deepEqual([a.prompt, c.prompt], ['One good thing', 'One thing for tomorrow']);
  assert.equal(promptsFor('2026-11-20')[1].id, b.id, 'same all day');
  assert.notEqual(middleFor('2026-11-21').id, middleFor('2026-11-20').id);
  assert.equal(middleFor('2026-11-27').id, middleFor('2026-11-20').id, 'a week later, round again');
  const seen = new Set(Array.from({ length: 7 }, (_, i) => middleFor(`2026-11-${10 + i}`).id));
  assert.equal(seen.size, 7);
  assert.equal(b.key, 'learned');
});

test("the prompt asked is kept with the day, and the week view labels the line by it", () => {
  const m = middleFor('2026-11-21');
  const p = writeJournal(emptyProgress(), { good: 'Tea', learned: 'A <b>crow</b>', asked: m.id }, at('2026-11-21'));
  assert.equal(p.journal['2026-11-21'].asked, m.id);
  assert.ok(migrate(JSON.parse(JSON.stringify(p))), 'a saved day with `asked` is valid');
  assert.match(dayDetail(p, '2026-11-21'), new RegExp(`<span>${m.label}</span> A &#60;b&#62;crow`));
  assert.match(dayDetail(kept({ '2026-11-01': { learned: 'Old' } }), '2026-11-01'), /<span>Learned<\/span> Old/, 'an older day says learned');
  assert.equal(writeJournal(emptyProgress(), { good: 'Tea', asked: m.id }, at('2026-11-21')).journal['2026-11-21'].asked, undefined, 'no middle line, nothing asked');
});

test('the look back is the line from exactly seven days ago, else the newest older one, else nothing', () => {
  const now = at('2026-11-20');
  assert.equal(lookBack(emptyProgress(), now), '');
  assert.equal(lookBack(kept({ '2026-11-14': { good: 'Too soon' }, '2026-11-20': { good: 'Today' } }), now), '', 'nothing seven days old yet');
  const exact = lookBack(kept({ '2026-11-13': { good: 'A walk in the <i>sun</i>' }, '2026-11-10': { good: 'Older' } }), now);
  assert.match(exact, /Last Friday\u2019s good thing:/);
  assert.match(exact, /<q>A walk in the &#60;i&#62;sun&#60;\/i&#62;<\/q>/);
  const older = lookBack(kept({ '2026-11-10': { good: 'Tuesday', tomorrow: 'x' }, '2026-11-02': { good: 'Earlier' } }), now);
  assert.match(older, /Your good thing on Tuesday/);
  assert.doesNotMatch(older, /Earlier/);
  const asked = middleFor('2026-11-13');
  assert.match(lookBack(kept({ '2026-11-13': { learned: 'Bees', asked: asked.id } }), now), new RegExp(asked.back));
  assert.equal(lookBack(kept({ '2026-11-13': { good: '  ' } }), now), '', 'a blank day is not a line');
});

test('the end screen offers the week once three of the last seven days have lines', () => {
  const now = at('2026-11-20');
  const days = (...d) => kept(Object.fromEntries(d.map((x) => [`2026-11-${x}`, { good: 'x' }])));
  assert.equal(readBack(days(20, 19), now), '');
  assert.match(readBack(days(20, 19, 14), now), /Read back your week/);
  assert.equal(readBack(days(20, 19, 13), now), '', 'eight days ago is outside the week');
  assert.equal(readBack(kept({ '2026-11-20': { focus: ['a'] }, '2026-11-19': { focus: ['b'] }, '2026-11-18': { focus: ['c'] } }), now), '', 'Focus lines are not Reflect lines');
});

test('what was written never reaches the widget summary', () => {
  const p = writeJournal(emptyProgress(), { good: 'secret words', learned: 'hidden thing', asked: 'noticed' }, at('2026-11-20'));
  assert.doesNotMatch(JSON.stringify(summary(p, at('2026-11-20'))), /secret|hidden/);
});
