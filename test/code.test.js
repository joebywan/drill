import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, run, same, show } from '../src/code/interp.js';
import { check } from '../src/code/types.js';
import { chipsOf, flaggedLine, grade, layout, pretty, problem, vary } from '../src/code/items.js';

const out = (src, o) => { const r = run(src, o); assert.equal(r.error, null, r.error?.message); return r.output; };
const said = (src, o) => run(src, o).error;

test('the interpreter runs the subset', () => {
  assert.deepEqual(out('console.log(1 + 2 * 3, "a" + 1, 7 % 2, !true, -4, 2 < 3 && 3 < 2, null ?? 0);'.replace(', null ?? 0', '')), ['7 a1 1 false -4 false']);
  assert.deepEqual(out('let t = 0; for (let i = 0; i < 4; i++) { if (i === 1) { continue; } if (i === 3) { break; } t += i; } console.log(t);'), ['2']);
  assert.deepEqual(out('const xs = [1, 2, 3]; xs.push(4); let s = 0; for (const x of xs) { s += x; } console.log(s, xs.length, xs[1], xs[9]);'), ['10 4 2 undefined']);
  assert.deepEqual(out('let n = 3; while (n > 0) { n--; } console.log(n);'), ['0']);
  assert.deepEqual(out('function dbl(n) { return n * 2; } const inc = (n) => n + 1; const sq = n => { return n * n; }; console.log(dbl(inc(sq(2))));'), ['10']);
  assert.deepEqual(out('console.log(early()); function early() { return "up"; }'), ['up']);
  assert.deepEqual(out('const p = { name: "Rosa", age: 70 }; p.age = 71; p.town = "Bath"; console.log(p.name, p["age"], p);'), ['Rosa 71 { name: "Rosa", age: 71, town: "Bath" }']);
  assert.deepEqual(out('const a = [1, 2, 3, 4]; console.log(a.map(x => x * 2), a.filter(x => x > 2), a.includes(9), Math.max(1, 5), a.join("-"));'), ['[2, 4, 6, 8] [3, 4] false 5 1-2-3-4']);
  assert.deepEqual(out('function make() { let c = 0; return () => { c++; return c; }; } const f = make(); f(); console.log(f(), typeof f, typeof 1, 1 > 0 ? "y" : "n");'), ['2 function number y']);
  assert.deepEqual(out('[1, 2].forEach((x, i) => { console.log(x, i); });'), ['1 0', '2 1']);
  assert.deepEqual(out('console.log("ab".length, "ab".toUpperCase(), "ab".includes("b"), "ab"[1]);'), ['2 AB true b']);
  assert.ok(same([1, { a: [2] }], [1, { a: [2] }]));
  assert.equal(same({ a: 1 }, { a: 2 }), false);
  assert.equal(show([1, 'a', { b: null }]), '[1, "a", { b: null }]');
});

test('parse errors and run errors come in plain words, with no JavaScript error names', () => {
  const cases = [
    ['let = 3;', /name for a variable/], ['let let = 3;', /keeps for itself/], ['console.log("hi);', /quote mark/], ['console.log(1', /stops too early/],
    ['if x { }', /expected "\("/], ['for (let i = 0; i < 3) { }', /";"/], ['let a = 1 let b = 2', /needs a ";"/], ['}', /no "\{"/], ['1 = 2;', /can be changed/], ['const a;', /const needs a value/], ['var a = 1;', /let and const/],
    ['# ', /can't read/],
  ];
  for (const [src, want] of cases) {
    const e = said(src);
    assert.equal(e?.kind, 'parse', src);
    assert.match(e.message, want, src);
  }
  assert.match(said('console.log(nope);').message, /don't know "nope"/);
  assert.match(said('const a = 1; a = 2;').message, /made with const/);
  assert.match(said('let a = 1; let a = 2;').message, /already/);
  assert.match(said('let a; a.b;').message, /"a" is undefined/);
  assert.match(said('let a = 3; a();').message, /isn't a function/);
  assert.match(said('[1] * 2;').message, /a list/);
  assert.match(said('throw new Error("no");').message, /no/);
});

test('it stops what never ends and reaches nothing outside itself', () => {
  assert.equal(said('while (true) { }').kind, 'limit');
  assert.equal(said('for (;;) { let a = 1; }').kind, 'limit');
  assert.equal(said('function f() { return f(); } f();').kind, 'limit');
  for (const src of ['process', 'globalThis', 'require("fs")', 'eval("1")', 'Function("return 1")', 'window']) assert.match(said(`${src};`).message, /don't know/);
  // Host prototypes are never reachable: every one of these is a plain missing name.
  assert.deepEqual(out('const o = {}; console.log(o.constructor, o.__proto__, [].constructor, "a".constructor, Math.constructor, console.log.call);'), ['undefined undefined undefined undefined undefined undefined']);
  assert.deepEqual(out('const o = {}; o.__proto__ = 1; console.log(o.__proto__, ({}).toString);'), ['1 undefined']);
  assert.equal(({}).polluted, undefined);
});

const types = (src) => check(parse(src, { ts: true })).map((e) => e.message);
const okTypes = (src) => assert.deepEqual(types(src), [], src);
const badTypes = (src, want) => { const m = types(src); assert.ok(m.length, `${src} should fail`); assert.match(m[0], want, src); };

test('the checker accepts the TypeScript the course teaches', () => {
  okTypes('let a: number = 1; const b = "x"; let c: boolean = a > 0; let d: number[] = [1, 2]; d.push(3);');
  okTypes('function add(a: number, b: number): number { return a + b; } const s: number = add(1, 2);');
  okTypes('const dbl = (n: number): number => n * 2; const xs: number[] = [1].map((x) => dbl(x));');
  okTypes('function f(x: string | number): string { if (typeof x === "string") { return x.toUpperCase(); } return "n" + x; }');
  okTypes('type Mode = "on" | "off"; let m: Mode = "on"; m = "off"; function g(m: Mode): number { if (m === "on") { return 1; } return 0; }');
  okTypes('interface Pet { name: string; age?: number; } const p: Pet = { name: "a" }; const q: Pet = { name: "b", age: 3 }; console.log(p.name);');
  okTypes('interface Pet { age?: number; } function h(p: Pet): number { if (p.age === undefined) { return 0; } return 1; }');
  okTypes('function first<T>(xs: T[]): T { return xs[0]; } const a: number = first([1, 2]); const b: string = first<string>(["a"]);');
  okTypes('interface Box<T> { value: T; } const b: Box<number> = { value: 1 }; const n: number = b.value;');
  okTypes('function apply(f: (n: number) => number, n: number): number { return f(n); } apply((x) => x + 1, 2);');
  okTypes('function log(s: string): void { console.log(s); } function maybe(s?: string): string { if (s) { return s; } return ""; } maybe(); maybe("a");');
  okTypes('let a: string | undefined; a = "x"; let n = 0; n += 1; n++; for (const x of [1, 2]) { n += x; }');
});

test('the checker turns down what strict TypeScript would, in plain words', () => {
  badTypes('let a: number = "x";', /number.*can't hold "x"/);
  badTypes('let a = 1; a = "x";', /can't take/);
  badTypes('const a = 1; a = 2;', /const/);
  badTypes('function f(x) { return x; }', /"x" needs a type/);
  badTypes('function f(x: number): string { return x; }', /returns string/);
  badTypes('function f(x: number): number { if (x > 0) { return 1; } }', /reach its end/);
  badTypes('function f(a: number) {} f("x");', /wants number/);
  badTypes('function f(a: number) {} f();', /takes 1 value/);
  badTypes('function f(a: number) {} f(1, 2);', /takes 1 value/);
  badTypes('function f(x: string | number) { return x.toUpperCase(); }', /Not every kind/);
  badTypes('interface P { name: string; } const p: P = {};', /needs a "name"/);
  badTypes('interface P { name: string; } const p: P = { name: "a", age: 1 };', /no "age"/);
  badTypes('interface P { name: string; } const p: P = { name: 1 };', /"name" should be string/);
  badTypes('interface P { name: string; } const p: P = { name: "a" }; p.nam;', /no "nam"/);
  badTypes('interface P { age?: number; } function f(p: P) { return p.age + 1; }', /add/);
  badTypes('let a: Nope = 1;', /no type called/);
  badTypes('let xs: number[] = [1, "a"];', /holds number/);
  badTypes('let x = 1 - "a";', /two numbers/);
  badTypes('function first<T>(xs: T[]): T { return 1; }', /returns T/);
  badTypes('function first<T>(xs: T[]): T { return xs[0]; } const a: string = first([1]);', /can't hold number/);
  badTypes('type Mode = "on" | "off"; let m: Mode = "up";', /can't hold "up"/);
  badTypes('if (1 === "a") { }', /never the same/);
  badTypes('nope();', /don't know/);
});

test('chips: a string, a .name and console.log are one word each, and chunks stay whole', () => {
  assert.deepEqual(chipsOf('console.log("a b", xs.length);'), ['console.log', '(', '"a b"', ',', 'xs', '.length', ')', ';']);
  assert.deepEqual(chipsOf('test("a", () => { x(); });', ['() => {']), ['test', '(', '"a"', ',', '() => {', 'x', '(', ')', ';', '}', ')', ';']);
});

test('code is laid out in lines however it was placed', () => {
  assert.equal(pretty('for ( let i = 0 ; i < 3 ; i ++ ) { console.log ( i ) ; } let a = [ 1 , 2 ] ;'), 'for (let i = 0; i < 3; i++) {\n  console.log(i);\n}\nlet a = [1, 2];');
  assert.equal(pretty('if (a) { b(); } else { c(); }'), 'if (a) {\n  b();\n} else {\n  c();\n}');
  assert.equal(pretty('const p = { a: 1 }; f(() => { g(); });'), 'const p = { a: 1 };\nf(() => {\n  g();\n});');
  assert.equal(pretty('interface P { a: number; b?: string; } function f<T>(x: T[]): T { return x[0]; }'), 'interface P {\n  a: number;\n  b?: string;\n}\nfunction f<T>(x: T[]): T {\n  return x[0];\n}');
  assert.deepEqual(layout(['a', ';', 'b']), [undefined, undefined, 0]);
  // It never changes what the code means.
  for (const src of ['let t = 0; for (const x of [1, 2]) { if (x > 1) { t += x; } else { t -= 1; } } console.log(t);', 'const f = (a) => { return { a: a }; }; console.log(f(1).a, -1, !true);']) {
    assert.deepEqual(run(pretty(src)).output, run(src).output);
  }
});

const printing = { id: 'p', type: 'build', goal: 'print', way: 'let a = 2; console.log(a + 1);', prompt: 'p', explain: 'e' };
const adding = { id: 'r', type: 'build', goal: 'returns', name: 'add', cases: [[[1, 2], 3], [[5, 5], 10]], way: 'function add(a, b) { return a + b; }', decoys: ['-'], prompt: 'p', explain: 'e' };
const walking = { id: 'w', type: 'build', goal: 'walk', level: ['S#*', '...'], way: 'down(); right(); right(); up();', decoys: ['left'], prompt: 'p', explain: 'e' };
const testing = {
  id: 't', type: 'build', goal: 'tests', given: 'function add(a, b) { return a + b; }', prompt: 'p', explain: 'e',
  mutants: [{ code: 'function add(a, b) { return a - b; }', says: 'it takes away instead of adding.' }, { code: 'function add(a, b) { return a; }', says: 'it ignores the second number.' }],
  way: 'test("adds", () => { expect(add(2, 3)).toBe(5); });',
};

test('right is decided by running: any arrangement that does the job passes', () => {
  assert.equal(grade(printing, 'console.log(3);').right, true, 'a different program, the same output');
  assert.equal(grade(printing, 'console.log(1 + 2);').right, true);
  assert.match(grade(printing, 'console.log(4);').why, /printed 4/);
  assert.match(grade(printing, 'console.log(4').why, /stops too early/);
  assert.match(grade(printing, '').why, /printed nothing/);
  assert.equal(grade(adding, 'const add = (x, y) => y + x;').right, true);
  assert.match(grade(adding, 'function add(a, b) { return 3; }').why, /add\(5, 5\) gave 3, and it should give 10/, 'hard-coding one case fails a hidden one');
  assert.match(grade(adding, 'let x = 1;').why, /no function called "add"/);
});

test('walks reuse the grid: reaching the flower, bumps, steps to spare, loops, looks and callbacks', () => {
  assert.equal(grade(walking, 'down(); right(); right(); up();').right, true);
  assert.match(grade(walking, 'right();').why, /rock/);
  assert.match(grade(walking, 'down();').why, /ended before/);
  assert.match(grade(walking, 'down(); right(); right(); up(); down();').why, /kept going/);
  assert.match(grade(walking, 'while (true) { }').why, /never finishes/);
  assert.equal(grade(walking, 'down(); while (!rock("right")) { right(); } up();').right, true);
  const event = { ...walking, level: ['S.#', '..*'], way: '' };
  assert.equal(grade(event, 'onRock(() => { down(); right(); }); right(); right();').right, true, 'a callback runs at the rock');
  assert.match(grade(event, 'onRock(up()); right(); right();').why, /rock/, 'calling instead of passing');
  assert.equal(grade({ ...walking, goal: 'print', way: 'let n = 0; onStep(() => { n++; }); right(); console.log(n);', level: ['S.*'] }, 'console.log(1);').right, true);
});

test('tests are graded against the real code and every faulty version, and name what got through', () => {
  assert.equal(problem(testing), null);
  assert.equal(grade(testing, testing.way).right, true);
  assert.match(grade(testing, 'test("a", () => { expect(add(0, 0)).toBe(0); });').why, /takes away/, 'too weak: both faulty versions pass');
  assert.match(grade(testing, 'test("a", () => { expect(add(2, 0)).toBe(2); });').why, /takes away/);
  assert.match(grade(testing, 'test("a", () => { expect(add(2, 3)).toBe(6); });').why, /fails on the real code/);
  assert.match(grade(testing, 'expect(add(2, 3)).toBe(5);').why, /no test/);
  assert.match(grade(testing, 'test("a", () => { add(2, 3); });').why, /no expect/);
  assert.match(grade(testing, 'test("a", () => { expect(add(2, 3)).toBe(; });').why, /value/);
  assert.equal(grade(testing, 'test("x", () => { expect(add(2, 0)).toBe(2); }); test("y", () => { expect(add(1, 1)).toBe(2); });').right, true, 'many tests together');
  const throwing = { ...testing, given: 'function pos(n) { if (n < 0) { throw new Error("no"); } return n; }', mutants: [{ code: 'function pos(n) { return n; }', says: 'it never objects to a negative number.' }], way: 'test("n", () => { expect(() => pos(-1)).toThrow(); });' };
  assert.equal(problem(throwing), null);
  assert.match(grade(throwing, 'test("n", () => { expect(pos(1)).toBe(1); });').why, /never objects/);
  assert.match(grade(throwing, 'test("n", () => { expect(() => pos(1)).toThrow(); });').why, /fails on the real code/);
});

test('problem() catches items that cannot ship', () => {
  assert.equal(problem(printing), null);
  assert.equal(problem(adding), null);
  assert.equal(problem(walking), null);
  assert.match(problem({ ...printing, way: 'console.log(' }), /way fails/);
  assert.match(problem({ ...printing, way: 'let a = 1;' }), /prints nothing/);
  assert.match(problem({ ...printing, decoys: ['2'] }), /in its way/);
  assert.match(problem({ ...printing, way: 'console.log(2 * 2);', decoys: ['+'] }), /decoy \+ passes/, 'a decoy that still works');
  assert.match(problem({ ...walking, way: 'down();' }), /way fails/);
  assert.match(problem({ ...adding, cases: [[[1, 2], 4]] }), /way fails/);
  assert.match(problem({ ...testing, mutants: [{ code: 'function add(a, b) { return b + a; }', says: 'same thing.' }] }), /got through/, 'an equivalent mutant');
  assert.match(problem({ id: 'g', type: 'gap', goal: 'print', code: 'console.log(___);', fill: ['1', '2'], prompt: 'p', explain: 'e' }), /gaps/);
  assert.equal(problem({ id: 'q', type: 'predict', code: 'console.log(1 + 1);', wrong: ['3'], explain: 'e' }), null);
  assert.match(problem({ id: 'q', type: 'predict', code: 'let a = 1;', wrong: ['3'], explain: 'e' }), /prints nothing/);
});

test('the checker grades a TS item before it runs, and flagged lines are worked out', () => {
  const typed = { id: 'x', type: 'gap', ts: true, goal: 'print', code: 'let a: ___ = 1; console.log(a);', fill: ['number'], decoys: ['string'], prompt: 'p', explain: 'e' };
  assert.equal(problem(typed), null);
  assert.match(grade(typed, 'let a: string = 1; console.log(a);').why, /can't hold 1/);
  assert.equal(flaggedLine({ code: 'let a: number = 1; let b: string = a;', ts: true }), 'Line 2');
  assert.equal(flaggedLine({ code: 'let a: number = 1;', ts: true }), 'No problem');
});

test('a fresh version has new names or numbers, still works and keeps its words in step', () => {
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
  const item = { id: 'v', type: 'build', goal: 'print', way: 'let score = 4; console.log(score + 2);', prompt: 'Print score plus 2.', explain: 'score + 2 is {out}.', decoys: ['-'] };
  const v = vary(item, seq(0.1, 0.5, 0.9));
  assert.notEqual(v.way, item.way);
  assert.doesNotMatch(v.prompt, /score/);
  assert.equal(problem(v), null);
  const flip = vary(walking, seq(0.1));
  assert.notDeepEqual(flip.level, walking.level);
  assert.equal(problem(flip), null);
  const named = vary(adding, seq(0.2));
  assert.equal(named.name, 'add');
  assert.equal(vary({ id: 't', type: 'teach', text: 'x' }), null);
});
