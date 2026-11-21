import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { FIRST_SQUARE, NO_STREAK, QUIET_DAY, REST_DAY, streakLine } from '../src/habitview.js';
import { helpHtml } from '../src/practice/kit.js';
import { subjects } from '../src/subjects.js';
import { explanation as chessExplanation, kind as chessKind } from '../src/chess/items.js';
import unitHelp from '../src/data/help.json' with { type: 'json' };
import lessonHelp from '../src/data/lesson-help.json' with { type: 'json' };
import { DARES_LABEL, QUIET_STREAK_LABEL, SOUND_LABEL, GAME_WORDS, MOVE_ON, HELLO, ACCURACY, BREAK_LINES, FOCUS_LINES, CALM_SOUNDS, SAFETY_LINE, CALM_LINES, REFLECT_LINES, REFLECT_WORDS, MOVE_LINES, MOVE_SAFETY, KAEDE_LINES, KAEDE_HEADLINES, MATHS_LINES, MATHS_HEADLINES, CELEBRATIONS, FEELS, feelsFor, HEADLINES, HELP_LINE, LINES, PACE, STREAK_LABEL, accuracyLabel, finished, paceLabel, rightAnswer } from '../src/cast/lines.js';

// Praise the process, never the person: no ability words, nothing about what the learner is ("you are a…",
// "you think like a programmer", "read like a local"), and no speed as a virtue of theirs ("you read fast").
// No absence, loss or guilt either.
const ABILITY = new RegExp([
  /\b(smart|clever|genius|gifted|talent\w*|natural|brilliant|intelligen\w*|born to)\b/,
  /\byou(?:'re| are) (?:already |so |such |really |a |an )*(?:\w+ )?(?:good|great|gifted|expert|pro|programmer|coder|mathematician|player|reader|star|whiz|wizard|master|champion|local|native)\b/,
  /\b(?:you|they) (?:think|read|play|count|code|talk|sound)s? like\b/,
  /\blike an? (?:local|native|pro|programmer|coder|mathematician|grandmaster|champion|master|expert|genius)\b/,
  /\byou(?:'re| are)? (?:\w+ )?(?:fast|quick|speedy|swift|rapid)(?:ly)?\b/,
].map((r) => r.source).join('|'), 'i');
const LOSS = /\b(lose|losing|lost|gone|we miss you|missed you|sad|disappoint\w*|abandon\w*|forg[eo]t\w*|broke(n)?|break(ing)? your|come back (soon|to us|tomorrow)|where were you|absen\w*|guilt\w*|shame)\b/i;

const hellos = [
  ...Object.entries(HELLO).flatMap(([who, h]) => [h.line, ...h.expect, h.go].map((text) => [`hello ${who}`, text])),
  ...Object.entries(unitHelp).flatMap(([course, units]) => Object.entries(units).map(([unit, text]) => [`help ${course} ${unit}`, text])),
  ...Object.entries(lessonHelp).flatMap(([course, all]) => Object.entries(all).map(([id, text]) => [`help ${course} ${id}`, text])),
  ['move on', MOVE_ON],
];
const lines = [...hellos, ...[LINES, HEADLINES, KAEDE_LINES, KAEDE_HEADLINES, MATHS_LINES, MATHS_HEADLINES, CALM_LINES, BREAK_LINES, REFLECT_LINES, MOVE_LINES].flatMap((all) => Object.entries(all).flatMap(([kind, list]) => list.map((text) => [kind, text])))];
const labels = [...ACCURACY, ...PACE].map(([, label]) => label).concat(DARES_LABEL, QUIET_STREAK_LABEL, SOUND_LABEL, streakLine(14, true, false), STREAK_LABEL, QUIET_DAY, REST_DAY, NO_STREAK, FIRST_SQUARE, streakLine(0, false), streakLine(0, true), streakLine(14, true));

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
  assert.equal(paceLabel(5), 'SPEEDY');
  assert.equal(paceLabel(10), 'SWIFT');
  assert.equal(paceLabel(600), 'STEADY');
});

test("a Learn coach's own lines cover every kind the lesson runner and end screen ask for", () => {
  for (const [kind, list] of Object.entries(LINES)) if (!['repair', 'welcome', 'lumi'].includes(kind) && !kind.includes(':')) assert.ok(KAEDE_LINES[kind]?.length, `Kaede: ${kind}`);
  for (const kind of Object.keys(HEADLINES)) assert.ok(KAEDE_HEADLINES[kind]?.length, `Kaede headline: ${kind}`);
  for (const s of subjects.filter((x) => x.kind === 'learn' && x.coach.lines))
    for (const kind of [...CELEBRATIONS.filter((k) => !WING_WORDS[k]), 'correct', 'wrong', 'tapped']) assert.ok(s.coach.lines[kind]?.length, `${s.id}: ${kind}`);
});

test('no character line praises ability', () => {
  for (const [kind, text] of lines) assert.doesNotMatch(text, ABILITY, `${kind}: ${text}`);
});

test('"beat" means a rhythm or a wing, never winning: no character says it', () => {
  const voices = readdirSync('src/cast/voice').map((f) => JSON.parse(readFileSync(`src/cast/voice/${f}`, 'utf8')));
  const said = [...lines.map(([, text]) => text), ...strings(GAME_WORDS), ...voices.flatMap((v) => strings([v.lines, v.dares]))];
  // A kana is "one beat" (rhythm, fine); beating someone is winning.
  const WINNING = /\b(beaten|(ever|never|still|can|to) beat|beat(s|ing)? (me|you|him|her|them|us|every\w*))\b/i;
  for (const text of said) assert.doesNotMatch(text, WINNING, text);
});

test('no character line mentions absence, loss or guilt', () => {
  for (const [kind, text] of lines) assert.doesNotMatch(text, LOSS, `${kind}: ${text}`);
});

test("Ada's lines cover every kind the runner asks for, and the maths course passes the lint", () => {
  for (const kind of Object.keys(LINES).filter((k) => !['repair', 'welcome', 'lumi'].includes(k) && !k.includes(':'))) assert.ok(MATHS_LINES[kind]?.length, kind);
  for (const kind of Object.keys(HEADLINES)) assert.ok(MATHS_HEADLINES[kind]?.length, kind);
  const all = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(all) : []);
  const maths = all(JSON.parse(readFileSync('src/data/maths.json', 'utf8'))).filter((t) => /\s/.test(t));
  assert.ok(maths.length > 50);
  for (const text of maths) {
    assert.doesNotMatch(text, ABILITY, text);
    assert.doesNotMatch(text, LOSS, text);
  }
});

test('what Rosa says mid-puzzle passes the same lint', () => {
  // Her lines are constants and small functions now (one each, for the room the bubble keeps): every sentence in the file.
  const said = [...readFileSync('src/chess/exercise.js', 'utf8').matchAll(/(['"`])((?:(?!\1)[^\n\\])* (?:(?!\1)[^\n\\])*[.?}])\1/g)].map((m) => m[2]);
  assert.ok(said.some((t) => t.startsWith('Not that one.')) && said.some((t) => t.startsWith('Out of moves.')) && said.some((t) => t.startsWith('It can go further')), said.join(' | '));
  for (const text of said) {
    assert.doesNotMatch(text, ABILITY, text);
    assert.doesNotMatch(text, LOSS, text);
  }
});

test('everything the chess course shows passes the same lint: cards, prompts and explanations, worked-out ones too', () => {
  const chess = subjects.find((x) => x.id === 'chess');
  const said = chess.units.flatMap((u) => u.lessons.flatMap((l) => l.items))
    .flatMap((i) => [i.text, i.intro, i.prompt, ...(chessKind(i) === 'teach' ? [] : chessExplanation(i))]).filter(Boolean);
  assert.ok(said.length > 400);
  const WINNING = /\b(beaten|(ever|never|still|can|to) beat|beat(s|ing)? (me|you|him|her|them|us|every\w*))\b/i;
  for (const text of new Set(said)) {
    assert.doesNotMatch(text, ABILITY, text);
    assert.doesNotMatch(text, LOSS, text);
    assert.doesNotMatch(text, WINNING, text);
    assert.doesNotMatch(text, /\b[KQRBN][a-h]?x?[a-h][1-8]\b|O-O/, `no notation: ${text}`);
  }
});

test("what Rosa says in the chess games passes the same lint", () => {
  const all = (v) => (typeof v === 'string' ? [v] : typeof v === 'function' ? [v(3, 'A move')] : Object.values(v).flatMap(all));
  const said = all(GAME_WORDS);
  assert.ok(said.length > 30);
  for (const text of said) {
    assert.doesNotMatch(text, ABILITY, text);
    assert.doesNotMatch(text, LOSS, text);
    assert.doesNotMatch(text, /\b(xp|hearts?|league|oscar|stockfish)\b/i, text);
    assert.doesNotMatch(text, /\b[KQRBN][a-h]?x?[a-h][1-8]\b/, `no notation: ${text}`);
  }
});

test('celebrations fire only on whitelisted learning events', () => {
  const fired = new Set([
    ...Array.from({ length: 12 }, (_, run) => rightAnswer(run)),
    ...[true, false].flatMap((review) => [true, false].flatMap((perfect) => [true, false].flatMap((relit) =>
      [true, false].flatMap((fast) => [true, false].map((missed) => finished({ review, perfect, relit, fast, missed })))))),
  ]);
  for (const kind of fired) assert.ok(CELEBRATIONS.includes(kind) || ['correct', 'complete', 'review', 'struggled'].includes(kind), kind);
  for (const kind of CELEBRATIONS) assert.ok((LINES[kind] ?? WING_WORDS[kind])?.length, `${kind} has lines`);
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
  ...CALM_SOUNDS.map(([name, label]) => [name, label]),
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
  ...[REFLECT_WORDS.lookBack(true, 'Friday', 'good thing'), REFLECT_WORDS.lookBack(false, 'Friday', 'good thing'), REFLECT_WORDS.readBack].map((text) => ['words', text]),
];

const JUDGE = /\b(should|must|wrong|bad|better|best|score\w*|grade\w*|rate|marks?)\b/i;

test('Reflect makes no claims, never hurries and never judges', () => {
  assert.ok(reflectText.length > 20);
  assert.ok(reflectText.some(([, text]) => text === reflectCourse.tip), 'the mic tip is linted');
  for (const [kind, text] of reflectText) {
    for (const rule of [CLAIMS, URGENCY, ABILITY, LOSS]) assert.doesNotMatch(text, rule, `${kind}: ${text}`);
    assert.doesNotMatch(text, JUDGE, `${kind}: ${text}`);
  }
});

const sources = (dir) => readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter((f) => f.isFile() && f.name.endsWith('.js')).map((f) => `${f.parentPath ?? f.path}/${f.name}`);

test('journal text is read only by the habit view and the file export, and nothing is sent anywhere', () => {
  const touch = sources('src').filter((f) => /journal/.test(readFileSync(f, 'utf8'))).sort();
  // progress.js keeps the shape (migrate, writeJournal); reflect/ and focus/practice.js write it and are the
  // habit view's dayDetail; app.js only hands it from the routine to writeJournal.
  // sync/merge.js merges two devices' journals; sync/sync.js seals the whole progress before it leaves.
  assert.deepEqual(touch, ['src/app.js', 'src/focus/practice.js', 'src/progress.js', 'src/reflect/practice.js', 'src/sync/merge.js']);
  assert.doesNotMatch(readFileSync('src/app.js', 'utf8'), /progress\.journal|\.journal\b/, 'app.js never reads the journal itself');
  // The export is the whole progress object, journal included, saved to the learner's own file.
  assert.match(readFileSync('src/app.js', 'utf8'), /new Blob\(\[JSON\.stringify\(progress\)\]/);
  // Only opt-in sync talks to a server, and it sends progress sealed (AES-GCM) and a card of presets and numbers.
  for (const f of sources('src').filter((f) => f !== 'src/sync/sync.js')) assert.doesNotMatch(readFileSync(f, 'utf8'), /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/, f);
  const sync = readFileSync('src/sync/sync.js', 'utf8');
  assert.equal(sync.match(/\bfetch\(/g).length, 1, 'one fetch, in call()');
  assert.match(sync, /blob: await seal\(key, merged\)/, 'progress leaves sealed');
});

// Sync and friends: preset names, animals and cheers only, linted like the cast; the screens' words too.
import { CHEERS, WORDS, ANIMALS } from '../src/sync/presets.js';
test('friends see presets only, and the sync screens never nag, hurry or judge', () => {
  const ui = readFileSync('src/sync/ui.js', 'utf8');
  // Every string and template in the screens, with tags and ${…} taken out: what the learner reads.
  const said = [...ui.matchAll(/`([^`]*)`|'([^'\n]*)'|"([^"\n]*)"/g)]
    .map((m) => (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}?/g, ' ').replace(/<[^>]*>/g, ' ').trim()).filter((t) => /[a-z] [a-z]/i.test(t));
  assert.ok(said.length > 10);
  for (const text of [...Object.values(CHEERS), ...WORDS, ...Object.values(ANIMALS).map(([, n]) => n), ...said]) {
    assert.doesNotMatch(text, ABILITY, text);
    assert.doesNotMatch(text, LOSS, text);
    assert.doesNotMatch(text, /\b(hurry|now or never|don'?t miss|last chance|before it'?s too late)\b/i, text);
  }
  assert.doesNotMatch(ui, /<textarea|contenteditable/, 'no free text goes to friends');
  assert.ok(!Object.values(ANIMALS).some(([, n]) => /owl/i.test(n)), 'no owls');
});

// The screen break: no health claims, no urgency, no guilt, and no screen-time shaming.
import { STEPS } from '../src/break/routines.js';
const BREAK_CLAIMS = /\b(prevent\w*|cure[sd]?|fix(es|ed)? (your )?posture|eye strain|strain|protect\w*|improve\w* (your )?(eyes|eyesight|vision|posture)|healthy|health)\b/i;
const SHAMING = /\b(too (long|much)|addict\w*|screen time|glued|hooked|doomscroll\w*|you'?ve been on|should(n'?t)?|must)\b/i;
const breakCourse = JSON.parse(readFileSync('src/data/break.json', 'utf8'));
const breakText = [
  ...Object.entries(BREAK_LINES).flatMap(([kind, list]) => list.map((text) => [kind, text])),
  ...strings(breakCourse).filter((t) => /\s/.test(t)).map((text) => ['break.json', text]),
  ...STEPS.flatMap((s) => [['step', `${s.name}: ${s.line}`], ...s.how.map((text) => [`how ${s.name}`, text])]),
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
import { EVENTS as GARDEN_EVENTS } from '../src/garden/events.js';
import { LIFE_WORDS, RULES as GARDEN_RULES, STAGES as GARDEN_STAGES, creatures as gardenCreatures, flowersOpened, moreArrived, plantWords, stage as gardenStage } from '../src/garden/model.js';

test('seasonal events have no loss, guilt, urgency or ability words, and name no end date', () => {
  const strings = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
  const texts = GARDEN_EVENTS.flatMap(({ name, about, offer, text, keep, title, items }) => [name, about, offer, text, keep, title, ...items.flatMap((i) => strings({ ...i, level: null, tiles: null, fen: null }))]);
  assert.ok(texts.length > 30);
  for (const text of texts) for (const lint of [LOSS, URGENCY, ABILITY]) assert.doesNotMatch(text, lint, text);
  for (const text of texts) assert.doesNotMatch(text, /\b(ends?|until|days? left|hours? left|before it)\b/i, text);
});

test('garden text has no loss, guilt, urgency or ability words', () => {
  const screen = [0, 1, 4, 13, 29, 30, 400].flatMap((d) => Object.values(plantWords({ days: d, ...gardenStage(d) })));
  // Every raised butterfly at every stage, on home, the garden's cards and the field guide.
  const raised = [0, 1, 2, 3].flatMap((k) => gardenCreatures({ done: {}, habits: {}, garden: { earned: Object.fromEntries(GARDEN_RULES.filter((r) => r.stage === k).map((r) => [r.id, '2026-10-01'])) } }));
  const life = [...raised.flatMap((c) => [LIFE_WORDS.raising(c), LIFE_WORDS.card(c), LIFE_WORDS.by(c.name)]), LIFE_WORDS.by(null), LIFE_WORDS.title, LIFE_WORDS.open, LIFE_WORDS.source,
    ...[1, 2, 3].flatMap((stage) => [1, 2].flatMap((n) => ['unit', 'day'].map((unit) => LIFE_WORDS.next({ stage, in: n, unit })))),
    ...LIFE_WORDS.arrived.map((line) => line('Chess', 'Australian Painted Lady'))];
  assert.ok(raised.length > 50);
  const texts = [...GARDEN_RULES.map((r) => r.text), ...GARDEN_STAGES.map((s) => s.name), ...screen, ...life, moreArrived(4), flowersOpened(10), 'Your garden'];
  assert.ok(texts.length > 10);
  for (const text of texts) for (const lint of [LOSS, URGENCY, ABILITY]) assert.doesNotMatch(text, lint, text);
  for (const text of texts) assert.doesNotMatch(text, /\b(missing|locked|wilt\w*|die[sd]?|dying|dead)\b/i, text);
});

// The field guide (src/data/butterflies.json): for all ages, so the garden's lint and no alarm.
import butterflies from '../src/data/butterflies.json' with { type: 'json' };
test('field-guide lines have no loss, urgency, ability or alarm words', () => {
  const texts = butterflies.species.flatMap((s) => [s.name, ...s.lines.map((l) => l.text)]);
  assert.ok(texts.length > 40);
  for (const text of texts) for (const lint of [LOSS, URGENCY, ABILITY]) assert.doesNotMatch(text, lint, text);
  for (const text of texts) assert.doesNotMatch(text, /\b(missing|locked|wilt\w*|die[sd]?|dying|dead|death|kill\w*|endangered|threat\w*|extinct\w*|declin\w*|rare)\b/i, text);
});

// Self-reported habits: one tap means "yes, today". No nagging, no reminders, no counting toward a
// target ("8 glasses"), and the preset names and button words get the same lint as everything else.
// What learners name their own habits is theirs and is never linted.
import { PRESETS } from '../src/subjects.js';
import { CHOOSE_WORDS, LOG_WORDS } from '../src/cast/lines.js';
import { rules as gardenRules } from '../src/garden/model.js';
const NAGGING = /\b(forg[eo]t\w*|remember to|reminder|don'?t forget|you haven'?t|not yet|still haven'?t|goal\w*|target\w*|glasses|cups|litres?|liters?|steps|\d+ ?(min|minutes|pages|km|times))\b/i;

test('self-reported habit words never nag, count toward a target or judge', () => {
  const presets = { tracked: PRESETS.map((x) => ({ id: x.id })) };
  const texts = [
    ...PRESETS.flatMap((x) => [x.name, x.did, x.title]),
    ...Object.values(LOG_WORDS).flat(),
    ...Object.values(CHOOSE_WORDS),
    ...gardenRules(presets).map((r) => r.text),
  ];
  assert.ok(texts.length > 30);
  for (const text of texts) for (const lint of [NAGGING, LOSS, ABILITY, URGENCY]) assert.doesNotMatch(text, lint, text);
  for (const bad of ['Drink 8 glasses', "Don't forget to walk", 'You haven\'t walked yet', '10000 steps', 'Reach your goal']) assert.match(bad, NAGGING, bad);
});

test('a name the learner gives a habit is never linted, and is escaped wherever it is drawn', () => {
  // chip() escapes its own arguments; everything else must go through esc().
  const code = readFileSync('src/app.js', 'utf8').split('\n').filter((l) => !l.includes('chip(')).join('\n');
  for (const m of code.matchAll(/\$\{(h|shownHabit)\.(name|icon)\b[^}]*\}/g)) assert.fail(`unescaped ${m[0]}`);
  assert.doesNotMatch(readFileSync('test/guardrails.test.js', 'utf8'), /tracked\.\w*name/);
});

// The first-visit intro gets the same lint as the habit words: plain, no nagging, no urgency.
import { INTRO_WORDS } from '../src/cast/lines.js';

test('the first-visit intro never nags, hurries or judges', () => {
  const texts = strings(INTRO_WORDS);
  assert.ok(texts.length > 20);
  for (const text of texts) for (const lint of [NAGGING, LOSS, ABILITY, URGENCY]) assert.doesNotMatch(text, lint, text);
});

// Your timings: plain words, no claims beyond "if someone has given you timings, set them here".
import { TIMINGS, TIMING_WORDS } from '../src/practice/timings.js';
test('the timings screen makes no claims, never hurries and never pushes', () => {
  const words = [...Object.values(TIMING_WORDS), ...Object.values(TIMINGS).flatMap((all) => Object.values(all).map((r) => r.label))];
  assert.ok(words.length > 10);
  for (const text of words) for (const bad of [CLAIMS, URGENCY, PUSHING, BODY, ABILITY, LOSS]) assert.doesNotMatch(text, bad, text);
  assert.match(TIMING_WORDS.intro, /^If someone has given you timings, set them here\./);
});

// Coding: Fennel's lines and the course's words get the same lint as Rosa's, and his lines cover
// every kind a learn session and its end screen ask for.
import { CODE_HEADLINES, CODE_LINES, CODING_HEADLINES, CODING_LINES, RUN_ENDS } from '../src/cast/lines.js';
import codingCourse from '../src/data/coding.json' with { type: 'json' };

test("Fennel's lines and the Coding course pass the lint, and cover every kind a lesson uses", () => {
  const text = [
    ...[CODING_LINES, CODING_HEADLINES].flatMap((all) => Object.entries(all).flatMap(([kind, list]) => list.map((t) => [kind, t]))),
    ...Object.entries(RUN_ENDS).map(([end, t]) => [`RUN_ENDS.${end}`, t]),
    ...strings(codingCourse).filter((t) => /\s/.test(t)).map((t) => ['coding.json', t]),
    ...strings(JSON.parse(readFileSync('src/data/coding-variants.json', 'utf8'))).filter((t) => /\s/.test(t)).map((t) => ['coding-variants.json', t]),
    ...strings(JSON.parse(readFileSync('src/data/maths-variants.json', 'utf8'))).filter((t) => /\s/.test(t)).map((t) => ['maths-variants.json', t]),
  ];
  assert.ok(text.some(([k]) => k === 'coding.json'));
  for (const [kind, t] of text) for (const rule of [ABILITY, LOSS]) assert.doesNotMatch(t, rule, `${kind}: ${t}`);
  for (const kind of ['correct', 'wrong', 'run3', 'run5', 'tapped', ...Object.keys(HEADLINES)]) assert.ok(CODING_LINES[kind]?.length, kind);
  for (const kind of Object.keys(HEADLINES)) assert.ok(CODING_HEADLINES[kind]?.length, kind);
  const coach = subjects.find((s) => s.id === 'coding').coach;
  assert.equal(coach.lines, CODING_LINES);
  assert.equal(coach.headlines, CODING_HEADLINES);
});

test('the code courses and their lines pass the lint, and cover every kind a lesson uses', () => {
  const courses = subjects.filter((s) => s.mount === subjects.find((x) => x.id === 'javascript').mount);
  assert.equal(courses.length, 3);
  const lineText = [CODE_LINES, CODE_HEADLINES].flatMap((all) => Object.values(all).flat());
  // Code in the items is not prose: `is` the words a person reads.
  const words = (item) => [item.text, item.prompt, item.explain, ...(item.mutants ?? []).map((m) => m.says)].filter(Boolean);
  const text = [...lineText, ...courses.flatMap((c) => c.units.flatMap((u) => u.lessons.flatMap((l) => l.items.flatMap(words))))];
  assert.ok(text.length > 300);
  for (const t of text) for (const rule of [ABILITY, LOSS]) assert.doesNotMatch(t, rule, t);
  for (const kind of ['correct', 'wrong', 'run3', 'run5', 'tapped', ...Object.keys(HEADLINES)]) assert.ok(CODE_LINES[kind]?.length, kind);
  for (const kind of Object.keys(HEADLINES)) assert.ok(CODE_HEADLINES[kind]?.length, kind);
});

// Focus: a calm timer, never a productivity tool. No hurry, no claims, no guilt, and nothing that
// counts distraction or calls time wasted. Stopping early is fine, so nothing hints otherwise.
const focusCourse = JSON.parse(readFileSync('src/data/focus.json', 'utf8'));
const GRIND = /\b(distract\w*|productiv\w*|wast\w*|lazy|procrastinat\w*|fail\w*|unfocused|lost focus|give up|quit\w*|didn'?t finish|only|just \d+|should|must|better|best|score\w*)\b/i;
const focusText = [
  ...Object.entries(FOCUS_LINES).flatMap(([kind, list]) => list.map((text) => [kind, text])),
  ...strings(focusCourse).filter((t) => /\s/.test(t)).map((text) => ['focus.json', text]),
  ...feelsFor(subjects.find((x) => x.habit === 'focus').coach.feel).map(([, label]) => ['feel', label]),
  ['ask', subjects.find((x) => x.habit === 'focus').coach.ask],
];

test('Focus never hurries, claims, shames or keeps count', () => {
  assert.ok(focusText.length > 20);
  for (const [kind, text] of focusText) {
    for (const rule of [CLAIMS, URGENCY, ABILITY, LOSS, GRIND]) assert.doesNotMatch(text, rule, `${kind}: ${text}`);
  }
  for (const bad of ['You got distracted 3 times', 'Be more productive', 'Time wasted', 'You only did 4 minutes']) assert.match(bad, GRIND, bad);
  for (const kind of Object.keys(FOCUS_LINES)) assert.ok(!CELEBRATIONS.includes(kind), kind);
});

// Wind down: Calm's lint, plus no sleep claims or sleep numbers, no screen-time shaming, and the
// help line on the first lesson.
import { WINDDOWN_LINES, INTRO_WORDS as INTRO } from '../src/cast/lines.js';
const SLEEP = /\b(sleep\w*|asleep|insomnia|melatonin|blue light|hours?|\d+ ?(h|hrs?|min(ute)?s?)|deep(er)? rest|better nights?|wake (up )?refreshed|tracked?|tracking)\b/i;
const windCourse = JSON.parse(readFileSync('src/data/winddown.json', 'utf8'));
const windText = [
  ...Object.entries(WINDDOWN_LINES).flatMap(([kind, list]) => list.map((text) => [kind, text])),
  ...strings(windCourse).filter((t) => /\s/.test(t)).map((text) => ['winddown.json', text]),
  ['intro', INTRO.does.winddown],
];

test('Wind down makes no sleep or health claims, never hurries and never shames screen time', () => {
  assert.ok(windText.length > 20);
  for (const [kind, text] of windText) {
    for (const lint of [CLAIMS, SLEEP, URGENCY, SHAMING, ABILITY, LOSS]) assert.doesNotMatch(text, lint, `${kind}: ${text}`);
  }
  for (const bad of ['Sleep better tonight', 'Fall asleep in 10 minutes', 'Helps with insomnia', 'Get 8 hours', 'No blue light']) assert.match(bad, SLEEP, bad);
  assert.equal(windCourse.units[0].lessons[0].items[0].help, true, 'the help line is on the first lesson');
  const subject = subjects.find((x) => x.habit === 'winddown');
  assert.equal(subject.coach.help.text, HELP_LINE, 'and after "Not really"');
  for (const kind of Object.keys(WINDDOWN_LINES)) assert.ok(!CELEBRATIONS.includes(kind), kind);
});

// Fitting the person (src/fitting.js): the comeback invites and never counts what was missed;
// the reminders line and the habit view's usual hours are plain.
import { COMEBACK_WORDS, PAUSED_WORDS, usualLine } from '../src/fitting.js';
test('the comeback card invites, never guilts, and the fitting lines are plain', () => {
  const card = { title: 'Breathing', hour: 19 };
  const comeback = [COMEBACK_WORDS.kicker, COMEBACK_WORDS.text(card), COMEBACK_WORDS.text({ ...card, hour: null }), COMEBACK_WORDS.go(card), COMEBACK_WORDS.dismiss];
  for (const text of comeback) for (const lint of [LOSS, URGENCY, ABILITY, NAGGING]) assert.doesNotMatch(text, lint, text);
  for (const text of comeback) assert.doesNotMatch(text, /\b(miss\w*|been (a while|away)|back|again|return\w*|lately|haven'?t|stopp\w*|slipp\w*|fell|fall\w*|drop\w*|usual week|only)\b/i, text);
  const plain = [...Object.values(PAUSED_WORDS), usualLine([7, 19]), 'Try a shorter one: 3 breaths'];
  for (const text of plain) for (const lint of [LOSS, URGENCY, ABILITY]) assert.doesNotMatch(text, lint, text);
});

// The Android widget and its once-a-day note: no nagging, no hurry, nothing about a day off.
import { REMINDER_WORDS, WIDGET_LINES } from '../src/cast/lines.js';
test('the widget and the daily note never nag, hurry or judge', () => {
  const texts = [...strings(WIDGET_LINES), ...Object.values(REMINDER_WORDS)];
  assert.ok(texts.length > 30);
  // A habits-only learner hears nothing of lessons or puzzles; the done pool says "wingbeat" once.
  assert.doesNotMatch(strings(WIDGET_LINES.habits).join(' '), /lesson|puzzle/i);
  for (const pool of Object.values(WIDGET_LINES)) assert.equal(strings(pool).filter((t) => /wingbeat/i.test(t)).length, 1);
  for (const text of texts) for (const lint of [NAGGING, LOSS, ABILITY, URGENCY]) assert.doesNotMatch(text, lint, text);
});

// Coach voice (src/cast/voice/*.json): every pool line and dare gets the lint for the habits its
// coach runs, plus the words its own voice sheet says it never uses. Lines are linted with their
// slots filled. Comebacks welcome without counting the time away; dares are a playful bet in
// character, never about streaks, loss or what wasn't done.
import { VOICES } from '../src/cast/lines.js';
const PRESSURE = /\b(hurry|don'?t miss|last chance|too late|right now|you haven'?t|still haven'?t|remember to|lazy|excuses?)\b/i;
const AWAY = /\b(while|ages|away|finally|at last|long time|gap|skipp\w*|missed|where (have|were) you)\b/i;
const DARE_BAD = /\b(streak\w*|lazy|excuses?|chicken|scared|coward\w*|regret\w*|or else|too late|last chance|disappoint\w*|let (me|us|yourself) down|fail\w*|quit\w*|give up|weak\w*|you haven'?t|still haven'?t|not yet|skipp\w*|prove yourself)\b/i;
const DARE_WORD = /\b(bets?|dare)\b/i;
// Lumi also coaches the one-tap habits, so she gets their lint too.
const VOICE_LINTS = {
  rosa: [],
  moss: [CLAIMS, URGENCY],
  mira: [CLAIMS, BREAK_CLAIMS, URGENCY, SHAMING],
  clover: [PUSHING, BODY, CALORIE_NUMBERS],
  lumi: [CLAIMS, URGENCY, JUDGE, NAGGING],
  kaede: [],
  ada: [],
  fennel: [],
  hazel: [CLAIMS, URGENCY, GRIND],
  winddown: [CLAIMS, SLEEP, URGENCY, SHAMING],
};
const FACTS = { habit: 'Screen break', usualHour: 'evening', count: 12, days: 40 };
const filled = (text) => text.replace(/\{(\w+)\}/g, (_, k) => FACTS[k]);
const never = (word) => new RegExp(/^\w/.test(word) ? `\\b${word}\\b` : word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

test('every coach voice line passes its coach\'s lint and its own never-list', () => {
  assert.deepEqual(Object.keys(VOICE_LINTS).sort(), Object.keys(VOICES).sort(), 'every coach has a lint');
  let n = 0;
  for (const [id, v] of Object.entries(VOICES)) {
    const lints = [ABILITY, LOSS, PRESSURE, ...VOICE_LINTS[id], ...v.voice.never.map(never)];
    for (const { when, lines } of [...v.lines, ...v.dares]) for (const text of lines) {
      n++;
      for (const lint of lints) assert.doesNotMatch(filled(text), lint, `${id}: ${text}`);
      if (when.comeback) assert.doesNotMatch(text, AWAY, `${id} comeback: ${text}`);
    }
  }
  assert.ok(n > 150, `${n} lines`);
  for (const bad of ['Hurry, the day is nearly done', "You haven't breathed today", 'Remember to stretch']) assert.match(bad, PRESSURE, bad);
  for (const bad of ["It's been a while", 'Finally, you came back', 'Where were you?', 'You missed three days']) assert.match(bad, AWAY, bad);
  assert.match('Hello!', never('!'));
  assert.match('Do it harder', never('harder'));
});

test('dares are a bet in character, never guilt, loss or pressure', () => {
  const dares = Object.entries(VOICES).flatMap(([id, v]) => v.dares.flatMap((p) => p.lines.map((text) => [id, text])));
  assert.ok(dares.length >= 15);
  for (const [id, text] of dares) {
    assert.match(text, DARE_WORD, `${id} dare: ${text}`);
    for (const lint of [DARE_BAD, LOSS, ABILITY, PRESSURE]) assert.doesNotMatch(filled(text), lint, `${id} dare: ${text}`);
  }
  for (const bad of ["Bet you can't keep your streak", "I dare you to stop being lazy", "You haven't done it, I bet you won't", "Bet you'll give up", 'Dare you, or else', "Don't let me down"])
    assert.ok([DARE_BAD, LOSS, PRESSURE].some((lint) => lint.test(bad)), bad);
  assert.match("Moss bets you can't do three slow breaths before lunch.", DARE_WORD);
});

test("a practice coach names themselves on the path's first card", () => {
  for (const s of subjects.filter((x) => x.kind === 'practice')) {
    const first = s.units[0].lessons[0].items[0];
    assert.ok(first.say.includes(`I'm ${s.coach.name}`), `${s.id}: ${first.say}`);
  }
});

test('the wrapper can buzz and speak, and stays offline', () => {
  const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android\.permission\.VIBRATE/); // or the WebView drops navigator.vibrate
  assert.match(manifest, /android\.intent\.action\.TTS_SERVICE/); // or Android 11+ hides the TTS engine
  assert.doesNotMatch(manifest, /permission\.INTERNET/);
});

// Your butterfly: the wingbeat moment and its screen. Never sad, never counting a streak, no hurry.
import { WING_WORDS } from '../src/cast/lines.js';
test('the wingbeat and your butterfly never nag, hurry, judge or count a streak', () => {
  const texts = strings(WING_WORDS);
  assert.ok(texts.length > 12);
  for (const text of texts) for (const lint of [NAGGING, LOSS, ABILITY, URGENCY]) assert.doesNotMatch(text, lint, text);
  // "Wingbeat" is used sparingly: the moment itself, nowhere else on the screen.
  assert.deepEqual(texts.filter((t) => /wingbeat/i.test(t)), [...WING_WORDS.wingbeat, ...WING_WORDS.full]);
});

// Lumi's wardrobe: given, never bought; nothing to buy, spend or lose, and nothing expires.
import { SKIN_WORDS } from '../src/cast/lines.js';
import { SKIN_RULES } from '../src/garden/model.js';
test("the wardrobe's words never sell, hurry, judge or take away", () => {
  const texts = [...strings(SKIN_WORDS), ...Object.values(SKIN_WORDS.names).map(SKIN_WORDS.arrived), ...SKIN_RULES.map(([, , from]) => from)];
  assert.ok(texts.length > 20);
  for (const text of texts) for (const lint of [NAGGING, LOSS, ABILITY, URGENCY]) assert.doesNotMatch(text, lint, text);
  for (const text of texts) assert.doesNotMatch(text, /\b(buy|bought|shop|price|coins?|gems?|unlock\w*|locked|expir\w*|limited|exclusive|premium)\b/i, text);
});

test('a habit\'s "when" is the learner\'s own: escaped where drawn, never linted, and kept to progress, merge and app', () => {
  const touch = sources('src').filter((f) => /\.when\b/.test(readFileSync(f, 'utf8'))).sort();
  // sync/sync.js sends progress only sealed, and its friends card (card()) carries no when.
  assert.deepEqual(touch, ['src/app.js', 'src/progress.js', 'src/sync/merge.js']);
  const app = readFileSync('src/app.js', 'utf8');
  assert.doesNotMatch(app, /\$\{\s*(progress\.when\[|set\b)/, 'drawn only through esc()');
  assert.equal(app.match(/esc\(progress\.when\[/g).length, 2, 'the panel and the habit view');
});

// --- Words that fit what just happened -------------------------------------------------------

import { doing, verdicts } from '../src/cast/lines.js';
import { LIFE_WORDS as LIFE } from '../src/garden/model.js';

test('the ability lint catches praise of what the learner is, and lets praise of what they did through', () => {
  for (const bad of ['Yes! Read like a local.', 'Five in a row! You think like a programmer: one step at a time.', 'Done already? You read fast.',
    "You're a natural.", 'You are quick!', "You're already good at the basic version.", 'You are a real coder now.'])
    assert.match(bad, ABILITY, bad);
  for (const fine of ['Five in a row. You are reading it like the computer does.', 'Quick and right, every one.', 'Fast, and right first time, every one.',
    'Spot on. Every block, followed through.', 'Done already? My tea is still hot!'])
    assert.doesNotMatch(fine, ABILITY, fine);
});

// What a verdict line may only say of some items, by how the item was answered (doing() in lines.js).
const ONLY = {
  // Seeing the thing asked about: never said of a sound.
  sight: [/\b(look(ed)? at|shape|strokes?|seen|page|good eyes)\b/i, (how) => how !== 'hear'],
  // A piece moved on the board.
  move: [/\b(the move|a move|played|leapt|attacks|opponent)\b/i, (how) => how === 'move'],
  // Pieces of a program or sentence put together and run.
  write: [/\b(runs|plan works|right order|in its place|only a run|running it|one word|useful one to try|what the blocks did|fussy about order)\b/i, (how) => how === 'write'],
  // A sound heard.
  ears: [/\b(your ears|how that one sounds|sounds that close)\b/i, (how) => how === 'hear'],
  // Reading something shown, or code that ran.
  reading: [/\bactually reading\b/i, (how) => how === 'look'],
  ran: [/\bthat ran\b/i, (how) => how === 'write'],
};

test('every verdict line fits the kind of item it answers: no "look at the strokes" on a sound, no "the move" on a tap', () => {
  const learn = subjects.filter((s) => s.kind === 'learn');
  const seen = new Set();
  for (const s of learn) {
    const lines = s.coach.lines || LINES;
    for (const key of Object.keys(lines).filter((k) => k.includes(':')))
      assert.ok(['move', 'write', 'look', 'hear'].includes(key.split(':')[1]), `${s.id}: ${key} is for a way of answering doing() gives`);
    const items = s.units.flatMap((u) => u.lessons.flatMap((l) => l.items || []));
    // Japanese asks by ear on a repeat (quiz/vary.js): every pick can come as a listening item.
    const asked = [...items, ...items.filter((i) => i.type === 'pick').map((i) => ({ ...i, listen: true }))];
    for (const how of new Set(asked.map(doing))) {
      seen.add(how);
      for (const kind of ['correct', 'run3', 'run5', 'wrong']) {
        for (const text of verdicts(lines, kind, asked.find((i) => doing(i) === how))) {
          for (const [name, [words, fits]] of Object.entries(ONLY)) if (words.test(text)) assert.ok(fits(how), `${s.id} ${kind} on a "${how}" item says ${name}: ${text}`);
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['hear', 'look', 'move', 'write']);
  assert.equal(doing({ type: 'pick', listen: true }), 'hear');
  assert.equal(doing({ fen: 'x', moves: [] }), 'move', 'a chess puzzle has no type');
});

// What an end-screen line claims about its session, and the sessions it may show for: { right, misses, fast }.
const CLAIMS_OF = [
  [/(?<!nearly )\b(every one|all of it|not one|not a single|flawless|perfect|no error|right first time|first go)\b/i, (x) => x.misses === 0],
  [/\b(nearly|the rest|(?<!not )one (slip|miss|bump|mix-up)|a slip)\b/i, (x) => x.misses === 1 && x.right >= 3],
  [/\b(a few|several|plenty|lots|many) \w*\s?(slips?|miss\w*|bumps?|mix-ups?|errors?|knocks?)\b|\bbumps\. |\bplenty\b|\blots of\b/i, () => false],
  [/\b(fast|quick\w*|already|blink|whoosh|zoom|barely)\b/i, (x) => x.fast && x.misses === 0],
  [/\bguess/i, () => false],
];

test('end-screen words fit the session: one miss in eight is not "plenty of bumps", and nothing claims what the app cannot know', () => {
  const sets = [[LINES, HEADLINES], [KAEDE_LINES, KAEDE_HEADLINES], [MATHS_LINES, MATHS_HEADLINES], [CODING_LINES, CODING_HEADLINES], [CODE_LINES, CODE_HEADLINES]];
  const shownFor = new Map();
  for (const review of [true, false]) for (const relit of [true, false]) for (const fast of [true, false])
    for (let of = 0; of <= 12; of++) for (let misses = 0; misses <= of; misses++) {
      const right = of - misses;
      const kind = finished({ review, relit: review && relit, perfect: of > 0 && !misses, fast: fast && !misses, misses, right });
      for (const lines of sets.flat()) for (const text of lines[kind] ?? []) {
        for (const [words, holds] of CLAIMS_OF) if (words.test(text)) assert.ok(holds({ right, misses, fast }), `"${text}" (${kind}) shown for ${right} right and ${misses} missed${fast ? ', fast' : ''}`);
        shownFor.set(text, true);
      }
    }
  // The examples from the playthrough.
  assert.equal(finished({ misses: 1, right: 7 }), 'nearly');
  assert.equal(finished({ misses: 0, right: 8, perfect: true, fast: true }), 'fast');
  assert.equal(finished({ misses: 2, right: 6 }), 'struggled');
  for (const [lines, heads] of sets) for (const kind of ['nearly', 'struggled']) assert.ok(lines[kind]?.length >= 2 && heads[kind]?.length >= 2, kind);
  for (const text of [...LINES.fast, ...KAEDE_LINES.fast, ...MATHS_LINES.fast, ...CODING_LINES.fast]) assert.ok(shownFor.has(text));
  // A practice end screen shows over any length of session, one minute too: no "few minutes".
  for (const text of [CALM_LINES, MOVE_LINES, FOCUS_LINES, BREAK_LINES, WINDDOWN_LINES, REFLECT_LINES].flatMap((l) => Object.values(l).flat()))
    assert.doesNotMatch(text, /\b(few|several|many) (quiet )?minutes\b|\bminutes of\b/i, text);
});

test('a species named where its picture does not show a butterfly says it is one', () => {
  const c = (k) => ({ name: 'Maths', k, stage: ['egg', 'caterpillar', 'chrysalis', 'butterfly'][k], species: { name: 'Blue Triangle' } });
  assert.equal(LIFE.arrived[0]('Maths', 'Blue Triangle'), 'Your Maths butterfly egg arrived: a Blue Triangle');
  // The first a learner hears of it may be a later stage (a placement skips units, or a unit hatches the egg at once).
  for (const say of LIFE.arrived) assert.match(say('Maths', 'Blue Triangle'), /\bbutterfly\b/);
  for (const k of [0, 1, 2, 3]) {
    assert.match(LIFE.raising(c(k)), /Blue Triangle butterfly$/);
    assert.match(LIFE.card(c(k)), /^Blue Triangle butterfly · /);
  }
});

import { UPRIGHT } from '../src/cast/lines.js';
test('the line over a lesson on a phone turned on its side is plain: no loss, nagging or urgency', () => {
  for (const re of [ABILITY, LOSS, URGENCY, NAGGING, SHAMING]) assert.doesNotMatch(UPRIGHT, re, UPRIGHT);
});
