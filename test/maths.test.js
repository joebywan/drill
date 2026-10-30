import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answer, pairing, problem, right, target, toQuiz, together, value } from '../src/maths/items.js';
import { nearestTick, onLine, problem as quizProblem, tick } from '../src/quiz/items.js';
import { subjects } from '../src/subjects.js';

const course = JSON.parse(readFileSync('src/data/maths.json', 'utf8'));
const items = course.units.flatMap((u) => u.lessons.flatMap((l) => l.items));

test('sums are worked out as written: + - × ÷, fractions, per cent, "of", dollars', () => {
  assert.equal(value('38 + 5'), 43);
  assert.equal(value('25 × 4'), 100);
  assert.equal(value('64 ÷ 2'), 32);
  assert.equal(value('3/4'), 0.75);
  assert.equal(value('50%'), 0.5);
  assert.equal(value('15% of $60'), 9);
  assert.equal(value('80 - 25% of 80'), 60);
  for (const bad of ['alert(1)', '2 +', '1/0', 'x']) assert.throws(() => value(bad), bad);
});

test('any way of writing the right value is right', () => {
  const half = { type: 'pick', show: '50%', options: [] };
  for (const yes of ['1/2', '2/4', '0.5', '50%']) assert.ok(right(half, yes), yes);
  assert.ok(!right(half, '1/5'));
  assert.ok(right({ sum: '10 - 6' }, 4)); // a value on the line is a number
  assert.ok(right({ goal: 'biggest', options: ['1/3', '1/4'] }, '1/3'));
  assert.equal(target({ picture: { grid: 40 } }), 0.4);
  assert.equal(target({ picture: { frame: 7 } }), 7);
});

test('tiles spell the number, or the fraction a bar shows', () => {
  assert.equal(answer({ show: '10% of 60' }), '6');
  assert.equal(answer({ show: '9 ÷ 2' }), '4.5');
  assert.equal(answer({ show: '0.1 × 3' }), '0.3'); // no 0.30000000000000004
  assert.equal(answer({ picture: { bar: [2, 5] } }), '2/5');
});

test('a maths item plays as a quiz item with its answer worked out', () => {
  const build = toQuiz({ id: 'x', type: 'build', show: '38 + 5', prompt: 'p', explain: 'e' });
  assert.deepEqual(build.answer, ['4', '3']);
  assert.equal(build.tiles.length, 2);
  assert.ok(build.tiles.every((t) => !build.answer.includes(t)), 'decoys are never in the answer');
  assert.deepEqual(toQuiz({ id: 'x', type: 'build', show: '38 + 5' }).tiles, build.tiles, 'the same item, the same decoys');
  assert.deepEqual(toQuiz({ id: 'y', type: 'build', picture: { bar: [2, 5] }, extra: '3' }).answer, ['2', '/', '5']);
  assert.equal(toQuiz({ type: 'pick', show: '16 × 5', options: ['8 × 10', '32 × 10'] }).answer, '8 × 10');
  const line = toQuiz({ type: 'line', show: '2/3', min: 0, max: 1, ticks: 3 });
  assert.ok(onLine(line, tick(line, 2)) && !onLine(line, tick(line, 1)));
  const pairs = toQuiz({ type: 'pairs', make: 10, tiles: ['3', '8', '7', '2'] }).pairs;
  assert.deepEqual(pairs.map((p) => p.map(Number).sort().join()), ['3,7', '2,8']);
  assert.equal(quizProblem({ id: 'z', type: 'line', prompt: 'p', explain: 'e', min: 0, max: 1, ticks: 4, answer: 1 / 3 }), 'the answer must be on exactly one tick');
});

test('the number line snaps to the nearest tick and never past an end', () => {
  const line = { min: 0, max: 100, ticks: 4 };
  assert.equal(nearestTick(line, 0.3), 1);
  assert.equal(nearestTick(line, 0.9), 4);
  assert.equal(nearestTick(line, 1.4), 4);
  assert.equal(nearestTick(line, -0.2), 0);
  assert.equal(tick(line, 3), 75);
});

test('pairs go together by adding up to `make`, or by being worth the same', () => {
  assert.ok(together({ make: 10 }, '3', '7'));
  assert.ok(!together({ make: 10 }, '3', '6'));
  assert.ok(together({}, '25%', '1/4'));
  assert.ok(!together({}, '25%', '1/2'));
  assert.ok(pairing(['3', '6', '7', '4'], (a, b) => together({ make: 10 }, a, b)));
  assert.equal(pairing(['3', '6', '7', '5'], (a, b) => together({ make: 10 }, a, b)), null);
});

test('problem() catches items that can not be answered', () => {
  assert.equal(problem({ type: 'pick', show: '2 + 2', prompt: 'p', explain: 'e', options: ['3', '5'] }), '0 options are right');
  assert.equal(problem({ type: 'pick', show: '2 + 2', prompt: 'p', explain: 'e', options: ['4', '8/2'] }), '2 options are right');
  assert.equal(problem({ id: 'l', type: 'line', show: '1/3', prompt: 'p', explain: 'e', min: 0, max: 1, ticks: 4 }), 'the answer must be on exactly one tick');
  assert.equal(problem({ type: 'pairs', make: 10, prompt: 'p', explain: 'e', tiles: ['1', '2'] }), "the tiles don't all pair off");
  assert.equal(problem({ type: 'build', show: '2 + 2', prompt: 'p' }), 'no explanation');
});

test('every shipped maths item passes problem() and has a unique id', () => {
  assert.ok(items.length > 40);
  for (const item of items) assert.equal(problem(item), null, item.id);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  for (const u of course.units) assert.ok(u.lessons[0].items[0].type === 'teach', `${u.title} starts by teaching`);
});

test('every sign, picture and answer type is taught on a card before anything uses it', () => {
  const standalone = (sign) => new RegExp(`(^|\\s)\\${sign}([\\s.,:;]|$)`);
  const SIGNS = { '+': /\+/, '-': /\d - \d/, '×': /×/, '÷': /÷/, '%': /%/, '/': /\d\/\d/ };
  const written = (i) => [i.show, i.text, i.prompt, i.explain, ...(i.options || []), ...(i.tiles || [])].filter(Boolean).join(' ');
  for (const [sign, used] of Object.entries(SIGNS)) {
    const first = items.findIndex((i) => used.test(written(i)));
    const taught = items.findIndex((i) => i.type === 'teach' && standalone(sign).test(i.text));
    assert.ok(first >= 0 && taught >= 0 && taught <= first, `${sign} is first used by ${items[first]?.id}, taught by ${items[taught]?.id}`);
  }
  const taughtBefore = (needs, teaches, what) => {
    const first = items.findIndex((i) => i.type !== 'teach' && needs(i));
    assert.ok(first >= 0, what);
    assert.ok(items.slice(0, first).some((i) => i.type === 'teach' && teaches(i)), `${what}: ${items[first].id} comes first`);
  };
  for (const kind of ['frame', 'grid', 'bar', 'bars']) taughtBefore((i) => i.picture?.[kind], (i) => i.picture?.[kind], kind);
  taughtBefore((i) => i.type === 'line', (i) => i.picture?.line, 'a number line');
  taughtBefore((i) => i.type === 'build', (i) => /\btap the digits\b/i.test(i.text), 'how tiles work');
  const pastOne = (i) => /^(\d+)\/(\d+)$/.test(i.show || '') && value(i.show) >= 1;
  taughtBefore(pastOne, (i) => pastOne(i) && i.picture?.line, 'a fraction of 1 or more');
});

test('maths is a Learning course with its own coach and a placement that names real units', () => {
  const maths = subjects.find((s) => s.id === 'maths');
  assert.equal(maths.habit, 'learn');
  assert.equal(maths.kind, 'learn');
  for (const [, unit] of maths.placement.options) assert.ok(maths.units.some((u) => u.title === unit), unit);
  assert.equal(maths.placement.options[0][1], maths.units[0].title);
});
