/**
 * A small, safe interpreter for a JavaScript subset, pure: source to tokens, tokens to a tree, and a
 * tree-walker with a step limit. No eval and no Function: a program only reaches what is written here,
 * so `constructor`, `__proto__` and friends are plain missing names.
 *
 * The subset: numbers, strings, booleans, null, undefined, arrays, objects, let/const, if/else, for,
 * for...of, while, break, continue, functions, arrows, return, throw, new Error(...), the common
 * operators, a few methods (see METHODS), console.log and Math. With `ts: true` the parser also takes
 * type annotations, interfaces, type aliases and generics: they land on the tree for src/code/types.js
 * and do nothing when it runs.
 *
 * run(source, { ts, globals, limit }) -> { output, error, call }. `error` is null or
 * { kind: 'parse' | 'runtime' | 'limit' | 'stop', message, line }, in plain words. `globals` is
 * ({ call, tryCall }) => ({ name: jsFunctionOrValue }): the host's calls in; `call(fn, args)` calls back
 * out, and `tryCall` does too but returns { value } or { error } instead of throwing.
 * A host function that throws Stop ends the run where it stands. `call(name, args)` on the result calls
 * a function the program left at the top: { value } or { error }.
 */
export class ParseError extends Error {
  constructor(message, line) { super(message); this.line = line; }
}
export class RunError extends Error {
  constructor(message, line, kind = 'runtime', value) { super(message); this.line = line; this.kind = kind; this.value = value; }
}
/** Thrown by a host function to end a run: not an error in the program. */
export class Stop extends Error {}

const KEYWORDS = new Set(['let', 'const', 'var', 'if', 'else', 'for', 'of', 'while', 'function', 'return', 'break', 'continue', 'true', 'false', 'null', 'new', 'throw', 'typeof']);
const OPS = ['===', '!==', '=>', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '+', '-', '*', '/', '%', '<', '>', '=', '!', '(', ')', '{', '}', '[', ']', ';', ',', '.', ':', '?', '|'];
const ESCAPES = { n: '\n', t: '\t', '"': '"', "'": "'", '\\': '\\' };

/** Source to tokens: { t: 'num' | 'str' | 'id' | 'kw' | 'op' | 'end', v, raw, line, start, end }. */
export function tokenize(src) {
  const out = [];
  let i = 0, line = 1;
  const push = (t, v, start) => out.push({ t, v, raw: src.slice(start, i), line, start, end: i });
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    const start = i;
    if (/[0-9]/.test(c)) {
      while (/[0-9]/.test(src[i] ?? '')) i++;
      if (src[i] === '.' && /[0-9]/.test(src[i + 1] ?? '')) { i++; while (/[0-9]/.test(src[i] ?? '')) i++; }
      push('num', Number(src.slice(start, i)), start);
    } else if (/[A-Za-z_$]/.test(c)) {
      while (/[A-Za-z0-9_$]/.test(src[i] ?? '')) i++;
      const word = src.slice(start, i);
      push(KEYWORDS.has(word) ? 'kw' : 'id', word, start);
    } else if (c === '"' || c === "'") {
      let text = '';
      for (i++; src[i] !== c; i++) {
        if (i >= src.length || src[i] === '\n') throw new ParseError('A piece of text has a quote mark at one end only.', line);
        if (src[i] === '\\') { i++; text += ESCAPES[src[i]] ?? src[i]; } else text += src[i];
      }
      i++;
      push('str', text, start);
    } else {
      const op = OPS.find((o) => src.startsWith(o, i));
      if (!op) throw new ParseError(`I can't read "${c}" in code.`, line);
      i += op.length;
      push('op', op, start);
    }
  }
  out.push({ t: 'end', v: 'the end', raw: '', line, start: i, end: i });
  return out;
}

const LEVELS = [['||'], ['&&'], ['===', '!==', '==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];
const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=']);

/** Source to a tree: a list of statements. Throws ParseError with a plain-words message. */
export function parse(src, { ts = false } = {}) {
  const toks = tokenize(src);
  let p = 0;
  const peek = (n = 0) => toks[Math.min(p + n, toks.length - 1)];
  const is = (v, n = 0) => { const k = peek(n); return (k.t === 'op' || k.t === 'kw') && k.v === v; };
  const eat = (v) => (is(v) ? (p++, true) : false);
  const fail = (message, tok = peek()) => { throw new ParseError(message, tok.line); };
  const shown = (tok) => (tok.t === 'end' ? 'the end' : `"${tok.raw}"`);
  const need = (v, after) => {
    if (eat(v)) return;
    if (peek().t === 'end') fail(`The code stops too early: it still needs "${v}"${after ? ` ${after}` : ''}.`);
    fail(`I expected "${v}"${after ? ` ${after}` : ''}, and found ${shown(peek())}.`);
  };
  const name = (what) => {
    if (peek().t === 'id') return toks[p++].v;
    if (peek().t === 'kw') fail(`"${peek().v}" is a word JavaScript keeps for itself, so it can't name ${what}.`);
    fail(`I expected a name for ${what}, and found ${shown(peek())}.`);
  };
  /** Runs `parser` and rewinds if it doesn't fit: for the few spots one token can't decide. */
  const attempt = (parser) => {
    const at = p;
    try { return parser(); } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      p = at;
      return null;
    }
  };
  const endStatement = () => {
    if (eat(';') || is('}') || peek().t === 'end' || peek().line > toks[p - 1].line) return;
    fail(`A statement needs a ";" before ${shown(peek())}.`);
  };

  // ---- types (ts only)
  const typeList = () => {
    const list = [type()];
    while (eat(',')) list.push(type());
    return list;
  };
  const typeParams = () => {
    if (!ts || !eat('<')) return undefined;
    const list = [name('a type')];
    while (eat(',')) list.push(name('a type'));
    need('>', 'to close the type names');
    return list;
  };
  const annotation = () => (ts && eat(':') ? type() : undefined);
  const members = () => {
    const out = [];
    while (!is('}')) {
      const key = name('a property');
      const optional = eat('?');
      need(':', `after "${key}"`);
      out.push({ key, optional, type: type() });
      if (!eat(';')) eat(',');
    }
    need('}', 'to close the type');
    return out;
  };
  const primaryType = () => {
    const tok = peek();
    let base;
    if (tok.t === 'num' || tok.t === 'str') { p++; base = { k: 'lit', v: tok.v }; }
    else if (is('true') || is('false')) { p++; base = { k: 'lit', v: tok.v === 'true' }; }
    else if (is('null')) { p++; base = { k: 'ref', name: 'null' }; }
    else if (eat('{')) base = { k: 'obj', members: members() };
    else if (is('(')) {
      base = attempt(() => {
        const params = paramList();
        need('=>');
        return { k: 'fn', params, ret: type() };
      });
      if (!base) { need('('); base = type(); need(')'); }
    } else if (tok.t === 'id') {
      p++;
      base = { k: 'ref', name: tok.v, line: tok.line };
      if (eat('<')) { base.args = typeList(); need('>', 'to close the type'); }
    } else fail(`I expected a type, like number or string, and found ${shown(tok)}.`);
    while (is('[') && is(']', 1)) { p += 2; base = { k: 'arr', of: base }; }
    return base;
  };
  function type() {
    const first = primaryType();
    if (!is('|')) return first;
    const of = [first];
    while (eat('|')) of.push(primaryType());
    return { k: 'union', of };
  }

  // ---- functions
  function paramList() {
    need('(', 'before the inputs');
    const params = [];
    while (!is(')')) {
      const line = peek().line;
      const pname = name('an input');
      const optional = ts && eat('?');
      params.push({ name: pname, optional, type: annotation(), line });
      if (!eat(',')) break;
    }
    need(')', 'after the inputs');
    return params;
  }
  const blockBody = (after) => {
    need('{', after);
    const list = [];
    while (!is('}')) {
      if (peek().t === 'end') fail('The code stops too early: a "{" still needs its "}".');
      list.push(statement());
    }
    p++;
    return list;
  };
  const arrowTail = (params, ret, tps, line) => {
    need('=>');
    if (is('{')) return { n: 'Func', params, ret, tps, body: blockBody(), line };
    return { n: 'Func', params, ret, tps, body: [{ n: 'Return', value: assignment(), line }], line, arrow: true };
  };

  // ---- expressions
  const primary = () => {
    const tok = peek();
    if (tok.t === 'num' || tok.t === 'str') { p++; return { n: tok.t === 'num' ? 'Num' : 'Str', v: tok.v, line: tok.line }; }
    if (is('true') || is('false')) { p++; return { n: 'Bool', v: tok.v === 'true', line: tok.line }; }
    if (is('null')) { p++; return { n: 'Null', line: tok.line }; }
    if (tok.t === 'id' && is('=>', 1)) {
      p++;
      return arrowTail([{ name: tok.v, line: tok.line }], undefined, undefined, tok.line);
    }
    if (is('(') || (ts && is('<'))) {
      const arrow = attempt(() => {
        const tps = typeParams();
        const params = paramList();
        const ret = annotation();
        if (!is('=>')) fail('not an arrow');
        return { params, ret, tps };
      });
      if (arrow) return arrowTail(arrow.params, arrow.ret, arrow.tps, tok.line);
      if (eat('(')) {
        const inner = assignment();
        need(')', 'to close the bracket');
        return inner;
      }
    }
    if (tok.t === 'id') { p++; return { n: 'Id', name: tok.v, line: tok.line }; }
    if (eat('function')) {
      const fname = peek().t === 'id' ? toks[p++].v : undefined;
      const tps = typeParams();
      const params = paramList();
      const ret = annotation();
      return { n: 'Func', name: fname, params, ret, tps, body: blockBody('before the function body'), line: tok.line };
    }
    if (eat('[')) {
      const items = [];
      while (!is(']')) {
        items.push(assignment());
        if (!eat(',')) break;
      }
      need(']', 'to close the list');
      return { n: 'Arr', items, line: tok.line };
    }
    if (eat('{')) {
      const props = [];
      while (!is('}')) {
        const k = peek();
        if (k.t !== 'id' && k.t !== 'str') fail(`I expected a property name, and found ${shown(k)}.`);
        p++;
        const short = !is(':');
        if (!short) p++;
        props.push({ key: k.v, value: short ? { n: 'Id', name: k.v, line: k.line } : assignment() });
        if (!eat(',')) break;
      }
      need('}', 'to close the object');
      return { n: 'Obj', props, line: tok.line };
    }
    if (eat('new')) {
      const callee = name('what to make');
      need('(', `after "${callee}"`);
      return { n: 'New', callee, args: args(), line: tok.line };
    }
    if (tok.t === 'end') fail('The code stops too early: it still needs a value.');
    fail(`I expected a value, and found ${shown(tok)}.`);
  };
  const args = () => {
    const list = [];
    while (!is(')')) {
      list.push(assignment());
      if (!eat(',')) break;
    }
    need(')', 'to close the call');
    return list;
  };
  const postfix = () => {
    let e = primary();
    for (;;) {
      const line = peek().line;
      if (eat('.')) e = { n: 'Member', obj: e, prop: name('a property'), line };
      else if (eat('[')) {
        e = { n: 'Index', obj: e, index: assignment(), line };
        need(']', 'to close the [');
      } else if (eat('(')) e = { n: 'Call', callee: e, args: args(), line };
      else if (ts && is('<')) {
        const typeArgs = attempt(() => { need('<'); const l = typeList(); need('>'); need('('); return l; });
        if (!typeArgs) break;
        e = { n: 'Call', callee: e, typeArgs, args: args(), line };
      } else break;
    }
    if (is('++') || is('--')) e = { n: 'Update', op: toks[p++].v, target: place(e), line: e.line };
    return e;
  };
  const place = (e) => {
    if (e.n === 'Id' || e.n === 'Member' || e.n === 'Index') return e;
    fail('Only a name, or a place inside a list or object, can be changed like that.');
  };
  const unary = () => {
    const tok = peek();
    if (is('!') || is('-') || is('typeof')) { p++; return { n: 'Unary', op: tok.v, arg: unary(), line: tok.line }; }
    if (is('++') || is('--')) { p++; return { n: 'Update', op: tok.v, target: place(unary()), line: tok.line, prefix: true }; }
    return postfix();
  };
  const binary = (level) => {
    if (level === LEVELS.length) return unary();
    let left = binary(level + 1);
    while (LEVELS[level].some((o) => is(o))) {
      const tok = toks[p++];
      const right = binary(level + 1);
      left = { n: level < 2 ? 'Logical' : 'Binary', op: tok.v, left, right, line: tok.line };
    }
    return left;
  };
  const conditional = () => {
    const test = binary(0);
    if (!eat('?')) return test;
    const yes = assignment();
    need(':', 'between the two answers of a ?');
    return { n: 'Cond', test, yes, no: assignment(), line: test.line };
  };
  function assignment() {
    const left = conditional();
    if (peek().t === 'op' && ASSIGN.has(peek().v)) {
      const tok = toks[p++];
      return { n: 'Assign', op: tok.v, target: place(left), value: assignment(), line: tok.line };
    }
    return left;
  }

  // ---- statements
  const declare = (kind) => {
    const line = peek().line;
    const vname = name('a variable');
    const vtype = annotation();
    const init = eat('=') ? assignment() : undefined;
    if (!init && kind === 'const') fail(`const needs a value: "const ${vname} = ...".`);
    return { n: 'Let', kind, name: vname, type: vtype, init, line };
  };
  function statement() {
    const tok = peek();
    const line = tok.line;
    if (is('var')) fail('This course uses let and const, not var.');
    if (is('let') || is('const')) {
      p++;
      const d = declare(tok.v);
      endStatement();
      return d;
    }
    if (eat('if')) {
      need('(', 'after if');
      const test = assignment();
      need(')', 'after the condition');
      const then = statement();
      return { n: 'If', test, then, else: eat('else') ? statement() : undefined, line };
    }
    if (eat('while')) {
      need('(', 'after while');
      const test = assignment();
      need(')', 'after the condition');
      return { n: 'While', test, body: statement(), line };
    }
    if (eat('for')) {
      need('(', 'after for');
      if ((is('let') || is('const')) && peek(1).t === 'id' && is('of', 2)) {
        const kind = peek().v, vname = peek(1).v;
        p += 3;
        const iter = assignment();
        need(')', 'after the list');
        return { n: 'ForOf', kind, name: vname, iter, body: statement(), line };
      }
      let init;
      if (is('let') || is('const')) { const k = toks[p++].v; init = declare(k); } else if (!is(';')) init = { n: 'Expr', e: assignment(), line };
      need(';', 'after the start of a for');
      const test = is(';') ? undefined : assignment();
      need(';', 'after the condition of a for');
      const update = is(')') ? undefined : assignment();
      need(')', 'to close the for');
      return { n: 'For', init, test, update, body: statement(), line };
    }
    if (is('function') && peek(1).t === 'id') {
      p++;
      const fname = name('a function');
      const tps = typeParams();
      const params = paramList();
      const ret = annotation();
      return { n: 'Func', name: fname, params, ret, tps, body: blockBody('before the function body'), line, statement: true };
    }
    if (eat('return')) {
      const value = is(';') || is('}') || peek().t === 'end' ? undefined : assignment();
      endStatement();
      return { n: 'Return', value, line };
    }
    if (eat('break') || eat('continue')) {
      endStatement();
      return { n: tok.v === 'break' ? 'Break' : 'Continue', line };
    }
    if (eat('throw')) {
      const value = assignment();
      endStatement();
      return { n: 'Throw', value, line };
    }
    if (is('{')) return { n: 'Block', body: blockBody(), line };
    if (eat(';')) return { n: 'Block', body: [], line };
    if (ts && tok.t === 'id' && tok.v === 'interface') {
      p++;
      const iname = name('an interface');
      const tps = typeParams();
      need('{', `after "${iname}"`);
      return { n: 'Interface', name: iname, tps, type: { k: 'obj', members: members() }, line };
    }
    if (ts && tok.t === 'id' && tok.v === 'type' && peek(1).t === 'id') {
      p++;
      const iname = name('a type');
      const tps = typeParams();
      need('=', `after "${iname}"`);
      const t = type();
      endStatement();
      return { n: 'Interface', name: iname, tps, type: t, line };
    }
    const e = assignment();
    endStatement();
    return { n: 'Expr', e, line };
  }

  const program = [];
  while (peek().t !== 'end') {
    if (is('}')) fail('There is a "}" with no "{" to close.');
    program.push(statement());
  }
  return program;
}

// ---- values
class Fn { constructor(node, scope) { this.node = node; this.scope = scope; } }
class Host { constructor(fn, label) { this.fn = fn; this.label = label; } }
class Return { constructor(value) { this.value = value; } }
class Thrown { constructor(value, line) { this.value = value; this.line = line; } }
const BREAK = Symbol('break'), CONTINUE = Symbol('continue');

const isFn = (v) => v instanceof Fn || v instanceof Host;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !isFn(v);

/** How a value reads when printed: top-level text bare, inner text in quotes, like a console. */
export function show(v, top = true) {
  if (typeof v === 'string') return top ? v : JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => show(x, false)).join(', ')}]`;
  if (isFn(v)) return 'a function';
  if (isObj(v)) {
    if (v.$error) return `Error: ${v.message}`;
    const keys = Object.keys(v);
    return keys.length ? `{ ${keys.map((k) => `${k}: ${show(v[k], false)}`).join(', ')} }` : '{}';
  }
  return String(v);
}

/** Same value, inside lists and objects too: what toEqual and a hidden test case compare. */
export function same(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && same(a[k], b[k]));
  }
  return Object.is(a, b);
}

const object = (entries) => Object.assign(Object.create(null), entries);
const error = (message) => object({ $error: true, message: String(message) });
const LIMIT = 50000; // steps before a run is cut off: nothing shipped comes near it
const DEPTH = 150; // calls inside calls

/** What a list or text can do. Each takes (value, args, call). */
const METHODS = {
  array: {
    push: (a, xs) => a.push(...xs),
    pop: (a) => a.pop(),
    includes: (a, [x]) => a.some((y) => Object.is(x, y)),
    indexOf: (a, [x]) => a.findIndex((y) => Object.is(x, y)),
    join: (a, [sep = ',']) => a.map((x) => show(x)).join(sep),
    map: (a, [f], call) => a.map((x, i) => call(f, [x, i])),
    filter: (a, [f], call) => a.filter((x, i) => call(f, [x, i])),
    forEach: (a, [f], call) => { a.forEach((x, i) => call(f, [x, i])); },
  },
  string: {
    includes: (s, [x]) => s.includes(String(x)),
    toUpperCase: (s) => s.toUpperCase(),
    toLowerCase: (s) => s.toLowerCase(),
  },
};

const hostErrorIfMaths = (v, line) => {
  if (v !== null && typeof v === 'object') throw new RunError(`I can't do maths or join text with ${Array.isArray(v) ? 'a list' : isFn(v) ? 'a function' : 'an object'}.`, line);
};

/** What a host function hands back, in the program's terms: its functions callable, its objects readable. */
const wrapHost = (v) => {
  if (typeof v === 'function') return new Host(v);
  if (v && Object.getPrototypeOf(v) === Object.prototype) return object(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wrapHost(x)])));
  return v;
};

/** A fresh copy of test data for a program: it can't change the original, and its objects reach no host prototype. */
const inward = (v) => {
  if (Array.isArray(v)) return v.map(inward);
  if (v && typeof v === 'object') return object(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, inward(x)])));
  return v;
};

class Scope {
  constructor(parent) { this.parent = parent; this.vars = new Map(); }
  find(name) {
    for (let s = this; s; s = s.parent) if (s.vars.has(name)) return s.vars.get(name);
    return null;
  }
  add(name, value, konst, line) {
    if (this.vars.has(name)) throw new RunError(`There is already a "${name}" here. Give the new one another name.`, line);
    this.vars.set(name, { value, konst });
  }
}

export function run(source, { ts = false, globals, limit = LIMIT } = {}) {
  const output = [];
  let tree;
  const result = (err) => ({ output, error: err, call: () => ({ error: err }) });
  try { tree = parse(source, { ts }); } catch (e) {
    if (e instanceof ParseError) return result({ kind: 'parse', message: e.message, line: e.line });
    throw e;
  }
  let steps = 0, depth = 0;
  const tick = (line) => {
    if (++steps > limit) throw new RunError("That never finishes, so I stopped it. A loop's condition has to turn false some time.", line, 'limit');
  };
  const top = new Scope(null);

  const callFn = (f, args, line) => {
    if (f instanceof Host) return wrapHost(f.fn(...args));
    if (!(f instanceof Fn)) throw new RunError(`${show(f, false)} isn't a function, so it can't be called.`, line);
    if (++depth > DEPTH) { depth--; throw new RunError('That function keeps calling itself, so I stopped it.', line, 'limit'); }
    const scope = new Scope(f.scope);
    f.node.params.forEach((param, i) => scope.add(param.name, args[i], false, line));
    try {
      execList(f.node.body, scope);
    } catch (e) {
      if (e instanceof Return) return e.value;
      throw e;
    } finally { depth--; }
    return undefined;
  };
  const call = (f, args) => callFn(f, args);

  const member = (obj, prop, line, text) => {
    if (obj === undefined || obj === null) throw new RunError(`${text} is ${obj}, so it has no "${prop}" to read.`, line);
    if (Array.isArray(obj) || typeof obj === 'string') {
      if (prop === 'length') return obj.length;
      const m = METHODS[Array.isArray(obj) ? 'array' : 'string'][prop];
      if (m && Object.hasOwn(METHODS[Array.isArray(obj) ? 'array' : 'string'], prop)) return new Host((...xs) => m(obj, xs, call), prop);
      return undefined;
    }
    if (isObj(obj)) return obj[prop];
    return undefined;
  };
  const describe = (e) => (e.n === 'Id' ? `"${e.name}"` : e.n === 'Member' ? `"${e.prop}"` : 'That');
  const INDEX = (obj, i, line) => {
    if (Array.isArray(obj) || typeof obj === 'string') return Number.isInteger(i) && i >= 0 && i < obj.length ? obj[i] : undefined;
    if (isObj(obj)) return obj[String(i)];
    throw new RunError(`I can't look inside ${show(obj, false)}.`, line);
  };
  const binary = (op, a, b, line) => {
    if (op === '===') return Object.is(a, b) || a === b;
    if (op === '!==') return !(Object.is(a, b) || a === b);
    hostErrorIfMaths(a, line);
    hostErrorIfMaths(b, line);
    switch (op) {
      case '==': return a == b; // eslint-disable-line eqeqeq
      case '!=': return a != b; // eslint-disable-line eqeqeq
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return a / b;
      case '%': return a % b;
      default: throw new RunError(`I don't know "${op}".`, line);
    }
  };
  const store = (target, value, scope) => {
    if (target.n === 'Id') {
      const v = scope.find(target.name);
      if (!v) throw new RunError(`I don't know "${target.name}" yet. Make it first with let.`, target.line);
      if (v.konst) throw new RunError(`"${target.name}" was made with const, so it can't change. Use let if it needs to.`, target.line);
      v.value = value;
      return;
    }
    const obj = ev(target.obj, scope);
    if (target.n === 'Member') {
      if (!isObj(obj)) throw new RunError(`I can't set "${target.prop}" on ${show(obj, false)}.`, target.line);
      obj[target.prop] = value;
      return;
    }
    const i = ev(target.index, scope);
    if (Array.isArray(obj)) {
      if (!Number.isInteger(i) || i < 0 || i > 100000) throw new RunError(`${show(i, false)} isn't a place in a list.`, target.line);
      obj[i] = value;
    } else if (isObj(obj)) obj[String(i)] = value;
    else throw new RunError(`I can't change a place inside ${show(obj, false)}.`, target.line);
  };

  function ev(e, scope) {
    tick(e.line);
    switch (e.n) {
      case 'Num': case 'Str': case 'Bool': return e.v;
      case 'Null': return null;
      case 'Id': {
        if (e.name === 'undefined') return undefined;
        const v = scope.find(e.name);
        if (!v) throw new RunError(`I don't know "${e.name}" yet. Make it first with let.`, e.line);
        return v.value;
      }
      case 'Arr': return e.items.map((x) => ev(x, scope));
      case 'Obj': {
        const o = object({});
        for (const { key, value } of e.props) o[key] = ev(value, scope);
        return o;
      }
      case 'Func': return new Fn(e, scope);
      case 'Unary': {
        if (e.op === 'typeof') {
          if (e.arg.n === 'Id' && e.arg.name !== 'undefined' && !scope.find(e.arg.name)) return 'undefined';
          const v = ev(e.arg, scope);
          return isFn(v) ? 'function' : v === null ? 'object' : typeof v;
        }
        const v = ev(e.arg, scope);
        if (e.op === '!') return !v;
        hostErrorIfMaths(v, e.line);
        return -v;
      }
      case 'Update': {
        const before = ev(e.target, scope);
        hostErrorIfMaths(before, e.line);
        const after = before + (e.op === '++' ? 1 : -1);
        store(e.target, after, scope);
        return e.prefix ? after : before;
      }
      case 'Binary': return binary(e.op, ev(e.left, scope), ev(e.right, scope), e.line);
      case 'Logical': {
        const l = ev(e.left, scope);
        return (e.op === '&&' ? !l : l) ? l : ev(e.right, scope);
      }
      case 'Cond': return ev(ev(e.test, scope) ? e.yes : e.no, scope);
      case 'Assign': {
        const value = ev(e.value, scope);
        const out = e.op === '=' ? value : binary(e.op[0], ev(e.target, scope), value, e.line);
        store(e.target, out, scope);
        return out;
      }
      case 'Member': return member(ev(e.obj, scope), e.prop, e.line, describe(e.obj));
      case 'Index': return INDEX(ev(e.obj, scope), ev(e.index, scope), e.line);
      case 'Call': {
        const f = ev(e.callee, scope);
        const args = e.args.map((a) => ev(a, scope));
        if (!isFn(f)) throw new RunError(`${describe(e.callee)} isn't a function, so it can't be called.`, e.line);
        return callFn(f, args, e.line);
      }
      case 'New': {
        if (e.callee !== 'Error') throw new RunError(`This course can only make new Error(...), not new ${e.callee}.`, e.line);
        return error(e.args[0] ? show(ev(e.args[0], scope)) : '');
      }
      default: throw new RunError(`I can't run that yet (${e.n}).`, e.line);
    }
  }

  function execList(list, scope) {
    for (const s of list) if (s.n === 'Func' && s.statement) scope.add(s.name, new Fn(s, scope), false, s.line);
    for (const s of list) {
      const flow = exec(s, scope);
      if (flow) return flow;
    }
    return undefined;
  }
  const loopBody = (body, scope) => {
    const flow = exec(body, scope);
    return flow === BREAK ? BREAK : undefined;
  };
  function exec(s, scope) {
    tick(s.line);
    switch (s.n) {
      case 'Let': scope.add(s.name, s.init ? ev(s.init, scope) : undefined, s.kind === 'const', s.line); return undefined;
      case 'Expr': ev(s.e, scope); return undefined;
      case 'If': {
        const branch = ev(s.test, scope) ? s.then : s.else;
        return branch ? exec(branch, new Scope(scope)) : undefined;
      }
      case 'Block': return execList(s.body, new Scope(scope));
      case 'While':
        while (ev(s.test, scope)) if (loopBody(s.body, new Scope(scope))) break;
        return undefined;
      case 'For': {
        const head = new Scope(scope);
        if (s.init) exec(s.init, head);
        while (!s.test || ev(s.test, head)) {
          tick(s.line);
          if (loopBody(s.body, new Scope(head))) break;
          if (s.update) ev(s.update, head);
        }
        return undefined;
      }
      case 'ForOf': {
        const list = ev(s.iter, scope);
        if (!Array.isArray(list) && typeof list !== 'string') throw new RunError('for...of needs a list to walk along.', s.line);
        for (const v of [...list]) {
          tick(s.line);
          const inner = new Scope(scope);
          inner.add(s.name, v, s.kind === 'const', s.line);
          if (loopBody(s.body, inner)) break;
        }
        return undefined;
      }
      case 'Func': return undefined; // lifted to the top of its list
      case 'Return': throw new Return(s.value ? ev(s.value, scope) : undefined);
      case 'Break': return BREAK;
      case 'Continue': return CONTINUE;
      case 'Throw': throw new Thrown(ev(s.value, scope), s.line);
      case 'Interface': return undefined; // types do nothing when it runs
      default: throw new RunError(`I can't run that yet (${s.n}).`, s.line);
    }
  }

  const guard = (work) => {
    try {
      return { value: work() };
    } catch (e) {
      if (e instanceof Stop) return { stopped: true };
      if (e instanceof RunError) return { error: { kind: e.kind, message: e.message, line: e.line } };
      if (e instanceof Thrown) return { error: { kind: 'runtime', message: `It stopped with an error: ${show(e.value?.$error ? e.value.message : e.value)}`, line: e.line, thrown: true } };
      if (e instanceof Return) return { error: { kind: 'runtime', message: 'return only works inside a function.', line: 1 } };
      if (e instanceof RangeError) return { error: { kind: 'limit', message: 'That went too deep, so I stopped it.', line: 1 } };
      throw e;
    }
  };
  const tryCall = (f, args) => guard(() => callFn(f, args));
  const print = (...xs) => { output.push(xs.map((x) => show(x)).join(' ')); };
  top.add('console', object({ log: new Host(print, 'log') }));
  top.add('Math', object({
    max: new Host(Math.max), min: new Host(Math.min), abs: new Host(Math.abs), floor: new Host(Math.floor), round: new Host(Math.round),
  }));
  for (const [k, v] of Object.entries(globals?.({ call, tryCall }) ?? {})) top.add(k, wrapHost(v));

  const done = guard(() => execList(tree, top));
  return {
    output,
    error: done.error ?? null,
    stopped: !!done.stopped,
    /** Calls a function the program defined at the top: { value } or { error }. Steps keep counting per call. */
    call(name, args = []) {
      steps = 0;
      const f = top.find(name);
      if (!f || !isFn(f.value)) return { error: { kind: 'runtime', message: `There is no function called "${name}".`, line: 1 } };
      return guard(() => callFn(f.value, args.map(inward)));
    },
    has: (name) => !!top.find(name),
  };
}
