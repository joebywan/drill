import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mirrored, problem as codingProblem, solve, vary as codingVary, variantsOf as codingVariants } from '../src/coding/program.js';
import { problem as mathsProblem, target, vary as mathsVary, variantsOf as mathsVariants } from '../src/maths/items.js';
import { buildCoding, buildMaths, toFile } from '../tools/variants.js';
import codingCourse from '../src/data/coding.json' with { type: 'json' };
import mathsCourse from '../src/data/maths.json' with { type: 'json' };
import codingPool from '../src/data/coding-variants.json' with { type: 'json' };
import mathsPool from '../src/data/maths-variants.json' with { type: 'json' };

const all = (course) => course.units.flatMap((u) => u.lessons.flatMap((l) => l.items));
const FLIPS = [{}, { x: true }, { y: true }, { x: true, y: true }];
const family = (course) => all(course).filter((i) => i.family);
const counted = (i) => JSON.stringify(i.program ?? []).includes('null') && (solve(i) ?? []).filter((v) => typeof v === 'number').join();

test('the pool files are what the tool writes: same seed, same bytes, and small enough', () => {
  for (const [file, pool, build] of [['coding', codingPool, buildCoding], ['maths', mathsPool, buildMaths]]) {
    const text = readFileSync(`src/data/${file}-variants.json`, 'utf8');
    assert.equal(text, toFile(build()), `${file}: run npm run variants`);
    assert.deepEqual(JSON.parse(text), pool);
    assert.ok(text.length < 220 * 1024, `${file}: ${text.length}`);
  }
});

test('every Coding entry passes problem() as each of its items, at every flip', () => {
  const seen = new Set();
  for (const item of family(codingCourse)) {
    assert.ok(codingPool[item.family], `${item.id}: no family ${item.family}`);
    for (const entry of codingPool[item.family]) {
      const key = JSON.stringify([item.type, item.view, entry]);
      if (seen.has(key)) continue;
      seen.add(key);
      const v = { id: item.id, type: item.type, ...(item.view && { view: item.view }), ...entry };
      for (const flip of FLIPS) assert.equal(codingProblem(mirrored(v, flip)), null, `${item.id} ${JSON.stringify(flip)} ${JSON.stringify(entry.level)}`);
      assert.ok(entry.level[0].length <= 7 && entry.level.length <= 5, 'fits a phone');
    }
  }
});

test('every Coding item with a family has fresh entries, and a repeat keeps its id, type and view', () => {
  for (const item of family(codingCourse)) {
    const fresh = codingVariants(item);
    assert.ok(fresh.length >= 2, `${item.id}: ${fresh.length} entries fit it`);
    for (const e of fresh) assert.deepEqual([e.id, e.type, e.view], [item.id, item.type, item.view]);
    const v = codingVary(item, () => 0.5);
    assert.equal(v.id, item.id);
    assert.notEqual(JSON.stringify([v.level, v.program]), JSON.stringify([item.level, item.program]));
  }
});

test('a "how many times?" never comes back with the same number', () => {
  const asks = family(codingCourse).filter((i) => i.type === 'build' && counted(i));
  assert.ok(asks.length >= 30, `${asks.length} count items`);
  for (const item of asks) for (const e of codingVariants(item)) assert.notEqual(counted(e), counted(item), `${item.id}: ${e.level}`);
});

test('without a family an item still flips, or returns as written in Maths', () => {
  const bug = all(codingCourse).find((i) => i.type === 'bug');
  assert.ok(!bug.family);
  assert.deepEqual(codingVary(bug, () => 0).level, mirrored(bug, { x: true }).level);
  const plain = all(mathsCourse).find((i) => i.id === 'frac-2-4q');
  assert.ok(!plain.family);
  assert.equal(mathsVary(plain), plain);
  const teach = all(mathsCourse).find((i) => i.type === 'teach');
  assert.equal(mathsVary(teach), teach);
});

test('every Maths entry passes problem(), and a repeat has a new answer and the same id', () => {
  for (const item of family(mathsCourse)) {
    assert.ok(mathsPool[item.family], `${item.id}: no family ${item.family}`);
    for (const e of mathsPool[item.family]) assert.equal(mathsProblem({ id: item.id, type: item.type, ...e }), null, `${item.id} ${JSON.stringify(e)}`);
    const fresh = mathsVariants(item);
    assert.ok(fresh.length >= 2, `${item.id}: ${fresh.length}`);
    for (const e of fresh) {
      assert.equal(e.id, item.id);
      if (item.type !== 'pairs') assert.notEqual(target(e), target(item), `${item.id}: ${e.show}`);
    }
    assert.equal(mathsVary(item, () => 0.5).id, item.id);
  }
});

test('the numbers an explanation quotes come from its own sum', () => {
  for (const [name, list] of Object.entries(mathsPool)) for (const e of list) {
    if (name.endsWith('pairs') || name.startsWith('make-') || e.goal === 'biggest') continue;
    const a = String(+target(e).toFixed(6));
    if (e.show === undefined && e.picture?.bar) continue;
    assert.ok(e.explain.includes(a) || /hop|halfway|whole/.test(e.explain) || /same as|out of 100/.test(e.explain), `${name}: ${e.explain} should say ${a}`);
  }
  for (const list of Object.values(codingPool)) for (const e of list) {
    const m = e.explain.match(/^(\d+) rounds/);
    if (m) assert.equal(Number(m[1]), solve({ ...e, type: 'build' }).find((v) => typeof v === 'number'), e.explain);
  }
});

test('words a flip would turn into nonsense stay out of every entry', () => {
  const idiom = /\b(times over|twice over|over and|all over|start over|is over|right (away|now|answer|one|choice)|that's right|is right\b(?!\()|set up|pick up|look up|left over|blocks? left|what's left)\b/i;
  for (const list of Object.values(codingPool)) for (const e of list) for (const t of [e.prompt, e.explain]) assert.doesNotMatch(t, idiom, t);
});
