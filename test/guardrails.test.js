import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CELEBRATIONS, LINES, finished, rightAnswer } from '../src/cast/lines.js';

// Praise the process, never the person: no ability words. No absence, loss or guilt either.
const ABILITY = /\b(smart|clever|genius|gifted|talent\w*|natural|brilliant|intelligen\w*|born to)\b/i;
const LOSS = /\b(lose|losing|lost|gone|we miss you|missed you|sad|disappoint\w*|abandon\w*|forg[eo]t\w*|broke(n)?|break(ing)? your|come back (soon|to us|tomorrow)|where were you|absen\w*|guilt\w*|shame)\b/i;

const lines = Object.entries(LINES).flatMap(([kind, list]) => list.map((text) => [kind, text]));

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
    ...[true, false].flatMap((review) => [true, false].flatMap((perfect) => [true, false].map((relit) => finished({ review, perfect, relit })))),
  ]);
  for (const kind of fired) assert.ok(CELEBRATIONS.includes(kind) || ['correct', 'complete', 'review'].includes(kind), kind);
  for (const kind of CELEBRATIONS) assert.ok(LINES[kind]?.length, `${kind} has lines`);
});

test('there are no points: no XP anywhere in the app', () => {
  for (const file of ['src/app.js', 'src/progress.js', 'src/cast/lines.js']) {
    const code = readFileSync(file, 'utf8').replace(/points from earlier builds|const \{ xp, \.\.\.kept \}/g, '');
    assert.doesNotMatch(code, /\bxp\b|\bpoints\b/i, file);
  }
});
