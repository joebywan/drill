import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { FIRST_SQUARE, NO_STREAK, QUIET_DAY, REST_DAY } from '../src/habitview.js';
import { helpHtml } from '../src/practice/kit.js';
import { subjects } from '../src/subjects.js';
import { ACCURACY, BREAK_LINES, SAFETY_LINE, CALM_LINES, REFLECT_LINES, MOVE_LINES, MOVE_SAFETY, CELEBRATIONS, FEELS, feelsFor, HEADLINES, HELP_LINE, LINES, PACE, STREAK_LABEL, accuracyLabel, finished, paceLabel, rightAnswer } from '../src/cast/lines.js';

// Praise the process, never the person: no ability words. No absence, loss or guilt either.
const ABILITY = /\b(smart|clever|genius|gifted|talent\w*|natural|brilliant|intelligen\w*|born to)\b/i;
const LOSS = /\b(lose|losing|lost|gone|we miss you|missed you|sad|disappoint\w*|abandon\w*|forg[eo]t\w*|broke(n)?|break(ing)? your|come back (soon|to us|tomorrow)|where were you|absen\w*|guilt\w*|shame)\b/i;

const lines = [LINES, HEADLINES, CALM_LINES, BREAK_LINES, REFLECT_LINES, MOVE_LINES].flatMap((all) => Object.entries(all).flatMap(([kind, list]) => list.map((text) => [kind, text])));
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
  ...subjects.filter((x) => x.kind === 'practice').flatMap((x) => feelsFor(x.coach.feel).map(([, label]) => ['feel', label])),
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
  assert.equal(calmSubject.coach.help.text, HELP_LINE, 'Calm supplies the help line to the end screen');
  assert.match(readFileSync('src/app.js', 'utf8'), /feel === 'no different' && who\.help\) .*helpHtml\(who\.help\)/);
  const html = helpHtml(calmSubject.coach.help);
  assert.ok(html.replace(/<[^>]+>/g, '').includes(HELP_LINE), html);
  assert.match(html, /href="tel:131114"/);
});

test('the end of a practice session is not a celebration', () => {
  for (const kind of [...Object.keys(CALM_LINES), ...Object.keys(REFLECT_LINES)]) assert.ok(!CELEBRATIONS.includes(kind), kind);
});

// Reflect is three lines kept for the learner: what Lumi says and the prompts get Calm's lint (no
// claims, no hurry, no guilt). What the learner types is theirs, so nothing here ever lints it.
const reflectCourse = JSON.parse(readFileSync('src/data/reflect.json', 'utf8'));
const reflectText = [
  ...Object.entries(REFLECT_LINES).flatMap(([kind, list]) => list.map((text) => [kind, text])),
  ...strings(reflectCourse).filter((t) => /\s/.test(t)).map((text) => ['reflect.json', text]),
];

test('Reflect makes no claims, never hurries and never judges', () => {
  assert.ok(reflectText.length > 20);
  for (const [kind, text] of reflectText) {
    for (const rule of [CLAIMS, URGENCY, ABILITY, LOSS]) assert.doesNotMatch(text, rule, `${kind}: ${text}`);
    assert.doesNotMatch(text, /\b(should|must|wrong|bad|better|best|score\w*|grade\w*|rate|marks?)\b/i, `${kind}: ${text}`);
  }
});

const sources = (dir) => readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter((f) => f.isFile() && f.name.endsWith('.js')).map((f) => `${f.parentPath ?? f.path}/${f.name}`);

test('journal text is read only by the habit view and the file export, and nothing is sent anywhere', () => {
  const touch = sources('src').filter((f) => /journal/.test(readFileSync(f, 'utf8'))).sort();
  // progress.js keeps the shape (migrate, writeJournal); reflect/practice.js writes it and is the
  // habit view's dayDetail; app.js only hands it from the routine to writeJournal.
  assert.deepEqual(touch, ['src/app.js', 'src/progress.js', 'src/reflect/practice.js']);
  assert.doesNotMatch(readFileSync('src/app.js', 'utf8'), /progress\.journal|\.journal\b/, 'app.js never reads the journal itself');
  // The export is the whole progress object, journal included, saved to the learner's own file.
  assert.match(readFileSync('src/app.js', 'utf8'), /new Blob\(\[JSON\.stringify\(progress\)\]/);
  for (const f of sources('src')) assert.doesNotMatch(readFileSync(f, 'utf8'), /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/, f);
});

// The screen break: no health claims, no urgency, no guilt, and no screen-time shaming.
import { STEPS } from '../src/break/routines.js';
const BREAK_CLAIMS = /\b(prevent\w*|cure[sd]?|fix(es|ed)? (your )?posture|eye strain|strain|protect\w*|improve\w* (your )?(eyes|eyesight|vision|posture)|healthy|health)\b/i;
const SHAMING = /\b(too (long|much)|addict\w*|screen time|glued|hooked|doomscroll\w*|you'?ve been on|should(n'?t)?|must)\b/i;
const breakCourse = JSON.parse(readFileSync('src/data/break.json', 'utf8'));
const breakText = [
  ...Object.entries(BREAK_LINES).flatMap(([kind, list]) => list.map((text) => [kind, text])),
  ...strings(breakCourse).filter((t) => /\s/.test(t)).map((text) => ['break.json', text]),
  ...STEPS.map((s) => ['step', `${s.name}: ${s.line}`]),
  ['safety', SAFETY_LINE],
];

test('the screen break makes no health claims, never hurries and never shames screen time', () => {
  assert.ok(breakText.length > 20);
  for (const [kind, text] of breakText) {
    for (const bad of [CLAIMS, BREAK_CLAIMS, URGENCY, SHAMING, ABILITY, LOSS]) assert.doesNotMatch(text, bad, `${kind}: ${text}`);
  }
  for (const bad of ['Prevents eye strain', 'This cures headaches', 'Fixes posture', 'It fixes your posture']) assert.match(bad, BREAK_CLAIMS, bad);
  for (const bad of ["You've been on your phone too long", 'Addicted to scrolling?', 'Too much screen today']) assert.match(bad, SHAMING, bad);
});

test('the screen break says to move gently, on the first lesson and after "Not really"', () => {
  assert.equal(SAFETY_LINE, 'Move gently and stop if anything hurts.');
  assert.equal(breakCourse.units[0].lessons[0].items[0].help, true);
  const breakHelp = subjects.find((x) => x.habit === 'break').coach.help;
  assert.equal(breakHelp.text, SAFETY_LINE);
  assert.ok(helpHtml(breakHelp).includes(SAFETY_LINE));
  for (const kind of Object.keys(BREAK_LINES)) assert.ok(!CELEBRATIONS.includes(kind), kind);
});

// Move is gentle movement, never a workout that pushes: no "no pain, no gain", nothing about
// bodies' size or shape, no weight loss and no calorie numbers. Safety comes first and stays visible.
const PUSHING = /no pain|no gain|push (through|it|harder|yourself)|\bburn\w*|\bharder\b|\bfaster\b|\bmax(imum|ed)?\b|\bbeast\b|every rep counts|\bkill\w*|\bcrush\w*|\bsweat\w*|\bhurry\b|\bquick(ly)?\b|don'?t stop|keep going|\bearn\w*|\blazy\b|\bwimp\w*|\bweak\w*|\bgo hard\b/i;
const BODY = /\bweight\b|\bfat\b|\bcalor\w*|\bkcal\b|\bslim\w*|\bthin(ner)?\b|\bbikini\b|beach body|\btone[sd]?\b|\btoning\b|\bflab\w*|\bbelly\b|\bskinny\b|\bdiet\w*|\bshape up\b|\bbody goals?\b|\bwaist\w*/i;
const CALORIE_NUMBERS = /\d+\s*(k?cal|calories)/i;

const moveCourse = JSON.parse(readFileSync('src/data/move.json', 'utf8'));
const moveText = [
  ...Object.entries(MOVE_LINES).flatMap(([kind, list]) => list.map((text) => [kind, text])),
  ...strings(moveCourse).filter((t) => /\s/.test(t)).map((text) => ['move.json', text]),
  ...[...readFileSync('src/move/practice.js', 'utf8').matchAll(/`([^`$]*)/g)].map((m) => ['practice.js', m[1]]),
  ['safety', MOVE_SAFETY],
];

test('Move never pushes, never body-shames, and has no calorie numbers', () => {
  assert.ok(moveText.length > 40);
  for (const [kind, text] of moveText) {
    for (const lint of [PUSHING, BODY, CALORIE_NUMBERS, ABILITY, LOSS]) assert.doesNotMatch(text, lint, `${kind}: ${text}`);
  }
  // The lint itself catches what it is for.
  for (const bad of ['No pain, no gain', 'Push through it', 'Feel the burn', 'Go harder', 'Faster now', 'Max effort', 'Beast mode', 'Every rep counts'])
    assert.match(bad, PUSHING, bad);
  for (const bad of ['Lose weight', 'Burn fat', 'Burn calories', 'Get slim', 'Bikini season', 'Beach body ready'])
    assert.match(bad, BODY, bad);
  assert.match('That burned 120 calories', CALORIE_NUMBERS);
});

test('the safety line is on the first Move lesson and after "Not really"', () => {
  assert.equal(MOVE_SAFETY, 'Move gently and stop if anything hurts. If you have an injury or a health condition, check with a doctor first.');
  assert.equal(moveCourse.units[0].lessons[0].items[0].help, true);
  const moveSubject = subjects.find((x) => x.habit === 'move');
  assert.equal(moveSubject.coach.help.text, MOVE_SAFETY, 'Move supplies the safety line to the end screen');
  assert.ok(helpHtml(moveSubject.coach.help).replace(/<[^>]+>/g, '').includes(MOVE_SAFETY));
  for (const kind of Object.keys(MOVE_LINES)) assert.ok(!CELEBRATIONS.includes(kind), kind);
});

test('every practice habit answers each "How do you feel?" reply in its own coach\'s voice', () => {
  for (const s of subjects.filter((x) => x.kind === 'practice'))
    for (const [value] of feelsFor(s.coach.feel)) assert.ok(s.coach.lines[value]?.length, `${s.habit}: ${value}`);
});

// The garden: every achievement line and stage name is gentle. Nothing is lost, nothing is owed.
import { RULES as GARDEN_RULES, STAGES as GARDEN_STAGES } from '../src/garden/model.js';

test('garden text has no loss, guilt, urgency or ability words', () => {
  const texts = [...GARDEN_RULES.map((r) => r.text), ...GARDEN_STAGES.map((s) => s.name)];
  assert.ok(texts.length > 10);
  for (const text of texts) for (const lint of [LOSS, URGENCY, ABILITY]) assert.doesNotMatch(text, lint, text);
});
