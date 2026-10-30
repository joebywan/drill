import { AFTER_JS, Q, T, coarsened, lesson, unit } from './author.js';

/**
 * Writing tests in TypeScript, by chips. Per the repo rule, a learner's tests are graded independently:
 * they must pass on the real code (`given`) and fail on every hand-made faulty version (`mutants`).
 */
const CHIPS = ['() => {', '});', 'test(', 'expect('];
const ended = (c) => (c.startsWith('.to') ? `${c};` : c); // a matcher's chip ends its line
const M = (given, mutants, way, chunks, prompt, explain, decoys) => ({ type: 'build', goal: 'tests', given, mutants, way, chunks: [...CHIPS, ...chunks.map(ended)], prompt, explain, ...(decoys && { decoys: decoys.map(ended) }) });
const F = (given, mutants, code, fill, prompt, explain, decoys) => ({ type: 'gap', goal: 'tests', given, mutants, code, fill, prompt, explain, ...(decoys && { decoys }) });
const broken = (says, code) => ({ says, code });

const add = 'function add(a: number, b: number): number { return a + b; }';
const addBroken = [broken('it multiplies instead of adding.', 'function add(a: number, b: number): number { return a * b; }'), broken('it ignores b.', 'function add(a: number, b: number): number { return a; }')];
const dbl = 'function dbl(n: number): number { return n * 2; }';
const dblBroken = [broken('it adds 2 instead of doubling.', 'function dbl(n: number): number { return n + 2; }')];
const isAdult = 'function isAdult(age: number): boolean { return age >= 18; }';
const adultBroken = [broken('it says 18 is too young: > instead of >=.', 'function isAdult(age: number): boolean { return age > 18; }'), broken('it says yes to everyone.', 'function isAdult(age: number): boolean { return true; }')];
const last = 'function last(xs: number[]): number | undefined { return xs[xs.length - 1]; }';
const lastBroken = [broken('it gives the first one, not the last.', 'function last(xs: number[]): number | undefined { return xs[0]; }')];
const total = 'function total(xs: number[]): number { let t = 0; for (const x of xs) { t += x; } return t; }';
const totalBroken = [broken('it skips the first number.', 'function total(xs: number[]): number { let t = 0; for (let i = 1; i < xs.length; i++) { t += xs[i]; } return t; }'), broken('it starts from 1, not 0.', 'function total(xs: number[]): number { let t = 1; for (const x of xs) { t += x; } return t; }')];
const evens = 'function evens(xs: number[]): number[] { return xs.filter((x) => x % 2 === 0); }';
const evensBroken = [broken('it keeps the odd ones instead.', 'function evens(xs: number[]): number[] { return xs.filter((x) => x % 2 === 1); }'), broken('it hands back everything.', 'function evens(xs: number[]): number[] { return xs; }')];
const shout = 'function shout(w: string): string { return w.toUpperCase() + "!"; }';
const shoutBroken = [broken('it leaves off the !.', 'function shout(w: string): string { return w.toUpperCase(); }'), broken('it keeps small letters.', 'function shout(w: string): string { return w + "!"; }')];
const pos = 'function pos(n: number): number { if (n < 0) { throw new Error("negative"); } return n; }';
const posBroken = [broken('it never objects to a negative number.', 'function pos(n: number): number { return n; }'), broken('it objects to everything, even a good number.', 'function pos(n: number): number { throw new Error("negative"); }')];
const pet = 'interface Pet { name: string; age: number; } function older(p: Pet): Pet { return { name: p.name, age: p.age + 1 }; }';
const petBroken = [broken('it wipes the name.', 'interface Pet { name: string; age: number; } function older(p: Pet): Pet { return { name: "", age: p.age + 1 }; }'), broken('it makes them younger.', 'interface Pet { name: string; age: number; } function older(p: Pet): Pet { return { name: p.name, age: p.age - 1 }; }')];
const grade = 'function band(n: number): string { if (n >= 80) { return "high"; } if (n >= 50) { return "mid"; } return "low"; }';
const gradeBroken = [broken('80 lands in mid: > instead of >=.', 'function band(n: number): string { if (n > 80) { return "high"; } if (n >= 50) { return "mid"; } return "low"; }'), broken('50 lands in low: > instead of >=.', 'function band(n: number): string { if (n >= 80) { return "high"; } if (n > 50) { return "mid"; } return "low"; }'), broken('it never says low.', 'function band(n: number): string { if (n >= 80) { return "high"; } return "mid"; }')];

const course = {
  id: 'testing',
  title: 'Test writing',
  units: [
    unit('Your first test',
      lesson('tt-1', 'Check an answer', [
        T('A test is code that checks code. It calls a function with values you pick, and says what should come back. test gives it a name.', `${add} test("adds", () => { expect(add(2, 3)).toBe(5); });`),
        T('Here is how I grade you: your test must pass on the real code above it, and then fail on faulty copies I made. If a faulty copy gets through, your test missed it.', `${dbl} test("doubles", () => { expect(dbl(3)).toBe(6); });`),
        F(add, addBroken, 'test("adds", () => { expect(add(2, 3)).toBe(___); });', ['5'], 'What should add(2, 3) give?', 'Right on the real code, and it catches both faulty copies.', ['6', '23']),
        F(dbl, dblBroken, 'test("doubles", () => { expect(dbl(3)).___(6); });', ['toBe'], 'Which word compares the answer?', 'expect(...).toBe(...) is the whole shape.', ['expect', 'test']),
        F(dbl, dblBroken, 'test("doubles", () => { expect(___(3)).toBe(6); });', ['dbl'], 'What is being tested?', 'expect holds the call you are checking.', ['add', 'test']),
        F(add, addBroken, 'test("adds", () => { ___(add(2, 3)).toBe(5); });', ['expect'], 'Which word starts the check?', 'expect takes what came back.', ['test', 'console.log']),
        Q('console.log(2 + 3 === 5);', ['false', '5'], 'At heart a test is only this: a comparison that must be true.'),
        M(add, addBroken, 'test("adds", () => { expect(add(2, 3)).toBe(5); });', ['expect(add(2, 3))', '.toBe(5)'], 'Build the whole test from its pieces.', 'A name, an arrow, and one check inside.', ['.toBe(6)']),
      ]),
      lesson('tt-2', 'Why it fails', [
        T('A test that is wrong fails on the real code. Then the test needs fixing, not the code.', `${dbl} test("doubles", () => { expect(dbl(4)).toBe(8); });`),
        T('A test with no expect checks nothing. Passing does not make it useful.', `${dbl} test("doubles", () => { expect(dbl(1)).toBe(2); });`),
        F(dbl, dblBroken, 'test("doubles", () => { expect(dbl(4)).toBe(___); });', ['8'], 'What should dbl(4) give?', 'Work it out from what the function is for.', ['6', '4']),
        F(shout, shoutBroken, 'test("shouts", () => { expect(shout("hi")).toBe(___); });', ['"HI!"'], 'What should shout("hi") give?', 'Capitals and a !. Both faulty copies are caught.', ['"hi!"', '"HI"']),
        F(isAdult, adultBroken.slice(0, 1), 'test("adult", () => { expect(isAdult(18)).toBe(___); });', ['true'], 'Is 18 an adult here?', 'The code says >= 18, so 18 counts.', ['false']),
        F(add, addBroken, 'test("adds", () => { expect(add(1, 4)).___(5); });', ['toBe'], 'Fill in the check.', 'Same shape, new numbers.', ['add']),
        M(shout, shoutBroken, 'test("shouts", () => { expect(shout("ok")).toBe("OK!"); });', ['expect(shout("ok"))', '.toBe("OK!")'], 'Build the whole test.', 'One check is enough when it pins down both things.', ['.toBe("ok!")', '.toBe("OK")']),
        M(dbl, dblBroken, 'test("doubles", () => { expect(dbl(5)).toBe(10); });', ['expect(dbl(5))', '.toBe(10)'], 'Build a test for dbl.', 'Name it for what it should do.', ['.toBe(7)']),
      ]),
    ),
    unit('Catching bugs',
      lesson('tb-1', 'Pick good values', [
        T('Some values hide bugs. add(2, 2) gives 4 whether it adds or multiplies! A good test uses values where the wrong code gives a different answer.', `${add} test("adds", () => { expect(add(2, 3)).toBe(5); });`),
        T('dbl(2) is 4, and so is 2 + 2. Pick values that tell the real code from the faulty one.', `${dbl} test("doubles", () => { expect(dbl(5)).toBe(10); });`),
        F(add, addBroken, 'test("adds", () => { ___; });', ['expect(add(2, 3)).toBe(5)'], 'Which check catches the faulty copies?', '2 and 2 would pass on a version that multiplies.', ['expect(add(2, 2)).toBe(4)', 'expect(add(0, 0)).toBe(0)']),
        F(dbl, dblBroken, 'test("doubles", () => { ___; });', ['expect(dbl(5)).toBe(10)'], 'Which check tells doubling from adding 2?', 'At 2 they agree. At 5 they do not.', ['expect(dbl(2)).toBe(4)']),
        F(add, addBroken, 'test("adds", () => { ___; });', ['expect(add(3, 4)).toBe(7)'], 'Which one catches them all?', 'With 0 for b, a version that ignores b looks right.', ['expect(add(3, 0)).toBe(3)', 'expect(add(2, 2)).toBe(4)']),
        F(shout, shoutBroken, 'test("shouts", () => { ___; });', ['expect(shout("a")).toBe("A!")'], 'Which one catches small letters?', 'Text with no letters to change hides that bug.', ['expect(shout("1")).toBe("1!")']),
        F(total, totalBroken, 'test("totals", () => { ___; });', ['expect(total([4, 5])).toBe(9)'], 'Which one catches them both?', 'An empty list or a 0 in front hides the bugs.', ['expect(total([0, 5])).toBe(5)']),
        M(add, addBroken, 'test("adds", () => { expect(add(5, 6)).toBe(11); });', ['expect(add(5, 6))', 'expect(add(2, 2))', '.toBe(11)', '.toBe(4)'], 'Build a test that catches both copies. Choose the values with care.', '5 and 6 give a different answer for each faulty copy.'),
      ]),
      lesson('tb-2', 'More than one test', [
        T('One test is often not enough. Each test checks one fact, and together they pin the code down. The name says which fact.', `${isAdult} test("18 is an adult", () => { expect(isAdult(18)).toBe(true); }); test("17 is not", () => { expect(isAdult(17)).toBe(false); });`),
        T('A faulty copy only has to fail one test to be caught.', `${grade} test("high", () => { expect(band(90)).toBe("high"); });`),
        F(isAdult, adultBroken, 'test("18 is an adult", () => { ___; }); test("17 is not", () => { ___; });', ['expect(isAdult(18)).toBe(true)', 'expect(isAdult(17)).toBe(false)'], 'Fill both, one for each side of the line.', 'Together they catch "says yes to everyone" and the > mistake.', ['expect(isAdult(30)).toBe(true)']),
        M(isAdult, adultBroken, 'test("yes", () => { expect(isAdult(18)).toBe(true); }); test("no", () => { expect(isAdult(5)).toBe(false); });', ['expect(isAdult(18))', 'expect(isAdult(5))', '.toBe(true)', '.toBe(false)', '"yes"', '"no"'], 'Build two tests that catch both faulty copies.', 'Right at the line, and well under it.'),
        F(total, totalBroken, 'test("empty", () => { expect(total([])).toBe(0); }); test("more", () => { ___; });', ['expect(total([2, 2])).toBe(4)'], 'Add the second fact.', 'The first alone would let "skips the first number" through.', ['expect(total([])).toBe(0)']),
        F(grade, gradeBroken, 'test("a", () => { expect(band(80)).toBe("high"); }); test("b", () => { expect(band(50)).toBe("mid"); }); test("c", () => { ___; });', ['expect(band(10)).toBe("low")'], 'Two line-edges are covered. What is left?', 'Each road through the code needs a test.', ['expect(band(90)).toBe("high")']),
        M(grade, gradeBroken, 'test("a", () => { expect(band(80)).toBe("high"); expect(band(50)).toBe("mid"); expect(band(1)).toBe("low"); });', ['expect(band(80))', 'expect(band(50))', 'expect(band(1))', '.toBe("high")', '.toBe("mid")', '.toBe("low")', 'expect(band(70))'], 'Catch all three with one test. A test can hold several checks.', 'The edges are where these bugs live.'),
        F(add, addBroken, 'test("adds", () => { expect(add(1, 2)).toBe(3); ___; });', ['expect(add(4, 5)).toBe(9)'], 'Add one more check to this test.', 'Two facts, one test. Any right one will do here.', ['expect(add(4, 5)).toBe(1)']),
      ]),
    ),
    unit('Edges',
      lesson('te-1', 'Right at the line', [
        T('Bugs gather at edges. If code says >= 18, test exactly 18, and just under it.', `${isAdult} test("edge", () => { expect(isAdult(18)).toBe(true); });`),
        T('Empty lists, zero and one item are edges too. Nothing to add up should still give an answer.', `${total} test("empty", () => { expect(total([])).toBe(0); });`),
        F(isAdult, adultBroken.slice(0, 1), 'test("edge", () => { expect(isAdult(___)).toBe(true); });', ['18'], 'Which age catches > instead of >=?', 'Only 18 itself tells them apart.', ['19', '40']),
        F(total, totalBroken.slice(1), 'test("empty", () => { expect(total([])).toBe(___); });', ['0'], 'What should nothing add up to?', 'A version starting from 1 gets this wrong.', ['1']),
        F(grade, gradeBroken.slice(0, 1), 'test("edge", () => { expect(band(___)).toBe("high"); });', ['80'], 'Which score tests the top line?', 'Exactly on the line.', ['81', '95']),
        F(grade, gradeBroken.slice(1, 2), 'test("edge", () => { expect(band(___)).toBe("mid"); });', ['50'], 'Which score tests the lower line?', 'Exactly on the line again.', ['51', '60']),
        F(last, lastBroken, 'test("last", () => { expect(last([1, 2])).toBe(___); });', ['2'], 'What should last([1, 2]) give?', 'With one item, first and last are the same, so that hides the bug.', ['1']),
        F(last, lastBroken, 'test("last", () => { ___; });', ['expect(last([3, 4])).toBe(4)'], 'Which check catches it?', 'One item hides it.', ['expect(last([3])).toBe(3)']),
        M(total, totalBroken, 'test("empty", () => { expect(total([])).toBe(0); }); test("two", () => { expect(total([3, 4])).toBe(7); });', ['expect(total([]))', 'expect(total([3, 4]))', '.toBe(0)', '.toBe(7)', '"empty"', '"two"'], 'Build one test for an empty list, and one for two items.', 'Between them, they catch both copies.'),
      ]),
    ),
    unit('Lists and objects',
      lesson('tl-1', 'toEqual', [
        T('toBe asks "the very same thing?" Two lists with the same insides are still two lists. toEqual compares what is inside.', `${evens} test("evens", () => { expect(evens([1, 2])).toEqual([2]); });`),
        T('toContain asks if a list holds something, when the rest does not matter.', `${evens} test("has", () => { expect(evens([2, 4])).toContain(4); });`),
        F(evens, evensBroken, 'test("evens", () => { expect(evens([1, 2])).___([2]); });', ['toEqual'], 'Which word compares a list\'s insides?', 'toBe would fail even on right code: they are two different lists.', ['toBe']),
        F(evens, evensBroken, 'test("evens", () => { expect(evens([3, 4])).toEqual(___); });', ['[4]'], 'What should come back?', 'The even one, in a list.', ['[3]', '[3, 4]']),
        F(evens, evensBroken.slice(0, 1), 'test("has", () => { expect(evens([2, 3])).___(2); });', ['toContain'], 'Which word asks if it is in there?', 'Good when only one thing matters.', ['toBe', 'toEqual']),
        F(pet, petBroken, 'test("older", () => { expect(older({ name: "a", age: 1 })).toEqual(___); });', ['{ name: "a", age: 2 }'], 'What should come back?', 'Objects compare part by part. Both copies are caught.', ['{ name: "", age: 2 }', '{ name: "a", age: 0 }']),
        F(pet, petBroken.slice(1), 'test("age", () => { expect(older({ name: "a", age: 1 }).___).toBe(2); });', ['age'], 'Check only the age part.', 'A dot reaches in, and toBe compares that number.', ['name']),
        M(evens, evensBroken, 'test("evens", () => { expect(evens([1, 2])).toEqual([2]); });', ['expect(evens([1, 2]))', '.toEqual([2])', '.toBe([2])'], 'Build the test for evens.', '.toBe would fail on the real code here.'),
      ]),
      lesson('tl-2', 'Whole shapes', [
        T('A wide check like toEqual catches anything that changes. A narrow one says just which fact you care about. Both have their uses.', `${pet} test("whole", () => { expect(older({ name: "a", age: 1 })).toEqual({ name: "a", age: 2 }); });`),
        T('Typed values help: the checker stops a test using the wrong shape before it runs.', `${pet} const p: Pet = { name: "a", age: 1 }; test("name", () => { expect(older(p).name).toBe("a"); });`),
        F(pet, petBroken.slice(0, 1), 'test("name", () => { expect(older({ name: "b", age: 1 }).name).toBe(___); });', ['"b"'], 'The name should stay what?', 'Catches the copy that wipes it.', ['""']),
        F(pet, petBroken, 'const p: ___ = { name: "c", age: 2 }; test("older", () => { expect(older(p)).toEqual({ name: "c", age: 3 }); });', ['Pet'], 'Label the test\'s value.', 'The interface is in the code above.', ['string', 'number']),
        F(pet, petBroken, 'const p: Pet = { name: "c", age: ___ }; test("older", () => { expect(older(p)).toEqual({ name: "c", age: 6 }); });', ['5'], 'Which starting age gives 6?', 'One younger than the answer.', ['6', '7']),
        M(pet, petBroken, 'test("older", () => { expect(older({ name: "a", age: 1 })).toEqual({ name: "a", age: 2 }); });', ['expect(older({ name: "a", age: 1 }))', '.toEqual({ name: "a", age: 2 })', '.toEqual({ name: "", age: 2 })'], 'Build a test catching both copies.', 'A whole shape checks every part at once.'),
        F(total, totalBroken, 'const xs: number[] = ___; test("t", () => { expect(total(xs)).toBe(5); });', ['[2, 3]'], 'Which list adds up to 5?', 'A labelled list, then the check. A 0 in front would hide the skipped number.', ['[0, 5]', '[1, 1]']),
        Q('console.log([1] === [1]);', ['true', '[1]'], 'Two separate lists are not the same list, which is why toEqual exists.', { fixed: true }),
      ]),
    ),
    unit('Errors',
      lesson('tx-1', 'Expecting a stop', [
        T('Sometimes the right thing is to refuse. throw stops the code with an error. toThrow checks that it happens.', `${pos} test("refuses", () => { expect(() => pos(-1)).toThrow(); });`),
        T('Note the arrow: expect gets a plan to run, not the answer. Called straight, the error would stop your test before expect ever saw it.', `${pos} test("fine", () => { expect(pos(2)).toBe(2); });`),
        F(pos, posBroken.slice(0, 1), 'test("refuses", () => { expect(() => pos(___)).toThrow(); });', ['-1'], 'Which value should it refuse?', 'A negative one.', ['1', '0'], ),
        F(pos, posBroken.slice(0, 1), 'test("refuses", () => { expect(() => pos(-5)).___(); });', ['toThrow'], 'Which word checks for the stop?', 'toThrow runs the plan and watches.', ['toBe']),
        F(pos, posBroken.slice(0, 1), 'test("refuses", () => { expect(___).toThrow(); });', ['() => pos(-1)'], 'What goes to expect?', 'A plan, not a call.', ['pos(-1)', 'pos']),
        F(pos, posBroken.slice(1), 'test("fine", () => { expect(pos(___)).toBe(3); });', ['3'], 'Now check it still works on a good number.', 'Refusing everything must not pass.', ['4']),
        F(pos, posBroken, 'test("no", () => { expect(() => pos(-1)).toThrow(); }); test("yes", () => { ___; });', ['expect(pos(4)).toBe(4)'], 'One test refuses. Add one for a good number.', 'Both sides are needed to catch both copies.', ['expect(() => pos(-4)).toThrow()']),
        M(pos, posBroken, 'test("no", () => { expect(() => pos(-1)).toThrow(); }); test("yes", () => { expect(pos(1)).toBe(1); });', ['expect(() => pos(-1))', 'expect(pos(1))', '.toThrow()', '.toBe(1)', '"no"', '"yes"'], 'Build both tests.', 'That is a full test of a guard.'),
      ]),
    ),
    unit('A full suite',
      lesson('ts-1', 'Cover it all', [
        T('You have the whole kit now. For any function: the usual case, each edge, each road through the code. Then the faulty copies have nowhere to hide.', `${grade} test("low", () => { expect(band(1)).toBe("low"); });`),
        T('Read the code, list its roads, then write one check for each.', `${total} test("two", () => { expect(total([1, 2])).toBe(3); });`),
        M(grade, gradeBroken, 'test("roads", () => { expect(band(80)).toBe("high"); expect(band(50)).toBe("mid"); expect(band(0)).toBe("low"); });', ['expect(band(80)).toBe("high");', 'expect(band(50)).toBe("mid");', 'expect(band(0)).toBe("low");', 'expect(band(70)).toBe("mid");'], 'Three roads, one check for each.', 'Edges for the first two, anything for the last.'),
        M(total, totalBroken, 'test("sum", () => { expect(total([2, 3])).toBe(5); });', ['expect(total([2, 3]))', '.toBe(5)', 'expect(total([0]))', '.toBe(0)'], 'One test can catch both. Choose carefully.', 'A first number that matters, and a start that shows.'),
        M(isAdult, adultBroken, 'test("adult", () => { expect(isAdult(18)).toBe(true); expect(isAdult(17)).toBe(false); });', ['expect(isAdult(18))', 'expect(isAdult(17))', '.toBe(true)', '.toBe(false)'], 'Both sides of the line, in one test.', 'The tightest pair there is.'),
        M(shout, shoutBroken, 'test("shout", () => { expect(shout("a")).toBe("A!"); });', ['expect(shout("a"))', 'expect(shout("!"))', '.toBe("A!")', '.toBe("!!")'], 'Catch both copies with one check.', 'A letter to change, and the ! on the end.'),
        M(last, lastBroken, 'test("last", () => { expect(last([1, 2])).toBe(2); });', ['expect(last([1, 2]))', 'expect(last([1]))', '.toBe(2)', '.toBe(1)'], 'Catch the copy that gives the first one.', 'Two items at least, and different ones.'),
        M(evens, evensBroken, 'test("evens", () => { expect(evens([1, 2])).toEqual([2]); });', ['expect(evens([1, 2]))', 'expect(evens([2]))', '.toEqual([2])', '.toEqual([1])'], 'One list holding both kinds.', 'Then it must keep one and drop the other.'),
      ]),
      lesson('ts-2', 'Read and judge', [
        T('Last lesson: tests themselves can be weak. Passing tells you only what they checked.', `${add} test("weak", () => { expect(add(2, 2)).toBe(4); });`),
        T('When a faulty copy gets through, I will tell you which. Read that as the bug your tests would have let ship, and add the check.', `${add} test("strong", () => { expect(add(2, 3)).toBe(5); });`),
        F(add, addBroken, 'test("a", () => { expect(add(2, 2)).toBe(4); }); test("b", () => { ___; });', ['expect(add(1, 5)).toBe(6)'], 'The first test is weak. Add what it lets through.', '1 and 5 tell adding from multiplying.', ['expect(add(2, 2)).toBe(5)']),
        F(total, totalBroken, 'test("a", () => { expect(total([])).toBe(0); }); test("b", () => { ___; });', ['expect(total([6, 1])).toBe(7)'], 'What does an empty list miss?', 'It says nothing about the first number being skipped.', ['expect(total([])).toBe(1)']),
        F(pos, posBroken, 'test("a", () => { expect(pos(2)).toBe(2); }); test("b", () => { ___; });', ['expect(() => pos(-2)).toThrow()'], 'Which fact is not checked yet?', 'The refusing road.', ['expect(pos(3)).toBe(3)']),
        F(isAdult, adultBroken, 'test("a", () => { expect(isAdult(40)).toBe(true); }); test("b", () => { expect(isAdult(1)).toBe(false); }); test("c", () => { ___; });', ['expect(isAdult(18)).toBe(true)'], 'Which check is still missing?', 'Exactly on the line.', ['expect(isAdult(50)).toBe(true)']),
        F(evens, evensBroken, 'test("a", () => { expect(evens([])).toEqual([]); }); test("b", () => { ___; });', ['expect(evens([1, 2])).toEqual([2])'], 'Empty passes on every copy. Add a real one.', 'A mixed list tells all of them apart.', ['expect(evens([])).toEqual([])']),
        M(dbl, dblBroken, 'test("dbl", () => { expect(dbl(7)).toBe(14); });', ['expect(dbl(7))', 'expect(dbl(2))', '.toBe(14)', '.toBe(4)'], 'One last one: catch the copy that adds 2.', 'Anything but 2 tells them apart.'),
      ]),
    ),
  ],
};

course.units.forEach((u) => u.lessons.forEach((l) => { l.items = l.items.map((i) => ({ ...i, ts: true })); }));
export default coarsened(course, AFTER_JS);
