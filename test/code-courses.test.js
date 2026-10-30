import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grade, problem, vary } from '../src/code/items.js';
// The shipped courses.
import { tokenize } from '../src/code/interp.js';
import { WALK_API, optionsOf, answerOf, startOf, trayOf, wayOf, limitOf, withOut } from '../src/code/items.js';
import { subjects } from '../src/subjects.js';
import javascript from '../src/code/courses/javascript.js';
import typescript from '../src/code/courses/typescript.js';
import testingCourse from '../src/code/courses/testing.js';

const COURSES = [javascript, typescript, testingCourse];
const itemsOf = (c) => c.units.flatMap((u) => u.lessons.flatMap((l) => l.items));
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('the courses have the agreed size, and lessons of 8 to 10 items', () => {
  const lessons = (c) => c.units.flatMap((u) => u.lessons);
  assert.ok(lessons(javascript).length >= 25 && lessons(javascript).length <= 30, 'javascript');
  for (const c of [typescript, testingCourse]) assert.ok(lessons(c).length >= 8 && lessons(c).length <= 12, c.id);
  for (const l of COURSES.flatMap(lessons)) assert.ok(l.items.length >= 8 && l.items.length <= 10, `${l.id}: ${l.items.length}`);
});

test('every shipped item passes problem(), ids are unique, and marked items explain themselves', () => {
  for (const c of COURSES) {
    const all = itemsOf(c);
    assert.equal(new Set(all.map((i) => i.id)).size, all.length, c.id);
    for (const item of all) {
      assert.equal(problem(item), null, item.id);
      if (item.type !== 'teach') assert.ok(item.explain, item.id);
    }
  }
});

test('every lesson mixes what it asks: more than one kind of item, and each one starts on a teach card', () => {
  for (const c of COURSES) for (const u of c.units) for (const l of u.lessons) {
    assert.equal(l.items[0].type, 'teach', l.id);
    assert.ok(new Set(l.items.map((i) => i.type)).size >= 2, l.id);
  }
});

const METHOD_WORDS = new Set(['length','toUpperCase','toLowerCase','includes','push','pop','indexOf','join','map','filter','forEach','toBe','toEqual','toContain','toThrow']);
const ruleWords = (src) => tokenize(src).slice(0, -1).filter((t, i, all) => t.t === 'kw' || t.t === 'op' || (t.t === 'id' && WALK_API.includes(t.v)) || (all[i - 1]?.raw === '.' && METHOD_WORDS.has(t.v))).map((t) => t.raw);
test('nothing is asked before a teach card has shown it', () => {
  const taught = new Set(['.']); // each course builds on the last, in this order
  for (const c of COURSES) for (const item of itemsOf(c)) {
    if (item.type === 'teach') { for (const w of ruleWords(item.code ?? '')) taught.add(w); continue; }
    const asked = item.goal === 'tests' && item.type === 'gap' ? item.code.replace(/___/g, '0') : item.code && item.type === 'predict' ? item.code : wayOf(item);
    if (item.ts && item.type === 'predict') continue; // checker questions show the mistake being asked about
    for (const w of ruleWords(asked)) assert.ok(taught.has(w), `${item.id}: "${w}" has not been taught`);
  }
});

test('every chip fits: a hole and its fill agree, the tray holds what the way needs, and there is room for it', () => {
  for (const c of COURSES) for (const item of itemsOf(c)) {
    if (item.type === 'gap') assert.equal(startOf(item).filter((n) => n.hole).length, item.fill.length, item.id);
    if (item.type === 'build' || item.type === 'gap') {
      assert.ok(limitOf(item) >= 8, item.id);
      assert.equal(new Set(trayOf(item)).size, trayOf(item).length, item.id);
      assert.ok(trayOf(item).length <= 26, `${item.id}: ${trayOf(item).length} chips`);
    }
  }
});

test('predict items work out their answers, and the wrong ones are wrong', () => {
  for (const c of COURSES) for (const item of itemsOf(c).filter((i) => i.type === 'predict')) {
    const { answer, options } = optionsOf(item);
    assert.ok(options.includes(answer), item.id);
    assert.ok(options.length >= 2, item.id);
    assert.equal(new Set(options).size, options.length, item.id);
    if (item.asks !== 'check') assert.equal(answer, answerOf(item));
  }
});

test('checker questions ask about both kinds: a flagged line and code with nothing wrong', () => {
  const asks = itemsOf(typescript).filter((i) => i.asks === 'check').map(optionsOf).map((o) => o.answer);
  assert.ok(asks.includes('No problem'));
  assert.ok(asks.some((a) => a.startsWith('Line')));
});

test('each test-writing item grades independently: every one has faulty versions, in plain words, with one way through', () => {
  const graded = itemsOf(testingCourse).filter((i) => i.goal === 'tests');
  assert.ok(graded.length > 40);
  for (const item of graded) {
    assert.ok(item.mutants.length >= 1, item.id);
    for (const m of item.mutants) assert.match(m.says, /\w+ \w+/, item.id);
    assert.deepEqual(grade(item, wayOf(item)).caught.map((x) => x.caught), item.mutants.map(() => true), item.id);
  }
  // More than one way through: a test nobody wrote still passes.
  const one = graded.find((i) => i.given.startsWith('function add'));
  assert.equal(grade(one, 'test("x", () => { expect(add(10, 20)).toBe(30); });').right, true);
});

test('fresh versions keep working, on every item, across many seeds', () => {
  for (const c of COURSES) for (const item of itemsOf(c)) for (const seed of [1, 7, 99]) {
    const v = vary(item, seeded(seed));
    if (item.type === 'teach') { assert.equal(v, null); continue; }
    assert.equal(problem(v), null, `${item.id} seed ${seed}`);
    assert.equal(v.id, item.id);
  }
});

test('fresh versions are mostly new, and flipped maps turn their words too', () => {
  const marked = COURSES.flatMap(itemsOf).filter((i) => i.type !== 'teach');
  const changed = marked.filter((i) => vary(i, seeded(5)) !== i);
  assert.ok(changed.length / marked.length > 0.5, `${changed.length} of ${marked.length}`);
  const v = vary(itemsOf(javascript).find((i) => i.goal === 'walk' && /\bright\b/.test(i.prompt ?? '') && i.type === 'build'), seeded(3));
  assert.equal(problem(v), null);
});

test('prose never names a number the code does not hold, so a fresh version cannot leave it stale', () => {
  for (const c of COURSES) for (const item of itemsOf(c)) {
    if (item.type === 'teach' || item.fixed || item.goal !== 'print' && item.type !== 'predict' || item.asks) continue;
    const src = (item.type === 'predict' ? item.code : wayOf(item)) + (item.given ?? '');
    const held = new Set(tokenize(src).filter((t) => t.t === 'num').map((t) => String(t.v)));
    for (const text of [item.prompt, item.explain]) for (const n of (text ?? '').match(/\b\d+\b/g) ?? []) assert.ok(held.has(n), `${item.id}: ${n} in "${text}"`);
  }
});

test('placement names real units, and every code course is on the Learning habit', () => {
  for (const id of ['javascript', 'typescript', 'testing']) {
    const s = subjects.find((x) => x.id === id);
    assert.equal(s.habit, 'learn');
    for (const [, unitTitle] of s.placement.options) assert.ok(s.units.some((u) => u.title === unitTitle), unitTitle);
    assert.ok(s.coach.hello.line);
  }
});
