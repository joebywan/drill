import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, look, summary } from '../src/widget.js';
import { WIDGET_LINES } from '../src/cast/lines.js';
import { emptyProgress, finishSession, finishPractice } from '../src/progress.js';

const day = (d, h = 12, m = 0) => new Date(2026, 9, d, h, m);

test('look() picks background, pose and line pool from the light and the hour', () => {
  assert.deepEqual(look('bright', 9), { bg: '#FFF3DF', ink: '#3A2A12', flame: '#F0772A', pose: 'complete', lines: WIDGET_LINES.done });
  assert.equal(look('soft', 9).lines, WIDGET_LINES.morning);
  assert.equal(look('soft', 13).lines, WIDGET_LINES.day);
  assert.equal(look('ember', 19).lines, WIDGET_LINES.evening);
  assert.equal(look('ember', 23).pose, 'sleepy');
  assert.equal(look('soft', 2).lines, WIDGET_LINES.night);
  assert.equal(look('bright', 23).pose, 'complete', 'done today wins over the hour');
  assert.notEqual(look('bright', 12).flame, look('ember', 12).flame);
  assert.notEqual(look('soft', 12).flame, look('ember', 12).flame);
  for (const [h] of BANDS) for (const lit of ['bright', 'soft', 'ember']) {
    const l = look(lit, h);
    assert.ok(l.lines.length && l.bg && l.ink && l.flame && l.pose, `${lit} at ${h}`);
  }
});

test('summary() schedules the widget across midnight, when the light turns', () => {
  const p = finishSession(emptyProgress(), 'a', [], day(10, 9));
  const s = summary(p, day(10, 20, 30), 2);
  assert.equal(s.doneOn, '2026-10-10');
  assert.equal(s.looks[0].at, +day(10, 20, 30), 'starts now');
  assert.deepEqual(s.looks.slice(1, 3).map((l) => new Date(l.at).getHours()), [22, 0]);
  const at = (d, h) => s.looks.find((l) => l.at === +day(d, h));
  assert.equal(at(10, 22).light, 'bright');
  assert.equal(at(11, 0).light, 'soft', 'midnight: a new day, nothing done yet');
  assert.equal(at(11, 0).streak, 1);
  assert.equal(at(12, 0).light, 'ember', 'a day with nothing done: a low glow');
  for (let i = 1; i < s.looks.length; i++) assert.ok(s.looks[i].at > s.looks[i - 1].at, 'in order, no repeats');
});

test('summary() follows the best habit and copes with none', () => {
  assert.equal(summary(emptyProgress(), day(10)).looks[0].light, 'soft', 'a new learner starts warm');
  assert.equal(summary(emptyProgress(), day(10)).doneOn, null);
  const p = finishPractice(finishSession(emptyProgress(), 'a', [], day(8)), 'calm', 'c', day(10, 8));
  assert.equal(summary(p, day(10, 9)).looks[0].light, 'bright');
  assert.equal(summary(p, day(10, 9)).doneOn, '2026-10-10');
});

test('summary() asks the reminder brain for the hour and whether to speak, and defaults without it', () => {
  const p = emptyProgress();
  assert.deepEqual([summary(p, day(10)).remindAt, summary(p, day(10)).wanted], [18, true]);
  assert.deepEqual([summary(p, day(10), 3, { reminderHour: () => null, shouldRemind: () => true }).remindAt], [18], 'not enough data yet');
  const s = summary(p, day(10), 3, { reminderHour: () => 7, shouldRemind: () => false });
  assert.deepEqual([s.remindAt, s.wanted], [7, false]);
});
