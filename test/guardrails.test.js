import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIRST_SQUARE, NO_STREAK, QUIET_DAY, REST_DAY } from '../src/habitview.js';
import { ACCURACY, CELEBRATIONS, HEADLINES, LINES, PACE, STREAK_LABEL, accuracyLabel, finished, paceLabel, rightAnswer } from '../src/cast/lines.js';

// Praise the process, never the person: no ability words. No absence, loss or guilt either.
const ABILITY = /\b(smart|clever|genius|gifted|talent\w*|natural|brilliant|intelligen\w*|born to)\b/i;
const LOSS = /\b(lose|losing|lost|gone|we miss you|missed you|sad|disappoint\w*|abandon\w*|forg[eo]t\w*|broke(n)?|break(ing)? your|come back (soon|to us|tomorrow)|where were you|absen\w*|guilt\w*|shame)\b/i;

const lines = [LINES, HEADLINES].flatMap((all) => Object.entries(all).flatMap(([kind, list]) => list.map((text) => [kind, text])));
const labels = [...ACCURACY, ...PACE].map(([, label]) => label).concat(STREAK_LABEL, QUIET_DAY, REST_DAY, NO_STREAK, FIRST_SQUARE);

test('end-screen headlines and chip labels pass the same lint', () => {
  for (const [kind, list] of Object.entries(HEADLINES)) {
    assert.ok(list.length, kind);
    assert.ok(LINES[kind]?.length, `${kind} has sublines`);
    for (const text of list) {
      assert.doesNotMatch(text, ABILITY, `${kind}: ${text}`);
      assert.doesNotMatch(text, LOSS, `${kind}: ${text}`);
    }
  }
  for (const text of labels) {
    assert.doesNotMatch(text, ABILITY, text);
    assert.doesNotMatch(text, LOSS, text);
  }
});

test('every way a session ends has a headline, and chip bands cover every value', () => {
  const flags = [true, false];
  for (const review of flags) for (const perfect of flags) for (const relit of flags) for (const fast of flags) for (const missed of flags)
    assert.ok(HEADLINES[finished({ review, perfect, relit, fast, missed })]?.length);
  assert.equal(accuracyLabel(100), 'SPOT ON');
  assert.equal(accuracyLabel(85), 'SOLID');
  assert.equal(accuracyLabel(0), 'GETTING THERE');
  assert.equal(paceLabel(5), 'BLAZING');
  assert.equal(paceLabel(10), 'SWIFT');
  assert.equal(paceLabel(600), 'STEADY');
});

test('no character line praises ability', () => {
  for (const [kind, text] of lines) assert.doesNotMatch(text, ABILITY, `${kind}: ${text}`);
});

test('no character line mentions absence, loss or guilt', () => {
  for (const [kind, text] of lines) assert.doesNotMatch(text, LOSS, `${kind}: ${text}`);
});

test('what Rosa says mid-puzzle passes the same lint', () => {
  const said = [...readFileSync('src/chess/exercise.js', 'utf8').matchAll(/say\(`([^`]*)`/g)].map((m) => m[1]);
  assert.ok(said.length > 0);
  for (const text of said) {
    assert.doesNotMatch(text, ABILITY, text);
    assert.doesNotMatch(text, LOSS, text);
  }
});

test('celebrations fire only on whitelisted learning events', () => {
  const fired = new Set([
    ...Array.from({ length: 12 }, (_, run) => rightAnswer(run)),
    ...[true, false].flatMap((review) => [true, false].flatMap((perfect) => [true, false].flatMap((relit) =>
      [true, false].flatMap((fast) => [true, false].map((missed) => finished({ review, perfect, relit, fast, missed })))))),
  ]);
  for (const kind of fired) assert.ok(CELEBRATIONS.includes(kind) || ['correct', 'complete', 'review', 'struggled'].includes(kind), kind);
  for (const kind of CELEBRATIONS) assert.ok(LINES[kind]?.length, `${kind} has lines`);
});

test('there are no points: no XP anywhere in the app', () => {
  for (const file of ['src/app.js', 'src/progress.js', 'src/cast/lines.js']) {
    const code = readFileSync(file, 'utf8').replace(/points from earlier builds|const \{ xp, \.\.\.kept \}/g, '');
    assert.doesNotMatch(code, /\bxp\b|\bpoints\b/i, file);
  }
});
