import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, finishPractice, leavePractice, migrate, today } from '../src/progress.js';
import { award, garden } from '../src/garden/model.js';
import { habitsFor, ordered, subjects } from '../src/subjects.js';
import {
  COMEBACK_DAYS, PAUSE_AFTER, activeComeback, answerComeback, clock, dropOff, noteReminder, preferred,
  remindersPaused, reminderHour, shorter, shouldRemind, startComeback, usualHours, usualLine,
} from '../src/fitting.js';

// Fixed dates: 1 Oct 2026 is a Thursday. `at(d, h)` is day d of October (or later) at hour h.
const at = (d, h = 12) => new Date(2026, 9, d, h);
const entry = (d, h, habit = 'calm', title = 'Breathing') => ({ date: today(at(d)), hour: h, habit, title, mins: 2 });
const withLog = (log, more = {}) => ({ ...emptyProgress(), log, ...more });

test('usual hours: nothing from a few sessions, then the busiest hour of each cluster', () => {
  assert.deepEqual(usualHours(withLog([entry(1, 19), entry(2, 19), entry(3, 20), entry(4, 19)])), [], 'four sessions say nothing yet');
  const evenings = withLog([entry(1, 19), entry(2, 19), entry(3, 20), entry(4, 19), entry(5, 18)]);
  assert.deepEqual(usualHours(evenings), [19]);
  // One early odd session never makes an hour usual.
  assert.deepEqual(usualHours(withLog([...evenings.log, entry(6, 6)])), [19]);
  // Mornings and evenings both.
  const both = withLog([7, 7, 8, 7, 19, 19, 20, 19].map((h, i) => entry(i + 1, h)));
  assert.deepEqual(usualHours(both), [7, 19]);
  // Two equal neighbours give the earlier one; entries from before hours were kept are skipped.
  assert.deepEqual(usualHours(withLog([18, 18, 19, 19, 18, 19].map((h, i) => entry(i + 1, h)).concat({ date: '2026-10-09', habit: 'calm', title: 'x' }))), [18]);
});

test('usual hours for one habit read only that habit', () => {
  const log = [1, 2, 3, 4, 5].flatMap((d) => [entry(d, 7, 'move', 'Wake up'), entry(d, 21, 'calm')]);
  assert.deepEqual(usualHours(withLog(log), 'move'), [7]);
  assert.deepEqual(usualHours(withLog(log), 'calm'), [21]);
  assert.deepEqual(usualHours(withLog(log)), [7, 21]);
});

test('reminder hour: null without enough data, never early for someone who only practises late', () => {
  assert.equal(reminderHour(emptyProgress()), null);
  assert.equal(reminderHour(withLog([entry(1, 8), entry(2, 21)])), null);
  const late = withLog([20, 21, 21, 22, 21, 21, 6].map((h, i) => entry(i + 1, h)));
  assert.equal(reminderHour(late), 21);
  // Both clusters usual: the one with more sessions around it wins.
  const both = withLog([7, 7, 8, 19, 19, 20, 19, 18].map((h, i) => entry(i + 1, h)));
  assert.equal(reminderHour(both), 19);
});

test('the habit view line names the usual hours plainly', () => {
  assert.equal(usualLine([]), '');
  assert.equal(usualLine([19]), 'You usually practise around 7 pm');
  assert.equal(usualLine([7, 19]), 'You usually practise around 7 am and 7 pm');
  assert.deepEqual([0, 12, 1, 23].map(clock), ['midnight', 'noon', '1 am', '11 pm']);
});

test('reminders: recorded with date and hour; anything but a known outcome changes nothing', () => {
  const p = noteReminder(emptyProgress(), 'opened', at(3, 19));
  assert.deepEqual(p.reminders, [{ date: '2026-10-03', hour: 19, outcome: 'opened' }]);
  assert.equal(noteReminder(p, 'snoozed', at(4)), p);
  assert.equal(noteReminder(p, undefined, at(4)), p);
});

test('reminders thin out when only cleared, then pause until turned back on', () => {
  const clear = (p, d) => noteReminder(p, 'cleared', at(d, 19));
  let p = emptyProgress();
  assert.equal(shouldRemind(p, at(1, 19)), true, 'nothing recorded: remind');
  for (let d = 1; d <= 3; d++) p = clear(p, d);
  assert.equal(shouldRemind(p, at(4, 19)), false, 'three cleared: not the next day');
  assert.equal(shouldRemind(p, at(5, 19)), true, 'every other day');
  for (let d = 5; d <= 6; d++) p = clear(p, d);
  assert.equal(shouldRemind(p, at(8, 19)), false, 'five cleared: not two days on');
  assert.equal(shouldRemind(p, at(9, 19)), true, 'every third day');
  assert.equal(remindersPaused(p), false);
  for (let d = 9; d <= 11; d++) p = clear(p, d);
  assert.equal(p.reminders.length, PAUSE_AFTER);
  assert.equal(remindersPaused(p), true);
  assert.equal(shouldRemind(p, at(30, 19)), false, 'paused: none at all');
  const on = noteReminder(p, 'on', at(30, 9));
  assert.equal(remindersPaused(on), false);
  assert.equal(shouldRemind(on, at(30, 19)), true);
  // One opened reminder starts the count again.
  assert.equal(remindersPaused(noteReminder(clear(p, 12), 'opened', at(13))), false);
});

test('no reminder after a session today, and only the last 60 reminders are kept', () => {
  const p = finishPractice(emptyProgress(), 'calm', null, at(3, 8));
  assert.equal(shouldRemind(p, at(3, 19)), false);
  assert.equal(shouldRemind(p, at(4, 19)), true);
  let r = emptyProgress();
  for (let i = 0; i < 70; i++) r = noteReminder(r, 'opened', at(1));
  assert.equal(r.reminders.length, 60);
});

// Six weeks of Calm "Breathing" most evenings and some Move, then a quiet week.
const steady = (until = 42) => Array.from({ length: until }, (_, i) => i + 1).filter((d) => d % 7 !== 3)
  .map((d) => (d % 5 ? entry(d, 19) : entry(d, 7, 'move', 'Wake up')));

test('drop-off: sessions this week well below their own usual, with their favourite practice at their usual hour', () => {
  const p = withLog(steady(42));
  assert.equal(dropOff(p, at(43)), null, 'a steady week is no drop-off');
  const quiet = dropOff(p, at(50));
  assert.ok(quiet, 'a quiet week is');
  assert.equal(quiet.recent, 0);
  assert.ok(quiet.usual >= 5);
  assert.equal(quiet.habit, 'calm');
  assert.equal(quiet.title, 'Breathing');
  assert.equal(quiet.hour, 19);
  // One session in the week is still well below six; three is not.
  assert.ok(dropOff(withLog([...steady(42), entry(48, 19)]), at(50)));
  assert.equal(dropOff(withLog([...steady(42), entry(46, 19), entry(47, 19), entry(48, 19)]), at(50)), null);
});

test('drop-off needs five weeks of log and a real habit to fall from', () => {
  assert.equal(dropOff(emptyProgress(), at(10)), null);
  assert.equal(dropOff(withLog(steady(20)), at(28)), null, 'under five weeks of log');
  const sparse = withLog([1, 8, 15, 22, 29, 36].map((d) => entry(d, 19)));
  assert.equal(dropOff(sparse, at(50)), null, 'once a week is their usual: nothing to fall from');
  const learnOnly = withLog(steady(42).map((e) => ({ ...e, habit: 'learn', title: 'Forks' })));
  assert.equal(dropOff(learnOnly, at(50)), null, 'no practice to offer');
});

test('a comeback starts once, lasts a week, ends after one session of its habit and brings a ladybird', () => {
  const p = withLog(steady(42));
  const started = startComeback(p, at(50, 9));
  assert.deepEqual(started.comeback, { date: '2026-11-19', habit: 'calm', title: 'Breathing', hour: 19 });
  assert.equal(startComeback(started, at(51)), started, 'one at a time');
  assert.equal(activeComeback(started, at(50 + COMEBACK_DAYS - 1)), started.comeback);
  assert.equal(activeComeback(started, at(50 + COMEBACK_DAYS)), null, 'over after a week');
  assert.equal(startComeback(started, at(60)), started, 'not again within four weeks');
  assert.equal(startComeback(withLog(steady(42)), at(43)).comeback, undefined, 'no drop-off, no comeback');
  // A Move session leaves it on offer; a Calm one answers it, and the garden's ladybird comes.
  assert.equal(answerComeback(started, 'move', at(51)), started);
  let done = answerComeback(finishPractice(started, 'calm', null, at(51, 19), { title: 'Breathing' }), 'calm', at(51, 19));
  assert.equal(done.comeback.done, '2026-11-20');
  assert.equal(activeComeback(done, at(51, 20)), null);
  let newly;
  ({ progress: done, newly } = award(done, at(51, 19)));
  assert.ok(newly.some((r) => r.id === 'ladybird:calm' && r.gift === 'ladybird'));
  // Earned once and kept: the next comeback (another habit, weeks on) moves nothing.
  const later = { ...done, comeback: { date: '2027-01-01', habit: 'move', title: 'Wake up', hour: 7 } };
  assert.ok(award(later, at(100)).progress.garden.earned['ladybird:calm']);
  assert.ok(garden(later, at(100)).plants.find((pl) => pl.habit === 'calm').visitors.some((v) => v.gift === 'ladybird'));
  // Dismissed: no longer offered, nothing earned.
  assert.equal(activeComeback({ ...started, comeback: { ...started.comeback, dismissed: true } }, at(51)), null);
});

const calm = subjects.find((s) => s.habit === 'calm');
const lessonOf = (s, id) => s.units.flatMap((u) => u.lessons).find((l) => l.id === id);
const leave = (p, d, step, of = 10, id = 'calm:breathe2') => leavePractice(p, 'calm', id, step, of, at(d, 21), { title: 'Breathing' });

test('a practice left at about the same step three times running is offered shorter, through timed() overrides', () => {
  const five = lessonOf(calm, 'breathe2'); // five breaths, 10 phases
  let p = leave(leave(emptyProgress(), 1, 6), 2, 6);
  assert.equal(shorter(p, 'calm', five, 'calm:breathe2', {}, at(3)), null, 'twice is not often');
  p = leave(p, 3, 7);
  assert.deepEqual(shorter(p, 'calm', five, 'calm:breathe2', {}, at(4)), { timings: { breaths: 3 }, words: 'Try a shorter one: 3 breaths' });
  // Their own timings are the starting point: 8 breaths cut to the same share.
  assert.deepEqual(shorter(p, 'calm', five, 'calm:breathe2', { breaths: 8 }, at(4)).timings, { breaths: 4 });
  // Never under the timing's minimum, and singular for one.
  const early = leave(leave(leave(emptyProgress(), 1, 1), 2, 1), 3, 1);
  assert.deepEqual(shorter(early, 'calm', five, 'calm:breathe2', {}, at(4)), { timings: { breaths: 1 }, words: 'Try a shorter one: 1 breath' });
});

test('no shorter offer for scattered steps, the first step, other lessons, old entries or after finishing', () => {
  const five = lessonOf(calm, 'breathe2');
  const offer = (p, d = 4) => shorter(p, 'calm', five, 'calm:breathe2', {}, at(d));
  assert.equal(offer(leave(leave(leave(emptyProgress(), 1, 2), 2, 6), 3, 8)), null, 'scattered');
  assert.equal(offer(leave(leave(leave(emptyProgress(), 1, 0), 2, 0), 3, 0)), null, 'closed on the first step');
  assert.equal(offer(leave(leave(leave(emptyProgress(), 1, 6, 10, 'calm:breathe3'), 2, 6, 10, 'calm:breathe3'), 3, 6, 10, 'calm:breathe3')), null, 'another lesson');
  const three = leave(leave(leave(emptyProgress(), 1, 6), 2, 6), 3, 6);
  assert.equal(offer(three, 40), null, 'over 30 days old');
  assert.equal(offer(finishPractice(three, 'calm', 'calm:breathe2', at(3, 22))), null, 'finished since');
  // The grounding lesson keeps no timing to shorten.
  const ground = lessonOf(calm, 'ground1');
  const g = [1, 2, 3].reduce((p, d) => leave(p, d, 3, 5, 'calm:ground1'), emptyProgress());
  assert.equal(shorter(g, 'calm', ground, 'calm:ground1', {}, at(4)), null);
});

test('home puts the intro picks first, then the habits finished most', () => {
  const log = [...Array(5).fill(0).map((_, i) => entry(i + 1, 9, 'move', 'Wake up')), ...Array(3).fill(0).map((_, i) => entry(i + 1, 9, 'focus', 'Focus')), entry(1, 9, 'reflect', 'Reflect')];
  assert.deepEqual(preferred(withLog(log)), ['move', 'focus'], 'three sessions or more, most first');
  assert.deepEqual(preferred(withLog(log, { picked: ['calm', 'focus'] })), ['calm', 'focus', 'move'], 'picks stay first, as picked');
  const p = withLog(log, { picked: ['calm'] });
  assert.deepEqual(ordered(habitsFor(p), preferred(p)).map((h) => h.id).slice(0, 4), ['calm', 'move', 'focus', 'learn']);
});

test('reminders and the comeback survive the file export and import; bad records are dropped, not the file', () => {
  let p = withLog(steady(42));
  p = startComeback(noteReminder(p, 'cleared', at(49, 19)), at(50));
  const back = migrate(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(back.reminders, p.reminders);
  assert.deepEqual(back.comeback, p.comeback);
  const odd = migrate({ ...JSON.parse(JSON.stringify(p)), reminders: [{ date: 'x', hour: 1, outcome: 'opened' }, ...p.reminders], comeback: { habit: 3 } });
  assert.deepEqual(odd.reminders, p.reminders);
  assert.equal(odd.comeback, undefined);
  assert.equal('reminders' in migrate(emptyProgress()), false, 'absent stays absent');
});
