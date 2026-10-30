import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answer, changed, fill, fixBug, holes, jsFace, mirrored, parse, parts, problem, punch, reaches, run, solve, tileName, toJS, vary } from '../src/coding/program.js';
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

test('the bump rule is shown before it is asked, and the demos do what their cards say', () => {
  const items = course.units.flatMap((u) => u.lessons.flatMap((l) => l.items));
  const bumps = (i) => i.program && run(i.level, i.program).end === 'bump';
  const shown = items.findIndex((i) => i.type === 'teach' && bumps(i));
  const asked = items.findIndex((i) => i.type === 'predict' && bumps(i));
  assert.ok(shown >= 0 && shown < asked, 'a teach card plays a bump before a predict needs one');
  const stop = items.find((i) => i.id === 'steps-1-stop');
  assert.deepEqual(run(stop.level, stop.program).path, [[0, 0]], 'the step after the bump never runs');
  for (const id of ['loops-0-order', 'if-0-again']) {
    const i = items.find((x) => x.id === id);
    assert.equal(run(i.level, i.program).end, 'flower', id);
  }
});

test('every shipped Coding item passes problem(), and ids are unique', () => {
  const items = course.units.flatMap((u) => u.lessons.flatMap((l) => l.items));
  assert.ok(items.length >= 20);
  for (const item of items) assert.equal(problem(item), null, item.id);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  for (const item of items.filter((i) => i.level)) assert.ok(parse(item.level).start, item.id);
});

test('a mirrored item is the same idea on a flipped map, with its words and tiles turned', () => {
  const all = course.units.flatMap((u) => u.lessons.flatMap((l) => l.items)).filter((i) => i.type !== 'teach');
  for (const flip of [{ x: true }, { y: true }, { x: true, y: true }]) {
    for (const item of all) assert.equal(problem(mirrored(item, flip)), null, `${item.id} ${JSON.stringify(flip)}`);
  }
  const m = mirrored({ id: 'a', type: 'build', level: ['S.', '.*'], program: [null, null], tiles: ['right', 'down'], prompt: 'Right, then down.', explain: 'Down and right.' }, { x: true });
  assert.deepEqual(m.level, ['.S', '*.']);
  assert.deepEqual(m.tiles, ['left', 'down']);
  assert.equal(m.prompt, 'Left, then down.');
  assert.notEqual(vary(all[0], () => 0).level.join(), all[0].level.join());
  assert.equal(vary({ type: 'teach' }), null);
});

test('repeat until looks first, runs until it holds, and a loop that never ends is stopped', () => {
  assert.equal(run(['S...*'], [{ until: 'flower', do: ['right'] }]).end, 'flower');
  assert.deepEqual(run(['S..#', '...*'], [{ until: 'rock-right', do: ['right'] }, 'down']).path.at(-1), [2, 1]);
  assert.deepEqual(run(['S#', '.*'], [{ until: 'rock-right', do: ['up'] }]).path, [[0, 0]], 'already true: the inside never runs');
  assert.equal(run(['S..#*'], [{ until: 'flower', do: ['right'] }]).end, 'bump');
  for (const inside of [['right', 'left'], [], [{ if: 'rock-up', then: [], else: ['up'] }, 'down']]) {
    const r = run(['...', 'S.*'], [{ until: 'flower', do: inside }]);
    assert.equal(r.end, 'endless', JSON.stringify(inside));
    assert.ok(r.path.length < 6, 'it ends after one trip round, not at the step limit');
  }
  assert.equal(run(['S.', '.*'], [{ repeat: 1000, do: [{ repeat: 1000, do: ['down', 'up'] }] }]).end, 'endless', 'the step limit still holds');
});

test('a defined block runs nothing where it stands, and each call runs it', () => {
  const hop = { define: 'hop', do: ['right', 'up'] };
  assert.deepEqual(run(['..*', 'S..'], [hop]).path, [[0, 1]]);
  assert.equal(run(['..*', '...', 'S..'], [hop, { call: 'hop' }, { call: 'hop' }]).end, 'flower');
  assert.equal(run(['..*', 'S..'], [{ define: 'a', do: [{ call: 'a' }] }, { call: 'a' }]).end, 'endless', 'a block that calls itself');
  assert.equal(run(['..*', '...', 'S..'], [{ define: 'j', do: ['right'] }, { define: 'k', do: [{ call: 'j' }, 'up'] }, { call: 'k' }, { call: 'k' }]).end, 'flower');
  const item = { id: 'x', type: 'predict', level: ['S*'], program: [{ call: 'nope' }], prompt: 'p', explain: 'e' };
  assert.equal(problem(item), 'calls a block nothing defines');
});

test('holes reach inside every block, looks and calls included, in reading order', () => {
  const program = [{ define: 'hop', do: [null] }, { until: null, do: [null] }, { if: null, then: [null], else: [{ repeat: null, do: [{ call: 'hop' }] }] }];
  assert.deepEqual(holes(program), ['step', 'look', 'step', 'look', 'step', 'count']);
  const filled = fill(program, ['up', 'flower', { call: 'hop' }, 'rock-up', 'left', 2]);
  assert.deepEqual(holes(filled), []);
  assert.deepEqual(filled[1], { until: 'flower', do: [{ call: 'hop' }] });
  assert.deepEqual(punch(filled, 1), [{ define: 'hop', do: ['up'] }, { until: null, do: [{ call: 'hop' }] }, filled[2]]);
  assert.equal(parts(filled).length, 7);
});

test('a flip turns every block, and the looks and tiles with them', () => {
  const m = mirrored({
    id: 'a', type: 'build', level: ['S.', '.*'],
    program: [{ define: 'hop', do: ['right', null] }, { until: 'rock-right', do: [{ call: 'hop' }] }, { until: 'flower', do: ['down'] }, { if: 'rock-down', then: ['up'], else: [] }],
    tiles: ['right', 2, 'rock-left', 'flower', { call: 'hop' }], prompt: 'p', explain: 'e',
  }, { x: true, y: true });
  assert.deepEqual(m.program, [{ define: 'hop', do: ['left', null] }, { until: 'rock-left', do: [{ call: 'hop' }] }, { until: 'flower', do: ['up'] }, { if: 'rock-up', then: ['down'], else: [] }]);
  assert.deepEqual(m.tiles, ['left', 2, 'rock-right', 'flower', { call: 'hop' }]);
});

test('a bug item is graded by running the fixed program', () => {
  const item = { id: 'b', type: 'bug', level: ['S..*'], program: ['right', 'up', 'right'], tiles: ['right', 'down'], prompt: 'p', explain: 'e' };
  assert.equal(problem(item), null);
  assert.deepEqual(fixBug(item), { part: 1, tile: 'right' });
  assert.equal(run(item.level, changed(item, { part: 1, tile: 'right' })).end, 'flower');
  assert.equal(run(item.level, changed(item, { part: 0, tile: 'right' })).end, 'bump');
  assert.equal(problem({ ...item, program: ['right', 'right', 'right'] }), 'the program it ships already works');
  assert.equal(problem({ ...item, tiles: ['down'] }), 'no change reaches the flower');
  assert.equal(problem({ ...item, program: [null, 'up', 'right'] }), 'bug has holes');
  for (const flip of [{ x: true }, { y: true }, { x: true, y: true }]) assert.equal(problem(mirrored(item, flip)), null);
  assert.equal(vary(item, () => 0).level[0], '*..S');
});

test('toJS writes every block as JavaScript, the one source of code text', () => {
  assert.equal(toJS(['right', { repeat: 3, do: ['up'] }]), 'right();\nfor (let i = 0; i < 3; i++) {\n  up();\n}');
  assert.equal(toJS([{ repeat: 2, do: [{ repeat: 3, do: ['left'] }, 'down'] }]),
    'for (let i = 0; i < 2; i++) {\n  for (let j = 0; j < 3; j++) {\n    left();\n  }\n  down();\n}');
  assert.equal(toJS([{ until: 'flower', do: [{ if: 'rock-right', then: ['up'], else: ['right'] }] }]),
    'while (!flower()) {\n  if (rock("right")) {\n    up();\n  } else {\n    right();\n  }\n}');
  assert.equal(toJS([{ define: 'hop', do: ['up'] }, { call: 'hop' }]), 'function hop() {\n  up();\n}\nhop();');
  assert.equal(toJS([{ if: 'rock-up', then: ['down'], else: [] }]), 'if (rock("up")) {\n  down();\n}');
  assert.equal(toJS([{ repeat: null, do: [null] }, { until: null, do: [] }]), 'for (let i = 0; i < ___; i++) {\n  ___\n}\nwhile (!___) {\n}');
  assert.equal(jsFace({ call: 'hop' }), 'hop();');
  assert.equal(jsFace('rock-left'), 'rock("left")');
  assert.equal(toJS(mirrored({ level: ['S*'], program: ['right'] }, { x: true }).program), 'left();');
  const item = { id: 'j', type: 'predict', level: ['S*'], program: ['right'], view: 'js', prompt: 'p', explain: 'e' };
  assert.equal(problem(item), null);
  assert.equal(problem({ ...item, program: [{ define: 'a'.repeat(40), do: [] }] }), 'a line of code is too wide');
  assert.equal(problem({ ...item, type: 'bug', tiles: ['up'] }), 'that view cannot show this item');
  assert.equal(tileName({ call: 'hop' }), 'Block hop');
  assert.equal(tileName('rock-up'), 'Look for rock up');
});
