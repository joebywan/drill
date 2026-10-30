import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answer, fill, holes, parse, problem, reaches, run, solve } from '../src/coding/program.js';
import course from '../src/data/coding.json' with { type: 'json' };

const level = ['S.#*', '....'];

test('a program walks the grid step by step and stops on the flower', () => {
  const r = run(['S..*'], ['right', 'right', 'right', 'right']);
  assert.equal(r.end, 'flower');
  assert.deepEqual(r.path, [[0, 0], [1, 0], [2, 0], [3, 0]], 'the step after the flower never runs');
  assert.equal(run(['S..*'], ['right']).end, 'short');
  assert.deepEqual(run(['S..*'], ['right']).path.at(-1), [1, 0]);
});

test('a rock or the edge stops the run where it is, and says where it bumped', () => {
  const r = run(level, ['right', 'right', 'down']);
  assert.equal(r.end, 'bump');
  assert.deepEqual(r.path.at(-1), [1, 0]);
  assert.deepEqual(r.bumped, [2, 0]);
  assert.equal(run(level, ['up']).end, 'bump');
  assert.equal(run(level, ['left']).end, 'bump');
});

test('repeat runs its blocks n times, and if looks before each step', () => {
  assert.equal(run(level, ['down', { repeat: 3, do: ['right'] }, 'up']).end, 'flower');
  assert.equal(run(level, ['down', { repeat: 2, do: ['right'] }, 'up']).end, 'bump');
  const climb = { repeat: 5, do: [{ if: 'rock-right', then: ['down'], else: ['right'] }] };
  // Rock to the right at (1,0): down; then right, right; at (3,1) the edge is to the right: down is the edge too.
  const r = run(level, [climb]);
  assert.deepEqual(r.path.slice(0, 4), [[0, 0], [1, 0], [1, 1], [2, 1]]);
  assert.equal(r.end, 'bump');
  assert.equal(run(['S'], [{ repeat: 1000, do: [{ if: 'rock-up', then: [], else: ['up'] }] }]).end, 'short', 'a loop that does nothing ends');
});

test('holes fill in reading order, counts and steps apart', () => {
  const program = [{ repeat: null, do: [null, 'up'] }, { if: 'rock-up', then: [null], else: [null] }];
  assert.deepEqual(holes(program), ['count', 'step', 'step', 'step']);
  assert.deepEqual(fill(program, [3, 'right', 'left', 'down']),
    [{ repeat: 3, do: ['right', 'up'] }, { if: 'rock-up', then: ['left'], else: ['down'] }]);
  assert.deepEqual(fill(program, [3]), [{ repeat: 3, do: [null, 'up'] }, { if: 'rock-up', then: [null], else: [null] }]);
});

test('right is decided by running: any filling that reaches the flower is right', () => {
  const item = { id: 'x', type: 'build', level: ['...*', 'S...'], program: [null, null, null, null], tiles: ['up', 'right'], prompt: 'p', explain: 'e' };
  assert.equal(reaches(item, ['right', 'right', 'right', 'up']), true);
  assert.equal(reaches(item, ['up', 'right', 'right', 'right']), true, 'another order works too');
  assert.equal(reaches(item, ['right', 'up', 'up', 'right']), false);
  assert.ok(reaches(item, solve(item)));
  assert.equal(problem(item), null);
  assert.equal(problem({ ...item, tiles: ['up'] }), 'no filling reaches the flower');
  assert.equal(problem({ ...item, level: ['S*'], program: [null], tiles: ['right'] }), 'every filling works: nothing to think about');
  assert.deepEqual(answer({ level, program: ['down', 'right'] }), [1, 1]);
});

test('every shipped Coding item passes problem(), and ids are unique', () => {
  const items = course.units.flatMap((u) => u.lessons.flatMap((l) => l.items));
  assert.ok(items.length >= 20);
  for (const item of items) assert.equal(problem(item), null, item.id);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  for (const item of items.filter((i) => i.level)) assert.ok(parse(item.level).start, item.id);
});
