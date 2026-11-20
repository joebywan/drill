import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { problem, tapsOf, trayOf, vary, wayOf } from '../src/code/items.js';
import { run, same, tokenize } from '../src/code/interp.js';
import testing from '../src/code/courses/testing.js';
import javascript from '../src/code/courses/javascript.js';
import typescript from '../src/code/courses/typescript.js';

// Fresh versions of Test writing items: new values, with what each test expects worked out by running the real code.
const SEEDS = 200;
const itemsOf = (c) => c.units.flatMap((u) => u.lessons.flatMap((l) => l.items));
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const graded = itemsOf(testing).filter((i) => i.goal === 'tests');
const versions = new Map(graded.map((item) => [item, Array.from({ length: SEEDS }, (_, s) => vary(item, seeded(s + 1)))]));
const values = (item) => tokenize(wayOf(item)).filter((t) => t.t === 'num' || t.t === 'str').map((t) => t.raw).join();

/** Items whose values can't move, so a fresh version only renames, and why. */
const EVENS = 'evens([1, 2]): 2 is the % 2 the code computes with, and 1 the === 1 in a faulty copy';
const PET = 'older({ name: "a", age: 1 }): 1 is also the code\'s + 1, and a one-letter name carries nothing to vary';
const RENAME_ONLY = {
  'tb-1-6': 'shout("a") and shout("1"): one-character text, nothing to vary',
  'ts-1-6': 'shout("a") and shout("!"): one-character text, nothing to vary',
  'te-1-4': 'total([]) is 0 and the faulty copy starts from 1: those two are the point',
  'tl-1-3': EVENS, 'tl-1-8': EVENS, 'ts-1-8': EVENS, 'ts-2-7': EVENS,
  'tl-1-6': PET, 'tl-1-7': PET, 'tl-2-3': PET, 'tl-2-6': PET,
};

test('every fresh version of a Test writing item passes problem(), with the same chips, taps and true prose', () => {
  for (const [item, vs] of versions) for (const [s, v] of vs.entries()) {
    const at = `${item.id} seed ${s + 1}`;
    assert.equal(problem(v), null, at);
    assert.equal(v.id, item.id, at);
    // trayOf keeps one of each: the same count means no two chips came to look alike.
    assert.equal(trayOf(v).length, trayOf(item).length, at);
    if (v.type === 'build') assert.equal(tapsOf(v), tapsOf(item), at);
    for (const it of [item, v]) {
      const code = [wayOf(it), it.given, ...(it.decoys ?? []), ...it.mutants.map((m) => m.code)].join('\n');
      const held = new Set(tokenize(code).filter((t) => t.t === 'num').map((t) => String(t.v)));
      for (const text of [it.prompt, it.explain, ...it.mutants.map((m) => m.says)]) {
        for (const n of text.match(/\b\d+\b/g) ?? []) assert.ok(held.has(n), `${at}: ${n} in "${text}"`);
      }
    }
  }
});

test('a fresh version expects exactly what running the real code on its new inputs gives', () => {
  const expects = (item) => {
    const pairs = [];
    const want = (got) => (w) => { pairs.push([got, w]); };
    const r = run(`${item.given}\n${wayOf(item)}`, {
      ts: true,
      globals: ({ tryCall }) => ({ test: (_, f) => { tryCall(f, []); }, expect: (got) => ({ toBe: want(got), toEqual: want(got), toContain: () => {}, toThrow: () => {} }) }),
    });
    assert.equal(r.error, null, item.id);
    return pairs;
  };
  let checked = 0;
  for (const [item, vs] of versions) for (const v of vs.filter((x) => values(x) !== values(item))) {
    for (const [got, want] of expects(v)) { assert.ok(same(got, want), `${item.id}: ${wayOf(v)}`); checked++; }
  }
  assert.ok(checked > 5000, `${checked} checks`);
});

test('how many Test writing items vary in their values, and why the rest only rename', () => {
  const valued = graded.filter((item) => versions.get(item).some((v) => values(v) !== values(item)));
  const renamed = graded.filter((item) => !valued.includes(item));
  assert.deepEqual(renamed.map((i) => i.id).sort(), Object.keys(RENAME_ONLY).sort());
  assert.deepEqual([valued.length, graded.length], [48, 59], 'items that vary in values, of all graded items');
  for (const item of renamed) for (const v of versions.get(item)) assert.notEqual(v, item, `${item.id} still gets new names`);
  // Most versions of an item that can move do: the rest are renames, never a stale answer.
  for (const item of valued) {
    const moved = versions.get(item).filter((v) => values(v) !== values(item)).length;
    assert.ok(moved >= SEEDS / 5, `${item.id}: ${moved} of ${SEEDS}`);
  }
});

test('an edge moves in the real code, every faulty copy and the tests together', () => {
  const edge = graded.find((i) => i.id === 'tb-2-3'); // test("18 is an adult") and test("17 is not")
  for (const v of versions.get(edge).filter((x) => values(x) !== values(edge))) {
    const [, line] = v.given.match(/>= (\d+)/);
    assert.ok(v.mutants[0].code.includes(`> ${line}`) && v.mutants[0].says.includes(line), v.mutants[0].says);
    assert.ok(v.fill[0].includes(`(${line})`) && v.fill[1].includes(`(${line - 1})`), v.fill.join());
    assert.match(v.code, new RegExp(`"${line} is an adult".*"${line - 1} is not"`));
  }
});

test('JavaScript and TypeScript fresh versions are as they were (update the prints only when changing vary on purpose)', () => {
  // Last changed on purpose when functions stopped being renamed.
  const print = (c) => {
    const h = createHash('sha256');
    for (const item of itemsOf(c)) for (const s of [1, 2, 3, 7, 99]) h.update(JSON.stringify(vary(item, seeded(s))));
    return h.digest('hex').slice(0, 16);
  };
  assert.equal(print(javascript), 'b38689d9a8af3d01');
  assert.equal(print(typescript), '9effaff44941e0e9');
});

test('a fresh version never renames a function, in any code course', () => {
  const fns = (src) => [...src.matchAll(/\bfunction (\w+)|\b(?:const|let) (\w+) = (?:\([^)]*\)|\w+) =>/g)].map((m) => m[1] ?? m[2]);
  const text = (item) => [wayOf(item), item.type === 'predict' ? item.code : '', item.given ?? ''].join('\n');
  for (const c of [javascript, typescript, testing]) for (const item of itemsOf(c).filter((i) => i.type !== 'teach' && !i.asks)) {
    for (const s of [1, 2, 3]) {
      const v = vary(item, seeded(s));
      for (const f of fns(text(item))) assert.match(text(v), new RegExp(`\\b${f}\\b`), `${item.id}: ${f}`);
    }
  }
});
