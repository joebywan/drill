import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIRST_SQUARE, NO_STREAK, QUIET_DAY, REST_DAY } from '../src/habitview.js';
import { helpHtml } from '../src/calm/practice.js';
import { subjects } from '../src/subjects.js';
import { ACCURACY, CALM_LINES, CELEBRATIONS, FEELS, HEADLINES, HELP_LINE, LINES, PACE, STREAK_LABEL, accuracyLabel, finished, paceLabel, rightAnswer } from '../src/cast/lines.js';

// Praise the process, never the person: no ability words. No absence, loss or guilt either.
const ABILITY = /\b(smart|clever|genius|gifted|talent\w*|natural|brilliant|intelligen\w*|born to)\b/i;
const LOSS = /\b(lose|losing|lost|gone|we miss you|missed you|sad|disappoint\w*|abandon\w*|forg[eo]t\w*|broke(n)?|break(ing)? your|come back (soon|to us|tomorrow)|where were you|absen\w*|guilt\w*|shame)\b/i;

const lines = [LINES, HEADLINES, CALM_LINES].flatMap((all) => Object.entries(all).flatMap(([kind, list]) => list.map((text) => [kind, text])));
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

// Calm is a breathing coach, not a health service: no claims to treat, cure or be therapy, no
// diagnosis words, and nothing that hurries. No exclamation marks in Moss's mouth either.
const CLAIMS = /\b(therap\w*|treat\w*|cure[sd]?|curing|heal(s|ing)?|diagnos\w*|disorder\w*|panic attacks?|anxiety|depress\w*|symptom\w*|clinical\w*|medic\w*|prescri\w*|patients?)\b/i;
const URGENCY = /now!|\bhurry\b|\bdon'?t miss\b|\bquick(ly)?\b|\bfast(er)?\b|\bright now\b|\blast chance\b|\btoo late\b|\bstreak\b|!/i;

const calmCourse = JSON.parse(readFileSync('src/data/calm.json', 'utf8'));
const strings = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
const calmText = [
  ...Object.entries(CALM_LINES).flatMap(([kind, list]) => list.map((text) => [kind, text])),
  ...strings(calmCourse).filter((t) => /\s/.test(t)).map((text) => ['calm.json', text]),
  ...FEELS.map(([, label]) => ['feel', label]),
  ['help', HELP_LINE],
];

test('Calm makes no health claims and never hurries', () => {
  assert.ok(calmText.length > 40);
  for (const [kind, text] of calmText) {
    assert.doesNotMatch(text, CLAIMS, `${kind}: ${text}`);
    assert.doesNotMatch(text, URGENCY, `${kind}: ${text}`);
    assert.doesNotMatch(text, ABILITY, `${kind}: ${text}`);
    assert.doesNotMatch(text, LOSS, `${kind}: ${text}`);
  }
  // The lint itself catches what it is for.
  for (const bad of ['This is therapy.', 'It can treat stress.', 'A cure for worry', 'Stops a panic attack', 'For anxiety disorder'])
    assert.match(bad, CLAIMS, bad);
  for (const bad of ['Breathe now!', 'Hurry up', "Don't miss today"]) assert.match(bad, URGENCY, bad);
});

test('real help is reachable from Calm, as plain text', () => {
  assert.equal(HELP_LINE, "If you're struggling, talk to someone. In Australia, Lifeline is 13 11 14, any time.");
  // On the first Calm lesson...
  assert.equal(calmCourse.units[0].lessons[0].items[0].help, true);
  // ...and after "Not really". The number is text; the tel: link is only an extra.
  assert.deepEqual(FEELS.find(([, label]) => label === 'Not really'), ['no different', 'Not really']);
  const calmSubject = subjects.find((x) => x.habit === 'calm');
  assert.equal(calmSubject.coach.help, helpHtml, 'Calm supplies the help line to the end screen');
  assert.match(readFileSync('src/app.js', 'utf8'), /feel === 'no different' && who\.help\) .*who\.help\(\)/);
  const html = helpHtml();
  assert.ok(html.replace(/<[^>]+>/g, '').includes(HELP_LINE), html);
  assert.match(html, /href="tel:131114"/);
});

test('the end of a practice session is not a celebration', () => {
  for (const kind of Object.keys(CALM_LINES)) assert.ok(!CELEBRATIONS.includes(kind), kind);
});
