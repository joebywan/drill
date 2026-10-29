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

test('no celebration is decided by XP', () => {
  const app = readFileSync('src/app.js', 'utf8');
  assert.match(app, /celebrate\(.*\bperfect\)/, 'confetti follows a perfect lesson');
  assert.doesNotMatch(app, /\bxp\s*(>=?|<=?|[!=]==?|%)\s*[\w(]/, 'nothing compares XP to decide a reaction');
});
