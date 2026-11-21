import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DARE_ODDS, VOICES, line, mayDare, say } from '../src/cast/lines.js';
import { COMEBACK_DAYS, coachOf, hourBand, moment, streakBand } from '../src/cast/voice.js';
import { emptyProgress, finishPractice, finishSession, logToday, track } from '../src/progress.js';
import { habitsFor, subjects } from '../src/subjects.js';

const day = (d, h = 12) => new Date(2026, 9, d, h);
const NO_DARE = 0.99; // rng values at or over DARE_ODDS never dare
const rngOf = (...values) => () => values.length > 1 ? values.shift() : values[0];
const base = { habit: 'calm', today: '2026-10-30', hour: 'morning', light: 'not yet', streak: 'short', first: false, comeback: false };
const pools = (coach, pick) => VOICES[coach].lines.filter(({ when }) => pick(when)).flatMap((p) => p.lines);

test('a hidden streak leaves its count out of the facts, so no line can state it', () => {
  let p = emptyProgress();
  for (let d = 1; d <= 20; d++) p = finishPractice(p, 'calm', null, day(d, 8), { title: 'Breathing', mins: 2 });
  const calm = habitsFor(p).find((h) => h.id === 'calm');
  const shown = moment(p, calm, day(21, 9));
  const hidden = moment(p, calm, day(21, 9), undefined, false);
  assert.equal(shown.facts.count, 20);
  assert.equal(hidden.facts.count, null);
  for (let i = 0; i < 50; i++) assert.doesNotMatch(say(hidden.coach, { ...hidden.state, daredToday: true }, hidden.facts, rngOf(i / 50), []).text, /\b20\b/);
  assert.ok([...Array(50).keys()].some((i) => /\b20 days/.test(say(shown.coach, { ...shown.state, daredToday: true }, shown.facts, rngOf(i / 50), []).text)));
  // Once today is done, the days practised ("21 days of slow breaths") are a count too.
  const done = finishPractice(p, 'calm', null, day(21, 8), { title: 'Breathing', mins: 2 });
  const after = moment(done, calm, day(21, 9), undefined, false);
  assert.equal(after.facts.days, null);
  for (let i = 0; i < 50; i++) assert.doesNotMatch(say(after.coach, { ...after.state, daredToday: true }, after.facts, rngOf(i / 50), []).text, /\b2[01]\b/);
  assert.equal(moment(done, calm, day(21, 9)).facts.days, 21);
});

test('every coach in a subject has a voice, with the same layout for all', () => {
  for (const s of subjects) assert.ok(VOICES[s.coach.name.toLowerCase()], s.coach.name);
  for (const s of subjects) assert.equal(VOICES[coachOf(s.habit)].name, s.habit === 'learn' ? 'Rosa' : s.coach.name, s.habit);
  for (const [id, v] of Object.entries(VOICES)) {
    assert.ok(v.name.toLowerCase() === id || subjects.some((s) => s.habit === id && s.coach.name === v.name), id);
    for (const key of ['personality', 'encourages', 'dares']) assert.ok(v.voice[key].length > 20, `${id}.${key}`);
    assert.ok(v.voice.never.length >= 3, `${id} never`);
    const all = [...v.lines, ...v.dares].flatMap((p) => p.lines);
    assert.ok(v.lines.flatMap((p) => p.lines).length >= 20, `${id} has 20+ lines`);
    assert.ok(v.dares.flatMap((p) => p.lines).length >= 3, `${id} has dares`);
    assert.equal(new Set(all).size, all.length, `${id} has no duplicate lines`);
  }
  assert.equal(coachOf('calm'), 'moss');
  assert.equal(coachOf('learn'), 'rosa');
  assert.equal(coachOf('walk'), 'lumi', 'one-tap habits get Lumi');
  assert.equal(coachOf('winddown'), 'winddown', "Wind down has Moss's bedtime voice");
});

test('every coach has a line for every state, without any facts', () => {
  for (const coach of Object.keys(VOICES))
    for (const habit of ['learn', 'calm', 'reflect', 'walk'])
      for (const hour of ['morning', 'afternoon', 'evening', 'night'])
        for (const light of ['done', 'not yet', 'resting'])
          for (const streak of ['none', 'short', 'week', 'month'])
            for (const [first, comeback] of [[false, false], [true, false], [false, true]]) {
              const said = say(coach, { ...base, habit, hour, light, streak, first, comeback }, {}, rngOf(NO_DARE, 0.5));
              assert.ok(said?.text, `${coach} ${habit} ${hour} ${light} ${streak} ${first} ${comeback}`);
              assert.doesNotMatch(said.text, /[{}]/, said.text);
            }
});

test('say picks the most specific pool, and falls back to a general one', () => {
  const morning = pools('moss', (w) => w.light === 'not yet' && w.hour === 'morning');
  const week = pools('moss', (w) => w.light === 'not yet' && w.streak === 'week');
  // Morning and a week's run are both two keys deep, so both pools are in play, and nothing shallower.
  const heard = new Set(Array.from({ length: 40 }, (_, i) => say('moss', { ...base, streak: 'week' }, {}, rngOf(NO_DARE, i / 40)).line));
  for (const text of heard) assert.ok([...morning, ...week].includes(text), text);
  assert.ok(morning.some((t) => heard.has(t)) && week.some((t) => heard.has(t)));
  // A light with no hour pool falls back to the light's own pool.
  const resting = pools('moss', (w) => w.light === 'resting');
  assert.ok(resting.includes(say('moss', { ...base, light: 'resting' }, {}, rngOf(NO_DARE, 0)).line));
  // A state no pool names gets the general pool.
  const general = pools('moss', (w) => !Object.keys(w).length);
  assert.ok(general.includes(say('moss', { ...base, light: 'unknown' }, {}, rngOf(NO_DARE, 0)).line));
  // First sessions and comebacks only ever hear their own lines.
  const first = pools('moss', (w) => w.first);
  const back = pools('moss', (w) => w.comeback);
  for (let i = 0; i < 10; i++) {
    assert.ok(first.includes(say('moss', { ...base, first: true }, {}, rngOf(NO_DARE, i / 10)).line));
    assert.ok(back.includes(say('moss', { ...base, comeback: true, light: 'resting' }, {}, rngOf(NO_DARE, i / 10)).line));
  }
  // A habit's own pool joins its coach's others: Lumi on Reflect.
  const reflect = pools('lumi', (w) => w.habit === 'reflect' && w.light === 'not yet');
  const onReflect = new Set(Array.from({ length: 40 }, (_, i) => say('lumi', { ...base, habit: 'reflect' }, { habit: 'Reflect' }, rngOf(NO_DARE, i / 40)).line));
  assert.ok(reflect.some((t) => onReflect.has(t)));
  const onWalk = new Set(Array.from({ length: 40 }, (_, i) => say('lumi', { ...base, habit: 'walk' }, { habit: 'Walk' }, rngOf(NO_DARE, i / 40)).line));
  assert.ok(!reflect.some((t) => onWalk.has(t)), 'Reflect lines stay on Reflect');
});

test('say never repeats the last few lines while another is left', () => {
  const recent = [];
  for (let i = 0; i < 30; i++) {
    const said = say('rosa', { ...base, habit: 'learn', streak: 'none' }, {}, rngOf(NO_DARE, (i * 7 % 10) / 10), recent);
    assert.ok(!recent.includes(said.line), `${i}: ${said.line} again`);
    recent.push(said.line);
    recent.splice(0, recent.length - 3);
  }
  // With every line of the most specific pools heard, it falls back a level rather than repeat.
  const top = pools('rosa', (w) => w.light === 'not yet' && (w.hour === 'morning' || w.streak === 'week'));
  const said = say('rosa', { ...base, habit: 'learn', streak: 'week' }, {}, rngOf(NO_DARE, 0), top);
  assert.ok(!top.includes(said.line), said.line);
  // line() itself skips recent lines, and repeats only when there is nothing else.
  assert.equal(line('k', 0, { k: ['a', 'b'] }, ['a']), 'b');
  assert.equal(line('k', 0, { k: ['a'] }, ['a']), 'a');
});

test('slots are filled from facts, and a line with an unknown fact is never said', () => {
  const slotted = (coach) => VOICES[coach].lines.flatMap((p) => p.lines).filter((t) => t.includes('{usualHour}'));
  assert.ok(Object.keys(VOICES).every((c) => slotted(c).length), 'every coach can name the usual hour');
  const state = { ...base, hour: 'night', streak: 'month' };
  const heard = (facts, recent = []) => new Set(Array.from({ length: 60 }, (_, i) => say('moss', state, facts, rngOf(NO_DARE, i / 60), recent).text));
  const without = heard({});
  for (const text of without) assert.doesNotMatch(text, /\{|\bnull\b|undefined/, text);
  assert.ok(![...without].some((t) => t.includes('usual') || /\d/.test(t)));
  // A line about the person is more specific, so it comes first, then joins the rest.
  const facts = { usualHour: 'evening', count: 41 };
  assert.deepEqual([...heard(facts)], ["41 days in a row. I'd clap, but I'm comfortable."]);
  const next = heard(facts, ["{count} days in a row. I'd clap, but I'm comfortable."]);
  assert.ok(next.has('Your usual evening breathing, whenever you like.'), [...next].join(' | '));
  assert.ok(next.has('Night. Even the frogs are winding down.'));
});

test('dares: sometimes, at most once a day, only while not done, never first or after a gap', () => {
  const dares = (coach) => VOICES[coach].dares.flatMap((p) => p.lines);
  const facts = { habit: 'Calm' };
  const dared = say('moss', base, facts, rngOf(0, 0));
  assert.equal(dared.dare, true);
  assert.ok(dares('moss').includes(dared.line));
  assert.equal(say('moss', base, facts, rngOf(DARE_ODDS, 0)).dare, false, 'only sometimes');
  // A morning dare can be the one about lunch.
  const morning = new Set(Array.from({ length: 20 }, (_, i) => say('moss', base, facts, rngOf(0, i / 20)).text));
  assert.ok(morning.has("I bet you can't do three slow breaths before lunch."));
  for (const state of [
    { ...base, daredToday: true },
    { ...base, light: 'done' },
    { ...base, light: 'resting' },
    { ...base, first: true },
    { ...base, comeback: true },
    { ...base, dares: false },
  ]) {
    assert.equal(mayDare(state), false, JSON.stringify(state));
    for (const coach of Object.keys(VOICES)) {
      const said = say(coach, state, facts, rngOf(0, 0));
      assert.equal(said.dare, false, `${coach} ${JSON.stringify(state)}`);
      assert.ok(!dares(coach).includes(said.line));
    }
  }
});

test('moment reads the state and facts from progress', () => {
  assert.deepEqual([4, 5, 11, 12, 16, 17, 20, 21, 0].map(hourBand), ['night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night']);
  assert.deepEqual([0, 1, 6, 7, 29, 30].map(streakBand), ['none', 'short', 'short', 'week', 'week', 'month']);
  const calm = { id: 'calm', name: 'Calm' };
  const fresh = moment(emptyProgress(), calm, day(30, 8));
  assert.equal(fresh.coach, 'moss');
  assert.deepEqual(fresh.state, { habit: 'calm', today: '2026-10-30', hour: 'morning', light: 'not yet', streak: 'none', first: true, comeback: false });
  assert.deepEqual(fresh.facts, { habit: 'Calm', usualHour: null, count: null, days: null });

  let p = emptyProgress();
  for (const d of [1, 2, 3]) p = finishPractice(p, 'calm', null, day(d, 19), { title: 'Breathing', mins: 2 });
  const later = moment(p, calm, day(3, 21));
  assert.deepEqual(later.state, { ...fresh.state, today: '2026-10-03', hour: 'night', light: 'done', streak: 'short', first: false });
  assert.deepEqual(later.facts, { habit: 'Calm', usualHour: 'evening', count: 3, days: 3 });
  assert.equal(moment(p, calm, day(4, 9)).state.light, 'not yet');
  assert.equal(moment(p, calm, day(5, 9)).state.light, 'resting');
  assert.equal(moment(p, calm, day(5, 9)).state.comeback, false, 'one quiet day is no gap');
  assert.equal(moment(p, calm, day(3 + COMEBACK_DAYS, 9)).state.comeback, true);
  // Sessions from before the hour was kept leave the usual hour unknown.
  const old = { ...p, log: p.log.map(({ hour, ...e }) => e) };
  assert.equal(moment(old, calm, day(4)).facts.usualHour, null);
  // One-tap habits work the same way, with Lumi.
  const walk = logToday(track(emptyProgress(), { id: 'walk' }), 'walk', 'Walked', day(1, 7));
  assert.equal(moment(walk, { id: 'learn', name: 'Learning' }, day(1, 9), 'kaede').coach, 'kaede', 'the course shown speaks');
  const m = moment(walk, { id: 'walk', name: 'Walk' }, day(1, 9));
  assert.equal(m.coach, 'lumi');
  assert.equal(m.state.light, 'done');
});

test('once a habit is done today, every kind and every coach greets from the done pool, never an invite', () => {
  const now = day(5, 10);
  let p = { ...emptyProgress(), start: 'x' };
  p = track(p, { id: 'walk' });
  p = track(p, { id: 'mine', name: 'Stretch', icon: '🌱', plant: 'tulip' });
  const all = habitsFor(p).filter((h) => !h.hidden);
  for (const h of all) {
    p = h.id === 'learn' ? finishSession(p, null, [], now) : h.kind === 'log' ? logToday(p, h.id, h.title, now) : finishPractice(p, h.id, null, now);
  }
  const done = (coach) => new Set(pools(coach, (w) => w.light === 'done'));
  const courseCoaches = subjects.filter((s) => s.kind === 'learn').map((s) => s.coach.name.toLowerCase());
  for (const h of all) {
    for (const coach of h.id === 'learn' ? courseCoaches : [coachOf(h.id)]) {
      const { state, facts } = moment(p, h, now, coach);
      assert.equal(state.light, 'done', `${h.id} reads as done today`);
      for (let i = 0; i < 40; i++) {
        const { line: said } = say(coach, state, facts, () => i / 40); // done today never dares, so every draw picks the line
        assert.ok(done(coach).has(said), `${h.id} (${coach}) said "${said}"`);
      }
    }
  }
});

test("a course's coach says their course is done today only after a session of it; another course's lesson gets the elsewhere pool", () => {
  const learning = { id: 'learn', name: 'Learning' };
  const now = day(5, 10);
  const courses = subjects.filter((s) => s.kind === 'learn');
  // A Chess lesson today, and Maths done on two earlier evenings.
  let p = emptyProgress();
  // Every other course has been met once, a day before: a course never opened is `first`, which wins over `elsewhere` (below).
  for (const s of courses) if (!['maths', 'chess'].includes(s.id)) p = finishSession(p, `${s.id}:x`, [{ key: 'k', correct: true }], day(1, 19), { title: 'A', course: s.id });
  for (const d of [2, 3, 4]) p = finishSession(p, 'maths:x', [{ key: 'k', correct: true }], day(d, 19), { title: 'Sums', course: 'maths' });
  p = finishSession(p, 'chess:x', [{ key: 'c', correct: true }], day(5, 8), { title: 'The board', course: 'chess' });
  const lines = (coach, pick) => new Set(pools(coach, pick));
  for (const s of courses) {
    const coach = s.coach.name.toLowerCase();
    const m = moment(p, learning, now, coach, true, s.id);
    assert.equal(m.state.light, 'done', `${s.id}: Learning is done today`);
    assert.equal(m.state.elsewhere, s.id !== 'chess', `${s.id}: only Chess was done today`);
    assert.ok(lines(coach, (w) => w.elsewhere).size >= 3, `${coach} has lines for a day of learning done in another course`);
    for (let i = 0; i < 40; i++) {
      const said = say(coach, { ...m.state, dares: true }, m.facts, () => i / 40, []);
      assert.equal(said.dare, false, 'the habit is done today: no dare');
      const from = m.state.elsewhere ? lines(coach, (w) => w.elsewhere) : lines(coach, (w) => w.light === 'done' && !w.elsewhere);
      assert.ok(from.has(said.line), `${s.id} (${coach}) said "${said.line}"`);
    }
  }
  // The usual hour is the course's own: Maths in the evening, Chess too few sessions to say.
  assert.equal(moment(p, learning, day(6, 9), 'ada', true, 'maths').facts.usualHour, 'evening');
  assert.equal(moment(p, learning, day(6, 9), 'rosa', true, 'chess').facts.usualHour, null);
  // The next day nothing is done, so nothing is elsewhere.
  assert.equal(moment(p, learning, day(6, 9), 'ada', true, 'maths').state.elsewhere, false);
});

test("a Learn coach's streak and days lines count lessons, never their own course: the streak is Learning's", () => {
  const COURSE = /\b(days?|week|month) (of|on) (the )?(chess|board|maths|sums|kana|japanese|coding|plans)\b/i;
  for (const coach of new Set(subjects.filter((s) => s.kind === 'learn').map((s) => s.coach.name.toLowerCase()))) {
    for (const { when, lines } of VOICES[coach].lines) for (const text of lines) {
      if (/\{(count|days)\}/.test(text) || (when.streak && when.light !== 'done')) assert.doesNotMatch(text, COURSE, `${coach}: ${text}`);
    }
  }
});

test("a Learn course is first until one of its own lessons is finished, whichever course came before", () => {
  const learning = { id: 'learn', name: 'Learning' };
  const firstOf = (p, coach, course, d = 5) => moment(p, learning, day(d, 9), coach, true, course).state;
  assert.equal(firstOf(emptyProgress(), 'rosa', 'chess').first, true);
  assert.equal(firstOf(emptyProgress(), 'ada', 'maths').first, true);
  let p = finishSession(emptyProgress(), 'chess:x', [{ key: 'c', correct: true }], day(2, 8), { title: 'The board', course: 'chess' });
  assert.equal(firstOf(p, 'rosa', 'chess').first, false);
  assert.equal(firstOf(p, 'ada', 'maths').first, true, 'Chess done, Maths never opened: Ada greets a newcomer');
  // Learning done today through Chess: the first meeting still wins over `elsewhere`, and never dares.
  const today = firstOf(p, 'ada', 'maths', 2);
  assert.deepEqual([today.first, today.elsewhere], [true, false]);
  assert.equal(mayDare({ ...today, dares: true }), false);
  p = finishSession(p, 'maths:x', [{ key: 'k', correct: true }], day(3, 8), { title: 'Sums', course: 'maths' });
  assert.equal(firstOf(p, 'ada', 'maths').first, false);
  assert.equal(firstOf(p, 'ada', 'maths', 3).elsewhere, false, 'Maths itself was done today');
  // The comeback stays the habit's.
  assert.equal(firstOf(p, 'ada', 'maths', 20).comeback, true);
  const chessOnly = finishSession(emptyProgress(), 'chess:x', [{ key: 'c', correct: true }], day(2, 8), { title: 'B', course: 'chess' });
  const newcomer = firstOf(chessOnly, 'ada', 'maths', 20);
  assert.deepEqual([newcomer.first, newcomer.comeback], [true, false], 'a first meeting is never also a comeback: no line fits both');
});
