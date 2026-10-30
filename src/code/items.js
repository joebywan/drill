import { ParseError, RunError, Stop, parse, run, same, show, tokenize } from './interp.js';
import { check } from './types.js';
import { STEPS, mirrored, parse as parseLevel, reached, run as walkLevel } from '../coding/program.js';
import { shuffle } from '../quiz/items.js';

/**
 * The code courses' items, pure: JavaScript, TypeScript and test-writing all use these. The learner
 * places word chips, and what they made is RUN. Nothing compares it to a stored answer: any arrangement
 * that does the job is right, and `way` is one that does, shown after a miss and proving it can be done.
 * Code is written as one source string; chips and formatting are worked out from it.
 *
 *   teach   { text, code?, level?, ts? }            a card: `code` is shown and, if it prints, what it prints
 *   build   { goal, way, decoys?, chunks?, prompt, explain }   place chips from nothing, then Run
 *   gap     { goal, code, fill, decoys?, prompt, explain }     `code` has `___` holes, `fill` one filling that works
 *   predict { code, wrong, prompt?, explain }       what does this print? `wrong` are the other answers
 *           { code, asks: 'check', ts: true, ... }  which line does the type checker flag, if any?
 *
 * Goals, each graded by running (`grade`):
 *   'print'    prints what `way` prints
 *   'walk'     Fennel reaches the flower on `level`, on the same grid and rules as Coding, through
 *              right() left() up() down() rock("right") flower() and the callbacks onRock(f) onStep(f)
 *   'returns'  the function `name` gives the right value for each of `cases`, [[args, want], ...], hidden
 *   'tests'    the learner's tests pass on `given`, the real code, and fail on every one of `mutants`,
 *              [{ code, says }], hand-made faulty versions: `says` is what is wrong with it, in plain words
 * `given` is code already written, shown above the answer and run before it. `ts: true` parses type
 * annotations and runs the checker (types.js) first, so a type error is a miss. `level` may go with
 * 'print', for callbacks that report as Fennel walks. In prose, `{out}` is what the code prints.
 */
export const WALK_API = ['right', 'left', 'up', 'down', 'rock', 'flower', 'onRock', 'onStep'];
const TEST_API = ['test', 'expect'];
const WORDS = new Set([...WALK_API, ...TEST_API, 'console', 'Math', 'undefined', 'Error', 'number', 'string', 'boolean', 'void', 'any', 'type', 'interface', 'length']);

// ---- chips and layout

const STUCK = /^(console|Math)$/; // these read as one word with what follows the dot
/**
 * Source to the words on its chips. A string is one chip, `.name` is one chip, `console.log` is one,
 * and each of `chunks` (source text) stays whole, for items whose chips are bigger than a token.
 */
export function chipsOf(src, chunks = []) {
  const toks = tokenize(src).slice(0, -1);
  const big = chunks.map((c) => ({ text: c, raws: tokenize(c).slice(0, -1).map((t) => t.raw) }));
  const out = [];
  for (let i = 0; i < toks.length;) {
    const hit = big.filter((b) => b.raws.every((r, j) => toks[i + j]?.raw === r)).sort((a, b) => b.raws.length - a.raws.length)[0];
    if (hit) { out.push(hit.text); i += hit.raws.length; continue; }
    if (toks[i].raw === '.' && toks[i + 1]?.t === 'id') { out.push(`.${toks[i + 1].raw}`); i += 2; continue; }
    if (STUCK.test(toks[i].raw) && toks[i + 1]?.raw === '.') { out.push(`${toks[i].raw}.${toks[i + 2]?.raw ?? ''}`); i += 3; continue; }
    out.push(toks[i].raw);
    i++;
  }
  return out;
}

/** An object or inline type follows these; any other `{` opens a block of statements. */
const opensBlock = (words, i) => words[i] !== '{' || !/([=(,[:?&|]|return)$/.test(words[i - 1] ?? '') || (words[i - 1] ?? '').endsWith('=>');

/** Which words start a new line: the indent for each that does, else undefined (builder's `breaks`). */
export function layout(words) {
  const out = [];
  const stack = [];
  let indent = 0, parens = 0, next = false;
  words.forEach((w, i) => {
    let fresh = next;
    let closedBlock = false;
    next = false;
    if (w[0] === '}') {
      const top = stack.pop();
      if (top?.block) { indent--; parens = top.parens; fresh = true; closedBlock = true; }
    }
    if (/^else\b/.test(w) || /^[),;.]/.test(w)) fresh = false;
    out.push(fresh && i ? indent : undefined);
    for (const c of w) { if (c === '(') parens++; if (c === ')') parens--; }
    if (w.endsWith('{')) {
      const block = opensBlock(words, i);
      stack.push({ block, parens });
      if (block) { indent++; parens = 0; next = true; }
    } else if (w === '}') next = closedBlock;
    else if (w.endsWith(';') && parens <= 0 && stack.at(-1)?.block !== false) next = true;
  });
  return out;
}

/** Words joined the way a person writes code, with a new line wherever `breaks` says. */
function joined(words, breaks = []) {
  const generic = (i) => (words[i] === '<' && words[i + 2] === '>') || (words[i - 1] === '<' && words[i + 1] === '>') || (words[i] === '>' && words[i - 2] === '<');
  const tight = (w, prev, i) => w[0] === '.' || prev === '.' || prev === '(' || prev === '[' || prev === '!' || [';', ',', ')', ']', '++', '--', ':'].includes(w) || generic(i)
    || ((w === '(' || w === '[') && /[\w$\])]$/.test(prev) && !/^(if|for|while|return|of|function)$/.test(prev))
    || (w === '(' && prev === '>' && words[i - 3] === '<')
    || (w === '?' && words[i + 1] === ':');
  let text = '';
  words.forEach((w, i) => {
    if (breaks[i] !== undefined) text += `\n${'  '.repeat(breaks[i])}`;
    else if (i && !tight(w, words[i - 1], i)) text += ' ';
    text += w;
  });
  return text;
}

/** Source laid out as lines of code, the way a person would write it. */
export function pretty(src) {
  if (!src) return '';
  const words = chipsOf(src);
  return joined(words, layout(words));
}

/**
 * Chips at the level of thought. A construct's first build has its syntax in single tokens; once built,
 * its boilerplate is one chip and only the parts with the idea in them stay apart, as a language
 * course's word bank has "I would like" as one tile. `key` is the construct, and a `whole` rule swallows a
 * value, so it stands down when a decoy could go there: a decoy must always have a place to be tried.
 */
const LIT = ['NUM', 'STR', 'true', 'false'];
const VAL = ['ID', ...LIT];
const OP = ['+', '-', '*', '/', '%', '<', '>', '<=', '>=', '===', '!==', '&&', '||'];
const RULES = [
  { key: 'test', pat: ['test', '(', 'STR', ',', '(', ')', '=>', '{'] },
  { key: 'for', pat: ['for', '(', 'let', 'ID', '=', 'NUM', ';', 'ID', ['<', '<=', '>', '>=']] },
  { key: 'for', pat: [';', 'ID', ['++', '--'], ')', '{'] },
  { key: 'for', pat: [';', 'ID', '+=', 'NUM', ')', '{'] },
  { key: 'forof', pat: ['for', '(', 'const', 'ID', 'of'] },
  { key: 'else', pat: ['}', 'else', 'if', '('] },
  { key: 'else', pat: ['}', 'else', '{'] },
  { key: 'if', pat: ['if', '('] },
  { key: 'while', pat: ['while', '('] },
  { key: 'print', whole: true, pat: ['console', '.', 'log', '(', VAL, ')', ';'] },
  { key: 'print', pat: ['console', '.', 'log', '('] },
  { key: 'print', pat: ['Math', '.', 'ID', '('] },
  { key: 'let', whole: true, pat: [['let', 'const'], 'ID', '=', VAL, ';'] },
  { key: 'let', pat: [['let', 'const'], 'ID', '='] },
  { key: 'change', whole: true, ops: true, pat: ['ID', ['=', '+='], VAL, OP, VAL, ';'] },
  { key: 'change', whole: true, ops: true, pat: ['ID', ['=', '+=', '-='], VAL, ';'] },
  { key: 'change', ops: true, pat: ['ID', ['++', '--'], ';'] },
  { key: 'return', whole: true, ops: true, pat: ['return', VAL, OP, VAL, ';'] },
  { key: 'return', whole: true, pat: ['return', VAL, ';'] },
  { key: 'expr', whole: true, ops: true, pat: [VAL, OP, VAL], unless: OP },
  { key: 'call', whole: true, pat: ['ID', '(', VAL, ')', ';'] },
  { key: 'call', whole: true, pat: ['ID', '(', VAL, ')'], unless: [';'] },
  { key: 'if', pat: ['!', 'ID', '(', ')'] },
  { key: 'if', pat: ['!', 'ID', '(', 'STR', ')'] },
  { key: 'call', pat: ['ID', '(', ')'], unless: [';'] },
  { key: 'member', pat: ['ID', '.', 'ID'], unless: ['('] },
  { key: 'label', pat: ['let', 'ID', ':'] },
  { key: 'label', pat: ['=', VAL, ';'] },
  { key: 'label', pat: [',', 'ID', ':'] },
  { key: 'label', pat: ['interface', 'ID', '{'] },
  { key: 'function', pat: ['function', 'ID', '('] },
  { key: 'arrow', pat: ['(', ')', '=>', '{'] },
  { key: 'arrow', pat: ['(', 'ID', ')', '=>', '{'] },
  { key: 'arrow', pat: ['(', 'ID', ',', 'ID', ')', '=>', '{'] },
  { key: 'arrow', pat: ['ID', '=>', '{'] },
  { key: 'arrow', pat: ['ID', '=>'] },
  { key: 'arrow', pat: ['}', ')', ';'] },
  { key: 'call', pat: ['ID', '(', ')', ';'] },
  { key: 'method', pat: ['.', 'ID', '('] },
  { key: 'call', pat: ['ID', '('] },
  { key: 'call', pat: [')', ';'] },
  { key: 'if', pat: [')', '{'] },
  { key: 'label', pat: ['ID', ':'] },
];
const fits1 = (tok, want) => {
  if (Array.isArray(want)) return want.some((w) => fits1(tok, w));
  if (want === 'ID') return tok?.t === 'id';
  if (want === 'NUM') return tok?.t === 'num';
  if (want === 'STR') return tok?.t === 'str';
  return tok?.raw === want;
};
/** A list of plain values, or an object of them, or a function's head: how many tokens, or 0. */
function bracketed(toks, i) {
  if (toks[i]?.raw === 'function' && toks[i + 1]?.t === 'id' && toks[i + 2]?.raw === '(') {
    let j = i + 3;
    while (toks[j]?.t === 'id' && (toks[j + 1]?.raw === ',' || toks[j + 1]?.raw === ')')) j += toks[j + 1].raw === ',' ? 2 : 1;
    return toks[j]?.raw === ')' && toks[j + 1]?.raw === '{' ? { key: 'function', n: j + 2 - i } : null;
  }
  if (toks[i]?.raw === '[') {
    let j = i + 1;
    while (fits1(toks[j], LIT) && toks[j + 1]?.raw === ',') j += 2;
    return fits1(toks[j], LIT) && toks[j + 1]?.raw === ']' ? { key: 'array', lits: true, n: j + 2 - i } : null;
  }
  if (toks[i]?.raw === '{' && /^(=|\(|,|return)$/.test(toks[i - 1]?.raw ?? '')) {
    let j = i + 1;
    while (toks[j]?.t === 'id' && toks[j + 1]?.raw === ':' && fits1(toks[j + 2], LIT) && toks[j + 3]?.raw === ',') j += 4;
    return toks[j]?.t === 'id' && toks[j + 1]?.raw === ':' && fits1(toks[j + 2], LIT) && toks[j + 3]?.raw === '}' ? { key: 'object', lits: true, n: j + 4 - i } : null;
  }
  return null;
}
const ruleAt = (toks, i) => [
  bracketed(toks, i),
  ...RULES.filter((r) => r.pat.every((w, k) => fits1(toks[i + k], w)) && !(r.unless && fits1(toks[i + r.pat.length], r.unless))).map((r) => ({ ...r, n: r.pat.length })),
].filter(Boolean);

/** The chunks `src` is built from, given the constructs already `known`, and every construct it uses. */
export function chunksFor(src, known, decoys = []) {
  const toks = tokenize(src).slice(0, -1);
  const valued = decoys.some((d) => { const t = tokenize(d).slice(0, -1); return t.length === 1 && ['num', 'str', 'id'].includes(t[0].t); });
  const litDecoy = decoys.some((d) => { const t = tokenize(d).slice(0, -1); return t.length === 1 && ['num', 'str'].includes(t[0].t); });
  const opDecoy = decoys.some((d) => { const t = tokenize(d).slice(0, -1); return t.length === 1 && t[0].t === 'op'; });
  const chunks = [];
  const used = new Set();
  for (let i = 0; i < toks.length;) {
    const hits = ruleAt(toks, i);
    hits.forEach((h) => used.add(h.key));
    const hit = hits.find((h) => known.has(h.key) && !(h.whole && valued) && !(h.lits && litDecoy) && !(h.ops && opDecoy));
    if (!hit) { i++; continue; }
    chunks.push(joined(toks.slice(i, i + hit.n).map((t) => t.raw)));
    i += hit.n;
  }
  return { chunks: [...new Set(chunks)], used };
}

/** Every construct a chunk rule knows. */
export const CONSTRUCTS = [...new Set(RULES.map((r) => r.key)), 'function', 'array', 'object'];

/** How many taps a build item takes, placed the way `way` is. */
export const tapsOf = (item) => chipsOf(wayOf(item), item.chunks).length;

/** A gap item's fixed text and holes, as a builder `start` tree. */
export function startOf(item) {
  const out = [];
  let run = [];
  const flush = () => { if (run.length) out.push({ text: pretty(run.join(' ')) }); run = []; };
  const toks = tokenize(item.code).slice(0, -1);
  toks.forEach(({ raw }, i) => {
    if (raw === '___') { flush(); out.push({ hole: true }); return; }
    if (raw === '{' || raw === '}') flush();
    run.push(raw);
    if (raw === ';' || raw === '{' || (raw === '}' && ![')', ',', ';'].includes(toks[i + 1]?.raw))) flush();
  });
  flush();
  return out;
}

/** One arrangement that works, as source. */
export const wayOf = (item) => {
  if (item.type !== 'gap') return item.way;
  let i = 0;
  return item.code.replace(/___/g, () => item.fill[i++]);
};

/** What a build or gap item's tray offers, every word once, shuffled. Any may be placed many times. */
export const trayOf = (item, rand) => {
  const need = item.type === 'gap' ? item.fill : chipsOf(item.way, item.chunks);
  return shuffle([...new Set([...need, ...(item.decoys ?? [])])], rand);
};

/** How many chips an answer may hold: room for another valid arrangement, not for ever. */
export const limitOf = (item) => {
  const n = chipsOf(wayOf(item), item.chunks).length;
  return n + Math.max(8, n);
};

// ---- running

/** Fennel's calls for a program, and the steps it took, ready for `walkLevel` to judge and to show. */
function walker(level) {
  const g = parseLevel(level);
  let [x, y] = g.start;
  const steps = [];
  let rockFn = null, stepFn = null, inRock = false;
  return {
    steps,
    globals: ({ call }) => {
      const go = (way) => {
        if (steps.length > 200) throw new RunError('Fennel has walked far enough, so I stopped it.', 1, 'limit');
        const [dx, dy] = STEPS[way];
        if (g.rock(x + dx, y + dy)) {
          if (rockFn && !inRock) {
            inRock = true;
            call(rockFn, []);
            inRock = false;
            return;
          }
          steps.push(way);
          throw new Stop();
        }
        x += dx; y += dy;
        steps.push(way);
        if (stepFn) call(stepFn, [steps.length]);
      };
      const look = (way) => {
        if (!STEPS[way]) throw new RunError(`rock(...) needs "up", "down", "left" or "right", not ${show(way, false)}.`, 1);
        return g.rock(x + STEPS[way][0], y + STEPS[way][1]);
      };
      return {
        right: () => go('right'), left: () => go('left'), up: () => go('up'), down: () => go('down'),
        rock: look,
        flower: () => g.flowers.some(([fx, fy]) => fx === x && fy === y),
        onRock: (f) => { rockFn = f; },
        onStep: (f) => { stepFn = f; },
      };
    },
  };
}

/** `test` and `expect`, for the courses' learners to write tests with. `results` fills up as they run. */
function tester(results) {
  return ({ tryCall }) => {
    let current = null;
    const fail = (message) => { throw new RunError(message, 1); };
    return {
      test: (name, f) => {
        const outer = current;
        const mine = { name: show(name), expects: 0 };
        current = mine;
        const r = tryCall(f, []);
        if (r.error) mine.failed = r.error.message;
        results.push(mine);
        current = outer;
      },
      expect: (got) => {
        if (current) current.expects++;
        const was = (word, want) => `I expected ${word}${show(want, false)}, and got ${show(got, false)}.`;
        return {
          toBe: (want) => { if (!(Object.is(got, want) || got === want)) fail(was('', want)); },
          toEqual: (want) => { if (!same(got, want)) fail(was('', want)); },
          toContain: (want) => {
            const has = Array.isArray(got) ? got.some((x) => same(x, want)) : typeof got === 'string' && got.includes(want);
            if (!has) fail(was('something holding ', want));
          },
          toThrow: () => {
            const r = tryCall(got, []);
            if (!r.error?.thrown) fail(r.error ? r.error.message : 'I expected it to stop with an error, and it finished quietly.');
          },
        };
      },
    };
  };
}

/** A parse and type check of a whole source: a plain-words reason it can't run, or null. */
function refused(item, source) {
  if (!item.ts) return null;
  try {
    const errors = check(parse(source, { ts: true }), { hosts: [...WALK_API, ...TEST_API] });
    return errors[0]?.message ?? null;
  } catch (e) {
    if (e instanceof ParseError) return null; // running it says the same in the same words
    throw e;
  }
}

const withGiven = (item, src, given = item.given) => (given ? `${given}\n${src}` : src);

/** Runs `src` as `item` would, Fennel's calls included: { output, error, steps? }. */
export function runIt(item, src) {
  const w = item.level ? walker(item.level) : null;
  const source = withGiven(item, src);
  const results = [];
  const testing = /\b(test|expect)\(/.test(source) ? tester(results) : null; // a card can show tests running
  const r = run(source, { ts: !!item.ts, globals: w?.globals ?? testing ?? undefined });
  return { ...r, steps: w?.steps, results };
}

/** The walk a program made, for the grid to play: a `run()` result from Coding's rules. */
export const walkOf = (item, steps) => walkLevel(item.level, steps, item.want, true);

const WALK_WHY = {
  bump: 'I walked into a rock.',
  spare: 'I got there, then the plan kept going.',
  short: 'The plan ended before I got there.',
  endless: 'That plan never ends, so I stopped it.',
};

/** What `way` prints. */
const printedBy = (item, src = wayOf(item)) => runIt(item, src).output;

export const answerOf = (item) => printedBy(item, item.code).join('\n');

/** Fill `{out}` with what the code prints. */
export const withOut = (item, text) => (text?.includes('{out}') ? text.replace(/\{out\}/g, printedBy(item, item.type === 'predict' || item.type === 'teach' ? item.code : wayOf(item)).join(', ')) : text);

function gradeTests(item, src) {
  const ask = (given) => {
    const results = [];
    const r = run(withGiven(item, src, given), { ts: !!item.ts, globals: tester(results) });
    return { results, error: r.error };
  };
  const real = ask(item.given);
  if (real.error) return { right: false, why: real.error.message };
  if (!real.results.length) return { right: false, why: 'There is no test here yet: a test starts with test(...).' };
  const empty = real.results.find((t) => !t.expects);
  if (empty) return { right: false, why: `The test "${empty.name}" has no expect in it, so it checks nothing.` };
  const wrong = real.results.find((t) => t.failed);
  if (wrong) return { right: false, why: `The test "${wrong.name}" fails on the real code, so the test is the one that is off. ${wrong.failed}`, results: real.results };
  const caught = item.mutants.map((m) => {
    const r = ask(m.code);
    return { says: m.says, caught: !!r.error || r.results.some((t) => t.failed) };
  });
  const through = caught.filter((c) => !c.caught);
  if (through.length) return { right: false, caught, why: `Your tests pass on the real code, but a faulty version got through: ${through[0].says}` };
  return { right: true, caught, why: `Your tests caught ${caught.length === 1 ? 'the faulty version' : `all ${caught.length} faulty versions`}.` };
}

/**
 * Runs what the learner made and says if it does the job: { right, why, output, walk }. `why` is one
 * plain sentence for a miss (a parse error, the first failing case, the faulty version that got through).
 */
export function grade(item, src) {
  // A function is checked as the hidden tests will call it, so the wrong input label fails too.
  const calls = item.goal === 'returns' ? item.cases.map(([args]) => `${item.name}(${args.map((a) => JSON.stringify(a) ?? 'undefined').join(', ')});`).join('\n') : '';
  const stopped = refused(item, `${withGiven(item, src)}\n${calls}`);
  if (stopped) return { right: false, why: stopped, output: [] };
  if (item.goal === 'tests') return { output: [], ...gradeTests(item, src) };
  const r = runIt(item, src);
  const walk = item.level ? walkOf(item, r.steps) : null;
  if (r.error) return { right: false, why: r.error.message, output: r.output, walk };
  if (item.goal === 'print') {
    const want = printedBy(item);
    const right = same(r.output, want);
    return { right, why: right ? '' : r.output.length ? `That printed ${r.output.join(', ')}.` : 'That printed nothing.', output: r.output, walk };
  }
  if (item.goal === 'walk') return { right: reached(walk), why: reached(walk) ? '' : WALK_WHY[walk.end], output: r.output, walk };
  for (const [args, want] of item.cases) {
    const got = r.call(item.name, args);
    const said = `${item.name}(${args.map((a) => show(a, false)).join(', ')})`;
    if (got.error) return { right: false, why: got.error.message, output: r.output };
    if (!same(got.value, want)) return { right: false, why: `${said} gave ${show(got.value, false)}, and it should give ${show(want, false)}.`, output: r.output };
  }
  return { right: true, why: '', output: r.output };
}

/** The line of a check item the checker flags (as its option), or the option that says it is fine. */
export const FINE = 'No problem';
export const flaggedLine = (item) => {
  const errors = check(parse(pretty(item.code), { ts: true }));
  return errors.length ? `Line ${errors[0].line}` : FINE;
};
/** Every line is on offer, however long the program, so the choices never hint at the answer. */
export const checkOptions = (item) => [...pretty(item.code).split('\n').map((_, i) => `Line ${i + 1}`), FINE];

/** A predict item's answer and options, worked out by running. Numbers get near misses if it needs more. */
export function optionsOf(item) {
  if (item.asks === 'check') return { answer: flaggedLine(item), options: checkOptions(item) };
  const answer = answerOf(item);
  const options = [answer, ...(item.wrong ?? [])].filter((o, i, all) => all.indexOf(o) === i);
  if (/^-?\d+$/.test(answer)) for (const d of [1, -1, 2]) if (options.length < 3) options.push(String(+answer + d));
  return { answer, options };
}

// ---- proof

/** Every source made by swapping one decoy into one place. */
function* withDecoy(item) {
  const chips = chipsOf(wayOf(item), item.chunks);
  const fills = item.type === 'gap' ? item.fill : null;
  for (const d of item.decoys ?? []) {
    if (fills) {
      for (let h = 0; h < fills.length; h++) {
        let i = 0;
        yield { decoy: d, src: item.code.replace(/___/g, () => (i++ === h ? d : fills[i - 1])) };
      }
    } else {
      for (let c = 0; c < chips.length; c++) {
        yield { decoy: d, src: chips.with(c, d).join(' ') };
      }
    }
  }
}

/** Why an item can't ship, or null. Every shipped item, and every fresh version, passes this. */
export function problem(item) {
  if (!item.id) return 'no id';
  if (item.type === 'teach') {
    if (!item.text) return 'teach without text';
    if (item.code) {
      const r = runIt(item, item.code);
      if (r.error && !r.error.thrown) return `its code fails: ${r.error.message}`;
      if (r.results.some((t) => t.failed)) return `a test on it fails: ${r.results.find((t) => t.failed).failed}`;
      if (item.ts && refused(item, withGiven(item, item.code))) return `its code fails the checker: ${refused(item, withGiven(item, item.code))}`;
    }
    return null;
  }
  if (!item.prompt && item.type !== 'predict') return 'needs a prompt';
  if (!item.explain) return 'needs an explanation';
  if (item.type === 'predict') {
    if (item.asks === 'check') return null;
    const r = runIt(item, item.code);
    if (r.error) return `its code fails: ${r.error.message}`;
    if (!r.output.length) return 'it prints nothing';
    if (item.ts && refused(item, item.code)) return `its code fails the checker: ${refused(item, item.code)}`;
    const { options } = optionsOf(item);
    return options.length < 2 ? 'needs another answer to choose from' : null;
  }
  if (!['build', 'gap'].includes(item.type)) return `unknown type ${item.type}`;
  if (!['print', 'walk', 'returns', 'tests'].includes(item.goal)) return `unknown goal ${item.goal}`;
  const way = wayOf(item);
  if (item.type === 'gap' && (item.code.match(/___/g)?.length ?? 0) !== item.fill.length) return 'the gaps and fills do not match';
  const g = grade(item, way);
  if (!g.right) return `its way fails: ${g.why}`;
  if (item.goal === 'print') {
    if (!g.output.length) return 'its way prints nothing';
    if (!item.undefinedOk && g.output.some((l) => /undefined|NaN/.test(l))) return 'its way prints undefined';
  }
  if (grade(item, '').right) return 'an empty answer passes';
  for (const m of item.mutants ?? []) {
    if (!m.says) return 'a faulty version needs saying in plain words';
    const r = run(m.code, { ts: !!item.ts });
    if (r.error) return `a faulty version does not run: ${r.error.message}`;
    if (refused(item, m.code)) return `a faulty version fails the checker: ${refused(item, m.code)}`;
  }
  const need = item.type === 'gap' ? item.fill : chipsOf(way, item.chunks);
  for (const d of item.decoys ?? []) if (need.includes(d)) return `the decoy ${d} is in its way`;
  for (const { decoy, src } of withDecoy(item)) {
    if (grade(item, src).right && src.replace(/\s/g, '') !== way.replace(/\s/g, '')) return `the decoy ${decoy} passes: ${src}`;
  }
  return null;
}

// ---- fresh versions

const SHORT = ['k', 'm', 'q', 'r', 'u', 'v', 'y', 'z'];
const PROSEY = new Set(['add', 'last', 'first', 'total', 'same', 'open', 'run', 'go', 'say', 'hi', 'safe', 'has', 'wave', 'hop', 'step', 'sign', 'count', 'size', 'flag', 'each', 'apply']); // a word prose uses too
const NAMES = ['tally', 'amount', 'count', 'total', 'score', 'points', 'value', 'result', 'stack', 'pile'];
const STRINGS = ['fox', 'seal', 'moss', 'plum', 'kite', 'fern', 'pear', 'sand'];
const KEEP_STRINGS = new Set(['string', 'number', 'boolean', 'object', 'function', 'undefined', 'up', 'down', 'left', 'right']);

const rewrite = (src, f) => {
  if (!src) return src;
  let out = '';
  let at = 0;
  for (const t of tokenize(src).slice(0, -1)) {
    out += src.slice(at, t.start) + (f(t) ?? t.raw);
    at = t.end;
  }
  return out + src.slice(at);
};
const prose = (text, map) => text?.replace(/[A-Za-z_]\w*|\d+/g, (w) => map[w] ?? w);

const declaredIn = (src, ts) => {
  const found = new Set();
  JSON.stringify(parse(src, { ts }), (_, v) => {
    if ((v?.n === 'Let' || v?.n === 'ForOf' || (v?.n === 'Func' && v.name)) && v.name) found.add(v.name);
    v?.params?.forEach((p) => found.add(p.name));
    return v;
  });
  return found;
};

const sourcesOf = (item) => [item.type === 'predict' || item.type === 'teach' ? item.code : wayOf(item), item.given, ...(item.mutants ?? []).map((m) => m.code)].filter(Boolean);

/** The item with every token and word in `maps` swapped: names (ids), numbers and strings. */
function swapped(item, { ids = {}, nums = {}, strs = {} }) {
  const tok = (t) => {
    if (t.t === 'id' && ids[t.v]) return ids[t.v];
    if (t.t === 'num' && nums[t.v] !== undefined) return String(nums[t.v]);
    if (t.t === 'str' && strs[t.v]) return JSON.stringify(strs[t.v]);
    return null;
  };
  const words = { ...ids, ...strs, ...Object.fromEntries(Object.entries(nums).map(([a, b]) => [a, String(b)])) };
  const each = (s) => rewrite(s, tok);
  const out = { ...item };
  for (const k of ['way', 'code', 'given']) if (out[k]) out[k] = each(out[k]);
  for (const k of ['fill', 'decoys', 'chunks', 'wrong']) {
    if (out[k]) out[k] = out[k].map((x) => (k === 'wrong' ? prose(x, words) : each(x)));
  }
  if (out.mutants) out.mutants = out.mutants.map((m) => ({ code: each(m.code), says: prose(m.says, words) }));
  out.prompt = prose(item.prompt, words);
  out.explain = prose(item.explain, words);
  return out;
}

const flips = { x: { right: 'left', left: 'right' }, y: { up: 'down', down: 'up' } };
function flipped(item, flip) {
  const turn = { ...(flip.x && flips.x), ...(flip.y && flips.y) };
  const m = { ...item, ...mirrored({ level: item.level, prompt: item.prompt, explain: item.explain }, flip) };
  const tok = (t) => ((t.t === 'id' && turn[t.v]) ? turn[t.v] : (t.t === 'str' && turn[t.v]) ? JSON.stringify(turn[t.v]) : null);
  const out = { ...m };
  for (const k of ['way', 'code']) if (out[k]) out[k] = rewrite(out[k], tok);
  for (const k of ['fill', 'decoys', 'chunks']) if (out[k]) out[k] = out[k].map((x) => rewrite(x, tok));
  return out;
}

/** One attempt at a fresh version: new names everywhere, new numbers and words where the goal is worked out. */
function attempt(item, random) {
  let next = item;
  const pick = (list) => list[Math.floor(random() * list.length)];
  const all = sourcesOf(item).flatMap((s) => tokenize(s).slice(0, -1));
  const present = new Set(all.map((t) => t.v));
  const ids = {};
  const pool = NAMES.filter((n) => !present.has(n));
  const short = SHORT.filter((n) => !present.has(n));
  for (const name of sourcesOf(item).flatMap((s) => [...declaredIn(s, !!item.ts)])) {
    if (name === item.name || WORDS.has(name) || ids[name] || PROSEY.has(name) || name === 'a' || name === 'i') continue;
    const from = name.length < 3 ? short : pool;
    if (from.length) ids[name] = from.splice(Math.floor(random() * from.length), 1)[0];
  }
  const worked = item.type === 'predict' ? item.asks !== 'check' : item.goal === 'print' && !item.level;
  const nums = {}, strs = {};
  if (worked && !item.fixed) {
    // Upward and in order, so a comparison keeps its answer. A place in a list and a % keep their number.
    const held = all.filter((t, i) => t.t === 'num' && (all[i - 1]?.raw === '[' || all[i - 1]?.raw === '%')).map((t) => t.v);
    const taken = [...new Set(all.filter((t) => t.t === 'num').map((t) => t.v))].sort((x, y) => x - y);
    let floor = 0;
    for (const n of taken) {
      const swap = n >= 2 && Number.isInteger(n) && !held.includes(n);
      const to = swap ? Math.max(floor + 1, n + 1 + Math.floor(random() * 3)) : n;
      if (to !== n) nums[n] = to;
      floor = to;
    }
    const words = STRINGS.filter((s) => !present.has(s));
    for (const t of all) {
      if (t.t === 'str' && /^[a-z]{2,}$/.test(t.v) && !KEEP_STRINGS.has(t.v) && !strs[t.v] && words.length) strs[t.v] = words.splice(Math.floor(random() * words.length), 1)[0];
    }
  }
  next = swapped(next, { ids, nums, strs });
  if (item.level) next = flipped(next, pick([{ x: true }, { y: true }, { x: true, y: true }]));
  return next;
}

/** Words may say true or false, so a fresh version must print the same ones. */
const verdicts = (item) => (item.type === 'predict' && item.asks ? [] : item.type === 'predict' || item.goal === 'print' ? printedBy(item, item.type === 'predict' ? item.code : wayOf(item)).join(' ').match(/\b(true|false)\b/g) ?? [] : []);
const sameVerdict = (a, b) => verdicts(a).join() === verdicts(b).join();

/**
 * A subject's `vary` (repeat.js): the same idea with new names, numbers and words, or a flipped map.
 * It is checked with `problem`, so a version that stopped working is never played. Teach cards don't
 * repeat; an item nothing can be swapped in stays as written.
 */
export function vary(item, random = Math.random) {
  if (item.type === 'teach') return null;
  for (let i = 0; i < 6; i++) {
    const v = attempt(item, random);
    if (JSON.stringify(v) !== JSON.stringify(item) && !problem(v) && sameVerdict(item, v)) return v;
  }
  return item;
}
