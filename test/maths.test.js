import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answer, problem, right, target, together, value } from '../src/maths/items.js';
import { clears, nearestTick, nextTile, shuffle, tick, tilesFor } from '../src/play/items.js';
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

test('a tile is judged the moment it is tapped', () => {
  assert.equal(nextTile('43', '', '4'), 'right');
  assert.equal(nextTile('43', '4', '3'), 'done');
  assert.equal(nextTile('43', '', '3'), 'wrong');
  assert.equal(nextTile('43', '4', '4'), 'wrong');
  const tiles = tilesFor({ id: 'x' }, '43');
  assert.equal(tiles.length, 4); // the answer's two, plus two more
  assert.ok(tiles.includes('4') && tiles.includes('3'));
  assert.deepEqual(tilesFor({ id: 'x' }, '43'), tiles, 'the same item shuffles the same every time');
  assert.deepEqual(tilesFor({ id: 'y', extra: '7' }, '2/5').sort(), ['/', '2', '5', '7']);
  assert.deepEqual(shuffle([1, 2, 3, 4], 'a').sort(), [1, 2, 3, 4]);
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
  assert.ok(clears(['3', '6', '7', '4'], (a, b) => together({ make: 10 }, a, b)));
  assert.ok(!clears(['3', '6', '7', '5'], (a, b) => together({ make: 10 }, a, b)));
});

test('problem() catches items that can not be answered', () => {
  assert.equal(problem({ type: 'pick', show: '2 + 2', prompt: 'p', explain: 'e', options: ['3', '5'] }), '0 options are right');
  assert.equal(problem({ type: 'pick', show: '2 + 2', prompt: 'p', explain: 'e', options: ['4', '8/2'] }), '2 options are right');
  assert.equal(problem({ type: 'line', show: '1/3', prompt: 'p', explain: 'e', min: 0, max: 1, ticks: 4 }), '0 ticks are right');
  assert.equal(problem({ type: 'pairs', make: 10, prompt: 'p', explain: 'e', tiles: ['1', '2'] }), "the tiles don't all pair off");
  assert.equal(problem({ type: 'tiles', show: '2 + 2', prompt: 'p' }), 'no explanation');
});

test('every shipped maths item passes problem() and has a unique id', () => {
  assert.ok(items.length > 40);
  for (const item of items) assert.equal(problem(item), null, item.id);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  for (const u of course.units) assert.ok(u.lessons[0].items[0].type === 'teach', `${u.title} starts by teaching`);
});

test('maths is a Learning course with its own coach and a placement that names real units', () => {
  const maths = subjects.find((s) => s.id === 'maths');
  assert.equal(maths.habit, 'learn');
  assert.equal(maths.kind, 'learn');
  for (const [, unit] of maths.placement.options) assert.ok(maths.units.some((u) => u.title === unit), unit);
  assert.equal(maths.placement.options[0][1], maths.units[0].title);
});
