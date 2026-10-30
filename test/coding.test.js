import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answer, blockCount, changed, fewestSteps, fill, fixBug, fromTree, holes, jsFace, mirrored, parse, parts, pieces, problem, punch, reached, reaches, run, runItem, solve, tileName, toJS, vary } from '../src/coding/program.js';
import course from '../src/data/coding.json' with { type: 'json' };

const level = ['S.#*', '....'];
const units = course.units;
const lessons = units.flatMap((u) => u.lessons);
const allItems = lessons.flatMap((l) => l.items);

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

test('an item with a number to pick must finish on the flower: more steps than it takes is a miss', () => {
  const item = { id: 'x', type: 'build', level: ['S..*'], program: [{ repeat: null, do: ['right'] }], tiles: [2, 3, 4], prompt: 'p', explain: 'e' };
  assert.equal(reaches(item, [3]), true);
  assert.equal(reaches(item, [4]), false);
  assert.equal(runItem(item, fill(item.program, [4])).end, 'spare');
  assert.equal(run(['S..*'], [{ repeat: 4, do: ['right'] }]).end, 'flower', 'reading a program, the flower still stops me');
  assert.equal(run(['S*.*.'], [{ repeat: 3, do: ['right'] }], undefined, true).end, 'flower');
  assert.equal(run(['S*.*.'], [{ repeat: 4, do: ['right'] }], undefined, true).end, 'spare', 'past the last of several too');
  assert.equal(run(['S.*'], [{ until: 'flower', do: ['right'] }], undefined, true).end, 'flower', 'an until that ends on it has nothing to spare');
  assert.equal(run(['S.*'], [{ repeat: 2, do: ['right'] }, { set: 'n', to: 1 }], undefined, true).end, 'flower', 'only a step counts');
});

test('the biggest number never wins by being biggest, in the course or the pools', () => {
  const count = allItems.filter((i) => i.type === 'build' && i.tiles.some((t) => typeof t === 'number'));
  const biggest = (i) => Math.max(...i.tiles.filter((t) => typeof t === 'number'));
  let top = 0;
  for (const i of count) {
    const ans = solve(i).filter((v) => typeof v === 'number');
    if (Math.max(...ans) === biggest(i)) top++;
    if (holes(i.program).length === 1 && ans[0] !== biggest(i)) assert.equal(reaches(i, [biggest(i)]), false, i.id);
  }
  assert.ok(top / count.length < 0.4, `the biggest tile is the answer on ${top} of ${count.length}`);
});

test('the three laid-out kinds are right by running, and problem() checks each', () => {
  const way = [{ repeat: 3, do: ['right'] }, 'down'];
  const base = { id: 'u', type: 'unscramble', level: ['S..#', '...*'], way, chips: ['down', 'right', { repeat: 3, do: [] }].slice(0), prompt: 'p', explain: 'e' };
  assert.deepEqual(pieces(way), [{ repeat: 3, do: [] }, 'right', 'down']);
  assert.equal(blockCount(way), 3);
  assert.equal(problem(base), 'its way does not reach the goal');
  const ok = { ...base, level: ['S...', '...*'] };
  assert.equal(problem(ok), null);
  assert.equal(problem({ ...ok, chips: pieces(way) }), 'the chips are already in order');
  assert.equal(problem({ ...ok, chips: ['down', { repeat: 3, do: [] }] }), 'its way uses a block that is not a chip');
  assert.equal(problem({ ...ok, chips: ['down', 'left', 'right', { repeat: 3, do: [] }] }), 'the chips must be the blocks of its way');
  const line = { id: 'p', type: 'palette', level: ['S....*'], way: [{ repeat: 5, do: ['right'] }], chips: ['right', 'down', { repeat: 5, do: [] }, { repeat: 6, do: [] }], limit: 2, prompt: 'p', explain: 'e' };
  assert.equal(fewestSteps(line.level), 5);
  assert.equal(problem(line), null);
  assert.equal(problem({ ...line, limit: 5 }), 'plain steps fit the limit: nothing forces a loop');
  assert.equal(problem({ ...line, limit: 1 }), 'its way is over the limit');
  assert.equal(problem({ ...line, type: 'free', limit: 8 }), null);
  const m = mirrored(line, { x: true });
  assert.deepEqual(m.way, [{ repeat: 5, do: ['left'] }]);
  assert.equal(m.chips[0], 'left');
  assert.equal(runItem(line, [{ repeat: 6, do: ['right'] }]).end, 'spare');
  const chips = ['right', { if: 'rock-right', then: [], else: [] }, 'down'];
  assert.deepEqual(fromTree([{ chip: 1, arms: [[{ chip: 2 }], [{ chip: 0 }]] }], chips), [{ if: 'rock-right', then: ['down'], else: ['right'] }]);
});

test('every palette forces a loop, and each unit unscrambles early', () => {
  for (const i of allItems.filter((x) => x.type === 'palette')) assert.ok(fewestSteps(i.level) > i.limit, i.id);
  assert.ok(allItems.some((i) => i.type === 'unscramble') && allItems.some((i) => i.type === 'free'));
  for (const u of units.filter((x) => !['Find the bug', 'From blocks to code'].includes(x.title))) {
    assert.ok(u.lessons.slice(0, 2).some((l) => l.items.some((i) => i.type === 'unscramble')), `${u.title} unscrambles early`);
  }
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

const uses = (item, key) => JSON.stringify(item.program ?? []).includes(`"${key}"`);

test('the course is long, and each lesson is a proper session', () => {
  assert.ok(lessons.length >= 48 && lessons.length <= 55, `${lessons.length} lessons`);
  for (const l of lessons) assert.ok(l.items.length >= 8 && l.items.length <= 10, `${l.id}: ${l.items.length}`);
  for (const l of lessons) assert.ok(l.items.some((i) => i.type === 'predict'), `${l.id} has something to read`);
  // Five at most: the last reads every earlier kind of block as code, others end on a lesson laid out from nothing.
  for (const u of units) assert.ok(u.lessons.length >= 3 && u.lessons.length <= 5, u.title);
});

test('saved progress still points somewhere: every first-course id is kept', () => {
  const old = { 'steps-0': 'meet one three turn where', 'steps-1': 'rock around wall stop bump', 'loops-0': 'meet count inside order stairs where', 'loops-1': 'long two', 'if-0': 'meet again climb down where', 'if-1': 'count up where' };
  for (const [id, items] of Object.entries(old)) {
    const lesson = lessons.find((l) => l.id === id);
    assert.ok(lesson, id);
    for (const i of items.split(' ')) assert.ok(lesson.items.some((x) => x.id === `${id}-${i}`), `${id}-${i}`);
  }
});

test('every new rule is shown on a teach card before anything asks it', () => {
  const first = (test) => allItems.findIndex(test);
  const rules = {
    nesting: (i) => /"repeat":[^}]*"do":\[[^\]]*"repeat"/.test(JSON.stringify(i.program ?? [])),
    until: (i) => uses(i, 'until'),
    'never ending': (i) => i.program && !JSON.stringify(i.program).includes('null') && run(i.level, i.program).end === 'endless',
    'your own block': (i) => uses(i, 'define'),
    'a block in a block': (i) => i.program?.some((b) => b?.define && JSON.stringify(b.do).includes('call')),
    'bug hunting': (i) => i.type === 'bug' || (i.type === 'teach' && i.id === 'bug-0-meet'),
    'if with holes in its look': (i) => i.id === 'if-2-meet' || i.program?.some((b) => JSON.stringify(b ?? '').includes('"if":null')),
    javascript: (i) => !!i.view,
    parameters: (i) => uses(i, 'params'),
    variables: (i) => uses(i, 'set'),
    'changing a value': (i) => uses(i, 'change'),
    'several flowers': (i) => i.level && parse(i.level).flowers.length > 1,
    'picking some of them': (i) => 'want' in i,
    'more or less than': (i) => /"op":"[<>]"/.test(JSON.stringify(i.program ?? [])),
    not: (i) => uses(i, 'not'),
    and: (i) => uses(i, 'and'),
    or: (i) => uses(i, 'or'),
    lists: (i) => uses(i, 'each'),
    'lists of numbers': (i) => /"in":\[(null,)*-?\d/.test(JSON.stringify(i.program ?? [])),
    drawing: (i) => i.level && parse(i.level).shape,
    'variables as code': (i) => i.view && uses(i, 'set'),
    'parameters as code': (i) => i.view && uses(i, 'params'),
    'tests as code': (i) => i.view && (uses(i, 'or') || uses(i, 'and') || uses(i, 'not')),
    'arrays as code': (i) => i.view && uses(i, 'each'),
    unscramble: (i) => i.type === 'unscramble' || i.shows === 'unscramble',
    'a loop chip': (i) => (i.type === 'unscramble' && i.chips.some((c) => typeof c === 'object')) || i.shows === 'unscramble-loop',
    'a tray with a limit': (i) => i.type === 'palette' || i.shows === 'palette',
    'free build': (i) => i.type === 'free' || i.shows === 'free',
  };
  for (const [name, test] of Object.entries(rules)) {
    const at = first(test);
    assert.ok(at >= 0, name);
    assert.equal(allItems[at].type, 'teach', `${name} first appears on ${allItems[at].id}`);
  }
});

test('every level fits a phone, and every flip of every item still works', () => {
  for (const i of allItems.filter((x) => x.level)) {
    assert.ok(i.level[0].length <= 7 && i.level.length <= 5, `${i.id} is too big for 360px`);
  }
  for (const i of allItems.filter((x) => x.type === 'bug')) {
    assert.ok(!reached(runItem(i)), i.id);
    assert.ok(reached(runItem(i, changed(i, fixBug(i)))), i.id);
  }
});

test('words a flip would turn into nonsense stay out of what is said', () => {
  const idiom = /\b(times over|twice over|over and|all over|start over|is over|right (away|now|answer|one|choice)|that's right|is right\b(?!\()|set up|pick up|look up|left over|blocks? left|what's left)\b/i;
  for (const i of allItems) for (const t of [i.prompt, i.explain]) if (t) assert.doesNotMatch(t, idiom, `${i.id}: ${t}`);
});

test('every first-course lesson and item id is still there, in its place', () => {
  const ids = lessons.flatMap((l) => l.items.map((i) => i.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(units.map((u) => u.title), ['Step by step', 'Loops', 'If and else', 'Nested loops', 'Repeat until', 'Your own block', 'Parameters', 'Variables', 'Comparisons and logic', 'Lists', 'Drawing', 'Find the bug', 'From blocks to code']);
});

test('variables hold, change and are recorded at each square; a parameter holds only inside its block', () => {
  const r = run(['S...*'], [{ set: 'n', to: 1 }, { change: 'n', by: 2 }, { repeat: 'n', do: ['right'] }]);
  assert.deepEqual(r.path.at(-1), [3, 0]);
  assert.deepEqual(r.values, [{ n: 3 }, { n: 3 }, { n: 3 }, { n: 3 }]);
  assert.equal(run(['S..*'], [{ define: 'hop', params: ['k'], do: [{ repeat: 'k', do: ['right'] }] }, { call: 'hop', args: [3] }]).end, 'flower');
  const after = run(['S..', '...'], [{ define: 'hop', params: ['k'], do: ['right'] }, { set: 'k', to: 7 }, { call: 'hop', args: [1] }, { set: 'j', to: 'k' }]);
  assert.equal(after.values.at(-1).j, 7, 'the old value is back when the block ends');
});

test('a loop that only changes values is stopped too, and a comparison reads a variable', () => {
  const count = (n, by = 1) => [{ set: 'c', to: 0 }, { until: { cmp: 'c', op: '=', n }, do: [{ change: 'c', by }] }];
  assert.equal(run(['S.*'], count(3)).end, 'short');
  assert.equal(run(['S.*'], count(3, 2)).end, 'endless', 'it counts past 3 for ever');
  assert.equal(run(['S.*'], [{ until: 'flower', do: [{ set: 'c', to: 1 }] }]).end, 'endless');
  const held = (look, vars = 2) => run(['S*'], [{ set: 'c', to: vars }, { if: look, then: ['right'], else: [] }]).end === 'flower';
  assert.ok(held({ cmp: 'c', op: '<', n: 3 }) && !held({ cmp: 'c', op: '>', n: 3 }) && held({ cmp: 'c', op: '=', n: 2 }));
  assert.ok(held({ not: { cmp: 'c', op: '>', n: 3 } }));
  assert.ok(held({ and: ['rock-up', { cmp: 'c', op: '=', n: 2 }] }) && !held({ and: ['rock-right', 'rock-up'] }));
  assert.ok(held({ or: ['rock-right', 'rock-up'] }));
});

test('several flowers: the walk goes on until the blocks run out, and exactly `want` is right', () => {
  const walk = (n) => [{ repeat: n, do: ['right'] }];
  assert.equal(run(['S*.*'], walk(1)).end, 'short');
  assert.equal(run(['S*.*'], walk(3)).end, 'flower');
  assert.equal(run(['S*.*.'], walk(4)).end, 'flower', 'walking past the last one is fine');
  assert.equal(run(['S*.*.*'], walk(3), 2).end, 'flower');
  assert.equal(run(['S*.*.*'], walk(5), 2).end, 'short', 'three is not two');
  const count = [{ set: 'f', to: 0 }, { until: { cmp: 'f', op: '=', n: 2 }, do: ['right', { if: 'flower', then: [{ change: 'f', by: 1 }], else: [] }] }];
  const r = run(['S*.*.*'], count, 2);
  assert.equal(r.end, 'flower');
  assert.deepEqual(r.path.at(-1), [3, 0]);
  assert.equal(r.values.at(-1).f, 2);
  assert.equal(problem({ id: 'x', type: 'predict', level: ['S*'], program: [], want: 1, prompt: 'p', explain: 'e' }), 'want needs enough flowers');
});

test('a list runs its blocks once per value, in order; go steps the way a variable holds', () => {
  const r = run(['S.', '.*'], [{ each: 'way', in: ['right', 'down'], do: [{ go: 'way' }] }]);
  assert.equal(r.end, 'flower');
  assert.deepEqual(r.values[0], { way: 'right' });
  assert.deepEqual(run(['S..', '..*'], [{ each: 'n', in: [2, 1], do: [{ repeat: 'n', do: ['right'] }] }]).path.at(-1), [2, 0], 'the second value bumps');
  const m = mirrored({ id: 'a', type: 'build', level: ['S.', '.*'], program: [{ each: 'way', in: ['right', null, 'down'], do: [{ go: 'way' }] }], tiles: ['down', { go: 'way' }], prompt: 'p', explain: 'e' }, { x: true });
  assert.deepEqual(m.program[0].in, ['left', null, 'down']);
  assert.deepEqual(m.tiles, ['down', { go: 'way' }]);
  assert.deepEqual(holes([{ each: 'n', in: [1, null], do: [null] }]), ['count', 'step']);
});

test('a drawing is right when the squares stood on are exactly the shape, however they were walked', () => {
  const ring = ['So', 'oo'];
  assert.equal(run(ring, ['right', 'down', 'left']).end, 'drawn');
  assert.equal(run(ring, ['down', 'right', 'up']).end, 'drawn', 'the other way round');
  assert.equal(run(ring, ['right', 'left', 'down', 'right', 'up', 'down']).end, 'drawn', 'with squares walked twice');
  assert.equal(run(ring, ['right', 'down']).end, 'short', 'a square short');
  assert.equal(run(['Soo.'], ['right', 'right', 'right']).end, 'short', 'a square too many');
  const item = { id: 'd', type: 'build', level: ['So', 'oo'], program: [null, null, null], tiles: ['right', 'down', 'left', 'up'], prompt: 'p', explain: 'e' };
  assert.equal(problem(item), null);
  assert.deepEqual(mirrored(item, { x: true }).level, ['oS', 'oo']);
  assert.equal(problem({ ...item, level: ['S.', '..'] }), 'level needs S and a flower or a shape');
});

test('toJS writes the new blocks, and holes stay in reading order', () => {
  assert.equal(toJS([{ set: 'n', to: 2 }, { set: 'n', to: 3 }, { change: 'n', by: 1 }, { change: 'n', by: -2 }]), 'let n = 2;\nn = 3;\nn = n + 1;\nn = n - 2;');
  assert.equal(toJS([{ define: 'hop', params: ['n'], do: [{ repeat: 'n', do: ['up'] }] }, { call: 'hop', args: [3] }]), 'function hop(n) {\n  for (let i = 0; i < n; i++) {\n    up();\n  }\n}\nhop(3);');
  assert.equal(toJS([{ until: { cmp: 'n', op: '=', n: 3 }, do: [] }]), 'while (!(n === 3)) {\n}');
  assert.equal(toJS([{ if: { and: ['rock-up', { not: 'flower' }] }, then: ['up'], else: [] }]), 'if (rock("up") && !flower()) {\n  up();\n}');
  assert.equal(toJS([{ if: { or: [{ cmp: 'n', op: '<', n: 1 }, { cmp: 'n', op: '>', n: 3 }] }, then: [], else: [] }]), 'if (n < 1 || n > 3) {\n}');
  assert.equal(toJS([{ each: 'way', in: ['up', 'left'], do: [{ go: 'way' }] }]), 'let ways = ["up", "left"];\nfor (const way of ways) {\n  go(way);\n}');
  assert.equal(toJS([{ each: 'n', in: [2, 1], do: [] }]), 'let ns = [2, 1];\nfor (const n of ns) {\n}');
  const holey = [{ set: 'a', to: null }, { until: { cmp: 'a', op: null, n: null }, do: [{ change: 'a', by: null }] }, { define: 'h', params: ['n'], do: [] }, { call: 'h', args: [null] }];
  assert.deepEqual(holes(holey), ['count', 'op', 'count', 'count', 'count']);
  assert.equal(toJS(holey).split('___').length - 1, 5);
  assert.equal(jsFace('='), '===');
  assert.equal(jsFace({ call: 'hop', args: [3] }), 'hop(3);');
  assert.equal(tileName({ cmp: 'a', op: '<', n: 2 }), 'Look for a < 2');
  const m = mirrored({ id: 'a', type: 'bug', level: ['S.', '.*'], program: [{ until: { and: ['rock-right', { not: 'rock-up' }] }, do: ['right'] }], tiles: [{ or: ['rock-left', 'flower'] }, '<'], prompt: 'p', explain: 'e' }, { x: true, y: true });
  assert.deepEqual(m.program[0].until, { and: ['rock-left', { not: 'rock-down' }] });
  assert.deepEqual(m.tiles[0], { or: ['rock-right', 'flower'] });
});

test('a call must give each parameter a value', () => {
  const base = { id: 'x', type: 'predict', level: ['S*'], prompt: 'p', explain: 'e' };
  const hop = { define: 'hop', params: ['n'], do: [] };
  assert.equal(problem({ ...base, program: [hop, { call: 'hop', args: [1] }] }), null);
  assert.equal(problem({ ...base, program: [hop, { call: 'hop' }] }), 'a call gives the wrong number of values');
});
