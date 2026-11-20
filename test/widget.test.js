import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, STATES, leaning, look, summary, wingColours, wingState } from '../src/widget.js';
import { habitColour } from '../src/cast/butterfly.js';
import { WIDGET_LINES } from '../src/cast/lines.js';
import { emptyProgress, finishSession, finishPractice, track } from '../src/progress.js';

const day = (d, h = 12, m = 0) => new Date(2026, 9, d, h, m);

test('look() picks background, pose, butterfly and line pool from the light and the hour', () => {
  assert.deepEqual(look('bright', 9), { bg: '#FFF3DF', ink: '#3A2A12', butterfly: 'flying', art: 'butterfly-flying', pose: 'complete', lines: WIDGET_LINES.learn.done });
  assert.equal(look('soft', 9).lines, WIDGET_LINES.learn.morning);
  assert.equal(look('soft', 13, 'habits').lines, WIDGET_LINES.habits.day);
  assert.equal(look('ember', 19).lines, WIDGET_LINES.learn.evening);
  assert.equal(look('ember', 23).pose, 'sleepy');
  assert.equal(look('soft', 2).lines, WIDGET_LINES.learn.night);
  assert.equal(look('bright', 23).pose, 'complete', 'done today wins over the hour');
  assert.deepEqual(['bright', 'soft', 'ember'].map((l) => look(l, 12).butterfly), ['flying', 'basking', 'resting']);
  assert.equal(look('ember', 23).art, 'butterfly-resting-night', 'a pale body on the night sky');
  for (const [h] of BANDS) for (const lit of ['bright', 'soft', 'ember']) for (const words of ['learn', 'habits']) {
    const l = look(lit, h, words);
    assert.ok(l.lines.length && l.bg && l.ink && l.butterfly && l.art && l.pose, `${lit} at ${h}`);
    assert.ok(!('flame' in l));
  }
});

test("the widget's words follow what the learner does most, else what the intro picked", () => {
  assert.equal(leaning(emptyProgress()), 'learn');
  assert.equal(leaning({ ...emptyProgress(), picked: ['calm', 'learn'] }), 'habits');
  let p = finishPractice(finishPractice(emptyProgress(), 'calm', null, day(1)), 'walk', null, day(2));
  assert.equal(leaning({ ...p, picked: ['learn'] }), 'habits', 'what they do beats what they picked');
  assert.equal(summary(p, day(2)).remind, WIDGET_LINES.habits.remind);
  assert.equal(summary(p, day(2, 9)).looks[0].lines, WIDGET_LINES.habits.done);
  p = finishSession(finishSession(p, 'a', [], day(3)), 'b', [], day(4));
  assert.equal(leaning(p), 'learn');
});

test("your butterfly's state comes from the best habit's light: flying, basking, resting; colours from the wings", () => {
  assert.equal(wingState(emptyProgress(), day(10)), 'basking', 'before any session: basking, wings empty');
  assert.deepEqual(wingColours(emptyProgress()), []);
  const p = track(finishPractice(finishSession(emptyProgress(), 'a', [], day(8)), 'own-2', null, day(9)), { name: 'Stretch' });
  assert.equal(wingState(p, day(9, 20)), 'flying');
  assert.equal(wingState(p, day(10)), 'basking');
  assert.equal(wingState(p, day(12)), 'resting', 'after a missed day, never sad');
  assert.equal(wingState(p, day(12)), STATES[summary(p, day(12)).looks[0].light], 'the widget agrees');
  assert.deepEqual(wingColours(p), [habitColour('learn'), habitColour('own-2', 0)]);
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

test("a quiet habit's count is hidden from the widget unless shown (decision 17): null, never a number", () => {
  const p = finishPractice(emptyProgress(), 'calm', null, day(10, 8));
  const quiet = (id) => id !== 'calm';
  assert.equal(summary(p, day(10, 9)).looks[0].streak, 1, 'shown by default');
  const s = summary(p, day(10, 9), 3, undefined, quiet);
  assert.ok(s.looks.every((l) => l.habit !== 'calm' || l.streak === null));
  assert.equal(s.looks[0].habit, 'calm');
  assert.equal(s.looks[0].light, 'bright', 'the butterfly still flies');
  const learner = finishSession(p, 'a', [], day(10, 10));
  assert.equal(summary(learner, day(10, 11), 3, undefined, quiet).looks[0].streak, 1, 'a habit that shows its count keeps it');
});

test('no number on the widget before there is a streak: a count of 0 is sent as null', () => {
  assert.equal(summary(emptyProgress(), day(10, 9)).looks[0].streak, null, 'never started');
  const lapsed = finishSession(emptyProgress(), 'a', [], day(1, 10));
  assert.equal(summary(lapsed, day(10, 9)).looks[0].streak, null, 'a streak that has ended');
  assert.equal(summary(lapsed, day(1, 11)).looks[0].streak, 1, 'and a number again once there is one');
});

test("the daily note's small icon is the butterfly side-on with its wings closed, generated by tools/icon.js", async () => {
  const { readFileSync } = await import('node:fs');
  const xml = readFileSync('android/app/src/main/res/drawable/ic_butterfly.xml', 'utf8');
  assert.match(xml, /Generated by tools\/icon\.js/);
  assert.match(xml, /android:scaleX="2\.35"/, "the kit's side() view");
  assert.doesNotMatch(xml, /M57 36 C50 24/, 'not the front-on forewing');
  assert.doesNotMatch(xml, /fillColor="#(?!FFFFFF)/, 'one colour');
});
