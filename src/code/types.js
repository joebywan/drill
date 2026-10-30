/**
 * A small type checker for the TypeScript this app teaches, pure, over the tree from interp.js `parse`
 * with `ts: true`: annotations, inference for let/const, unions with narrowing (typeof, ===, truthiness),
 * interfaces and type aliases, optional properties, arrays, function types and basic generics.
 * It is not TypeScript: only what the course teaches. What it does check follows `strict` mode, so an
 * input with no type is an error, as is a property that may be undefined being read.
 *
 * check(tree) -> [{ line, message }], in plain words, first in the program first.
 *
 * A type is { k }: 'num' 'str' 'bool' 'void' 'any' 'null' 'undef' 'never', { k: 'lit', v }, { k: 'union', of },
 * { k: 'arr', of }, { k: 'obj', props: { name: { t, optional } }, name? }, { k: 'fn', params: [{ t, optional }],
 * ret, tps?, rest? } or { k: 'var', name } (a generic's T).
 */
const NUM = { k: 'num' }, STR = { k: 'str' }, BOOL = { k: 'bool' }, VOID = { k: 'void' }, ANY = { k: 'any' }, NULL = { k: 'null' }, UNDEF = { k: 'undef' }, NEVER = { k: 'never' };
const BUILTIN = { number: NUM, string: STR, boolean: BOOL, void: VOID, any: ANY, unknown: ANY, null: NULL, undefined: UNDEF, never: NEVER };

export function typeText(t) {
  switch (t.k) {
    case 'num': return 'number';
    case 'str': return 'string';
    case 'bool': return 'boolean';
    case 'undef': return 'undefined';
    case 'lit': return JSON.stringify(t.v);
    case 'union': return t.of.map(typeText).join(' | ');
    case 'arr': return t.of.k === 'union' ? `(${typeText(t.of)})[]` : `${typeText(t.of)}[]`;
    case 'obj': return t.name ?? `{ ${Object.entries(t.props).map(([k, p]) => `${k}${p.optional ? '?' : ''}: ${typeText(p.t)}`).join('; ')} }`;
    case 'fn': return `(${t.params.map((p) => typeText(p.t)).join(', ')}) => ${typeText(t.ret)}`;
    case 'var': return t.name;
    default: return t.k;
  }
}

const baseOf = (v) => (typeof v === 'number' ? NUM : typeof v === 'string' ? STR : BOOL);
const widen = (t) => (t.k === 'lit' ? baseOf(t.v) : t.k === 'union' ? union(t.of.map(widen)) : t.k === 'arr' ? { k: 'arr', of: widen(t.of) } : t);
const equal = (a, b) => typeText(a) === typeText(b) && a.k === b.k;

function union(list) {
  const flat = list.flatMap((t) => (t.k === 'union' ? t.of : [t])).filter((t) => t.k !== 'never');
  if (flat.some((t) => t.k === 'any')) return ANY;
  const out = flat.filter((t, i) => flat.findIndex((o) => equal(o, t)) === i);
  return out.length === 0 ? NEVER : out.length === 1 ? out[0] : { k: 'union', of: out };
}

/** Whether a value of type `a` fits where `b` is wanted. */
export function fits(a, b) {
  if (a.k === 'any' || b.k === 'any' || a.k === 'never') return true;
  if (a.k === 'union') return a.of.every((x) => fits(x, b));
  if (b.k === 'union') return b.of.some((x) => fits(a, x));
  if (a.k === 'lit') return b.k === 'lit' ? a.v === b.v : fits(baseOf(a.v), b);
  if (a.k === 'var' || b.k === 'var') return a.k === b.k && a.name === b.name;
  if (a.k !== b.k) return false;
  if (a.k === 'arr') return fits(a.of, b.of);
  if (a.k === 'obj') return Object.entries(b.props).every(([k, p]) => (a.props[k] ? (!a.props[k].optional || p.optional) && fits(a.props[k].t, p.t) : p.optional));
  if (a.k === 'fn') return a.params.length <= b.params.length && a.params.every((p, i) => fits(b.params[i].t, p.t)) && (b.ret.k === 'void' || fits(a.ret, b.ret));
  return true;
}

const subst = (t, map) => {
  switch (t.k) {
    case 'var': return map[t.name] ?? t;
    case 'arr': return { k: 'arr', of: subst(t.of, map) };
    case 'union': return union(t.of.map((x) => subst(x, map)));
    case 'obj': return { ...t, props: Object.fromEntries(Object.entries(t.props).map(([k, p]) => [k, { ...p, t: subst(p.t, map) }])) };
    case 'fn': return { ...t, params: t.params.map((p) => ({ ...p, t: subst(p.t, map) })), ret: subst(t.ret, map) };
    default: return t;
  }
};
/** Reads what a generic's T must be, from a parameter's type and the argument's. */
function unify(param, arg, map, tps) {
  if (param.k === 'var' && tps.includes(param.name)) { map[param.name] = map[param.name] ? union([map[param.name], widen(arg)]) : widen(arg); return; }
  if (param.k === 'arr' && arg.k === 'arr') unify(param.of, arg.of, map, tps);
  if (param.k === 'obj' && arg.k === 'obj') for (const [k, p] of Object.entries(param.props)) if (arg.props[k]) unify(p.t, arg.props[k].t, map, tps);
  if (param.k === 'fn' && arg.k === 'fn') unify(param.ret, arg.ret, map, tps);
  if (param.k === 'union') for (const x of param.of) unify(x, arg, map, tps);
}

const hasVar = (t) => t.k === 'var' || (t.of && (Array.isArray(t.of) ? t.of.some(hasVar) : hasVar(t.of))) || (t.k === 'obj' && Object.values(t.props).some((p) => hasVar(p.t)));
const fn = (params, ret, extra) => ({ k: 'fn', params: params.map((t) => ({ t })), ret, ...extra });
const MATH = { k: 'obj', name: 'Math', props: Object.fromEntries(['max', 'min', 'abs', 'floor', 'round'].map((m) => [m, { t: fn([], NUM, { rest: NUM }) }])) };
const CONSOLE = { k: 'obj', name: 'console', props: { log: { t: fn([], VOID, { rest: ANY }) } } };
const ERROR = { k: 'obj', name: 'Error', props: { message: { t: STR } } };

/** A list's or text's method as a function type, given what the list holds. */
function methodOf(t, prop) {
  if (t.k === 'str' || (t.k === 'lit' && typeof t.v === 'string')) {
    if (prop === 'length') return NUM;
    if (prop === 'includes') return fn([STR], BOOL);
    if (prop === 'toUpperCase' || prop === 'toLowerCase') return fn([], STR);
    return null;
  }
  if (t.k !== 'arr') return null;
  const el = t.of;
  switch (prop) {
    case 'length': return NUM;
    case 'push': return fn([el], NUM);
    case 'pop': return fn([], union([el, UNDEF]));
    case 'includes': return fn([el], BOOL);
    case 'indexOf': return fn([el], NUM);
    case 'join': return { k: 'fn', params: [{ t: STR, optional: true }], ret: STR };
    case 'filter': return fn([fn([el], ANY)], t);
    case 'forEach': return fn([fn([el], ANY)], VOID);
    case 'map': return { k: 'fn', tps: ['U'], params: [{ t: fn([el], { k: 'var', name: 'U' }) }], ret: { k: 'arr', of: { k: 'var', name: 'U' } } };
    default: return null;
  }
}

class Env {
  constructor(parent) { this.parent = parent; this.vars = new Map(); this.types = new Map(); }
  find(name) { for (let e = this; e; e = e.parent) if (e.vars.has(name)) return e.vars.get(name); return null; }
  type(name) { for (let e = this; e; e = e.parent) if (e.types.has(name)) return e.types.get(name); return null; }
}

const GLOBALS = { console: CONSOLE, Math: MATH, undefined: UNDEF };

/** `extra`: names the host provides, { name: type } (any if not otherwise known). */
export function check(tree, { hosts = [] } = {}) {
  const errors = [];
  const err = (line, message) => { if (!errors.some((e) => e.line === line && e.message === message)) errors.push({ line, message }); };
  const top = new Env(null);
  for (const [k, t] of Object.entries(GLOBALS)) top.vars.set(k, { t, konst: true });
  for (const k of hosts) top.vars.set(k, { t: ANY, konst: true });
  const declareType = (s, env) => env.types.set(s.name, { tps: s.tps ?? [], node: s.type, name: s.n === 'Interface' ? s.name : undefined, env });

  /** A written type to a checked type. */
  function read(t, env, line) {
    switch (t.k) {
      case 'lit': return t;
      case 'arr': return { k: 'arr', of: read(t.of, env, line) };
      case 'union': return union(t.of.map((x) => read(x, env, line)));
      case 'obj': return { k: 'obj', props: Object.fromEntries(t.members.map((m) => [m.key, { t: read(m.type, env, line), optional: !!m.optional }])) };
      case 'fn': return { k: 'fn', params: t.params.map((p) => ({ t: p.type ? read(p.type, env, line) : ANY, optional: p.optional })), ret: read(t.ret, env, line) };
      case 'var': return t;
      default: break;
    }
    const known = BUILTIN[t.name];
    if (known) return known;
    const def = env.type(t.name);
    if (t.name === 'Error') return ERROR;
    if (t.name === 'Array' && t.args?.length === 1) return { k: 'arr', of: read(t.args[0], env, line) };
    if (!def) { err(t.line ?? line, `There is no type called "${t.name}".`); return ANY; }
    if (def.generic) return def.generic;
    if ((t.args?.length ?? 0) !== def.tps.length) { err(t.line ?? line, `"${t.name}" needs ${def.tps.length} type${def.tps.length === 1 ? '' : 's'} in its < >.`); return ANY; }
    const inner = new Env(def.env);
    def.tps.forEach((name) => inner.types.set(name, { generic: { k: 'var', name } }));
    const body = read(def.node, inner, line);
    const made = subst(body, Object.fromEntries(def.tps.map((name, i) => [name, read(t.args[i], env, line)])));
    return made.k === 'obj' && !t.args?.length ? { ...made, name: t.name } : made.k === 'obj' ? { ...made, name: `${t.name}<${t.args.map((a) => a.name ?? '').join(', ')}>` } : made;
  }

  /** The function's type from its node, with T readable. */
  function signature(node, env, expected) {
    const inner = new Env(env);
    (node.tps ?? []).forEach((name) => inner.types.set(name, { generic: { k: 'var', name } }));
    const params = node.params.map((p, i) => {
      const given = expected?.k === 'fn' ? expected.params[i]?.t : undefined;
      if (!p.type && !given) err(p.line ?? node.line, `The input "${p.name}" needs a type: write "${p.name}: number" or whichever it is.`);
      const t = p.type ? read(p.type, inner, node.line) : given ?? ANY;
      return { name: p.name, t, optional: !!p.optional };
    });
    return { inner, params, ret: node.ret ? read(node.ret, inner, node.line) : undefined };
  }
  function funcType(node, env, expected) {
    const { inner, params, ret } = signature(node, env, expected);
    const body = new Env(inner);
    for (const p of params) body.vars.set(p.name, { t: p.optional ? union([p.t, UNDEF]) : p.t });
    const frame = { ret, returns: [] };
    block(node.body, body, frame);
    const expectRet = ret;
    if (expectRet && !fits(VOID, expectRet) && !fits(UNDEF, expectRet) && !endsReturning(node.body)) err(node.line, `This function says it returns ${typeText(expectRet)}, but it can reach its end without returning.`);
    const made = ret ?? (frame.returns.length ? union(frame.returns.map(widen)) : VOID);
    return { k: 'fn', tps: node.tps, params, ret: made };
  }
  const endsReturning = (list) => {
    const last = list.at(-1);
    if (!last) return false;
    if (last.n === 'Return' || last.n === 'Throw') return true;
    if (last.n === 'Block') return endsReturning(last.body);
    if (last.n === 'If') return !!last.else && endsReturning([last.then]) && endsReturning([last.else]);
    return false;
  };

  // ---- narrowing: what a condition says about a name when true and when false
  const pick = (t, keep) => (t.k === 'union' ? union(t.of.filter(keep)) : keep(t) ? t : NEVER);
  const TYPEOF = { number: (t) => t.k === 'num' || (t.k === 'lit' && typeof t.v === 'number'), string: (t) => t.k === 'str' || (t.k === 'lit' && typeof t.v === 'string'), boolean: (t) => t.k === 'bool' || (t.k === 'lit' && typeof t.v === 'boolean'), undefined: (t) => t.k === 'undef', object: (t) => t.k === 'obj' || t.k === 'arr' || t.k === 'null', function: (t) => t.k === 'fn' };
  /** The name a narrowing can stick to: `a`, or one part in, `a.b`. */
  const pathOf = (e) => (e.n === 'Id' ? e.name : e.n === 'Member' && e.obj.n === 'Id' ? `${e.obj.name}.${e.prop}` : null);
  /** { name, yes(t), no(t) } for a condition that narrows, else null. */
  function narrowing(test) {
    if (pathOf(test)) return { name: pathOf(test), node: test, yes: (t) => pick(t, (x) => x.k !== 'undef' && x.k !== 'null'), no: (t) => t };
    if (test.n === 'Unary' && test.op === '!') { const r = narrowing(test.arg); return r && { name: r.name, yes: r.no, no: r.yes }; }
    if (test.n !== 'Binary' || !['===', '!==', '==', '!='].includes(test.op)) return null;
    const flip = test.op[0] === '!';
    const made = (name, keep) => (flip ? { name, yes: (t) => pick(t, (x) => !keep(x)), no: (t) => pick(t, keep) } : { name, yes: (t) => pick(t, keep), no: (t) => pick(t, (x) => !keep(x)) });
    const { left: l, right: r } = test;
    const path = pathOf(l);
    const made2 = (keep) => ({ ...made(path, keep), node: l });
    if (l.n === 'Unary' && l.op === 'typeof' && l.arg.n === 'Id' && r.n === 'Str' && TYPEOF[r.v]) return made(l.arg.name, TYPEOF[r.v]);
    if (path && r.n === 'Id' && r.name === 'undefined') return made2((t) => t.k === 'undef');
    if (path && r.n === 'Null') return made2((t) => t.k === 'null');
    if (path && (r.n === 'Str' || r.n === 'Num')) {
      return { name: path, node: l, ...(flip ? { yes: (t) => (t.k === 'union' ? pick(t, (x) => !(x.k === 'lit' && x.v === r.v)) : t), no: (t) => (t.k === 'union' ? pick(t, (x) => x.k !== 'lit' || x.v === r.v) : t) }
        : { yes: (t) => (t.k === 'union' ? pick(t, (x) => x.k !== 'lit' || x.v === r.v) : t), no: (t) => (t.k === 'union' ? pick(t, (x) => !(x.k === 'lit' && x.v === r.v)) : t) }) };
    }
    return null;
  }
  /** `env` with one name read as `how` says, for a branch. */
  const narrowed = (env, n, how) => {
    const inner = new Env(env);
    const v = n && (env.find(n.name) ?? (n.node && { t: hush(() => expr(n.node, env)) }));
    if (v) inner.vars.set(n.name, { ...v, t: n[how](v.t) });
    return inner;
  };

  // ---- statements
  function block(list, env, frame) {
    for (const s of list) if (s.n === 'Interface') declareType(s, env);
    for (const s of list) if (s.n === 'Func' && s.statement) {
      const { params, ret } = hush(() => signature(s, env));
      env.vars.set(s.name, { t: { k: 'fn', tps: s.tps, params, ret: ret ?? ANY }, konst: true, pending: !ret });
    }
    let here = env;
    for (const s of list) {
      stmt(s, here, frame);
      // An if that always leaves narrows what follows it.
      if (s.n === 'If' && !s.else && endsReturning([s.then])) {
        const n = narrowing(s.test);
        if (n) here = narrowed(here, n, 'no');
      }
    }
  }
  /** Runs `work` with its errors dropped: the same thing is read again, and reported, later. */
  const hush = (work) => {
    const n = errors.length;
    const out = work();
    errors.length = n;
    return out;
  };
  function stmt(s, env, frame) {
    switch (s.n) {
      case 'Let': {
        const want = s.type ? read(s.type, env, s.line) : undefined;
        if (env.vars.has(s.name)) err(s.line, `There is already a "${s.name}" here.`);
        if (!s.init && !want) err(s.line, `"${s.name}" needs a type or a starting value.`);
        const got = s.init ? expr(s.init, env, want) : UNDEF;
        if (want && s.init && !fits(got, want)) err(s.line, `"${s.name}" is a ${typeText(want)}, so it can't hold ${typeText(got)}.`);
        const t = want ?? (s.kind === 'const' ? got : widen(got));
        env.vars.set(s.name, { t: want && !s.init ? union([want, UNDEF]) : t, konst: s.kind === 'const', declared: want, unset: !s.init });
        return;
      }
      case 'Expr': expr(s.e, env); return;
      case 'If': {
        expr(s.test, env);
        const n = narrowing(s.test);
        stmt(s.then, narrowed(env, n, 'yes'), frame);
        if (s.else) stmt(s.else, narrowed(env, n, 'no'), frame);
        return;
      }
      case 'While': expr(s.test, env); stmt(s.body, new Env(env), frame); return;
      case 'Block': block(s.body, new Env(env), frame); return;
      case 'For': {
        const head = new Env(env);
        if (s.init) stmt(s.init, head, frame);
        if (s.test) expr(s.test, head);
        if (s.update) expr(s.update, head);
        stmt(s.body, new Env(head), frame);
        return;
      }
      case 'ForOf': {
        const t = expr(s.iter, env);
        const inner = new Env(env);
        if (t.k !== 'arr' && t.k !== 'any' && !fits(t, STR)) err(s.line, `for...of needs a list, and this is ${typeText(t)}.`);
        inner.vars.set(s.name, { t: t.k === 'arr' ? t.of : t.k === 'any' ? ANY : STR, konst: s.kind === 'const' });
        stmt(s.body, inner, frame);
        return;
      }
      case 'Func': {
        const t = funcType(s, env);
        env.vars.set(s.name, { t, konst: true });
        return;
      }
      case 'Return': {
        const got = s.value ? expr(s.value, env, frame?.ret) : VOID;
        if (!frame) { err(s.line, 'return only works inside a function.'); return; }
        frame.returns.push(got);
        if (frame.ret && !fits(got, frame.ret) && !(got.k === 'void' && fits(UNDEF, frame.ret))) err(s.line, `This function says it returns ${typeText(frame.ret)}, but this returns ${typeText(got)}.`);
        return;
      }
      case 'Throw': expr(s.value, env); return;
      default:
    }
  }

  // ---- expressions: the type of `e`. `want` guides what literals and arrows mean.
  function expr(e, env, want) {
    switch (e.n) {
      case 'Num': case 'Str': case 'Bool': return { k: 'lit', v: e.v };
      case 'Null': return NULL;
      case 'Id': {
        const v = env.find(e.name);
        if (!v) { err(e.line, `I don't know "${e.name}" yet.`); return ANY; }
        return v.t;
      }
      case 'Arr': {
        const el = want?.k === 'arr' ? want.of : undefined;
        const items = e.items.map((x) => expr(x, env, el));
        if (el) {
          for (const t of items) if (!fits(t, el)) err(e.line, `This list holds ${typeText(el)}, so it can't hold ${typeText(t)}.`);
          return want;
        }
        return { k: 'arr', of: items.length ? union(items.map(widen)) : ANY };
      }
      case 'Obj': {
        const props = want?.k === 'obj' ? want.props : want?.k === 'union' ? Object.assign({}, ...want.of.filter((t) => t.k === 'obj').map((t) => t.props)) : undefined;
        const out = {};
        for (const { key, value } of e.props) {
          if (props && !props[key]) err(e.line, `${want.name ? `"${want.name}"` : 'That type'} has no "${key}".`);
          out[key] = { t: expr(value, env, props?.[key]?.t) };
        }
        if (props) for (const [k, p] of Object.entries(props)) {
          if (!p.optional && !out[k] && want.k === 'obj') err(e.line, `${want.name ? `"${want.name}"` : 'That type'} needs a "${k}".`);
          if (out[k] && want.k === 'obj' && !fits(out[k].t, p.t)) err(e.line, `"${k}" should be ${typeText(p.t)}, not ${typeText(out[k].t)}.`);
        }
        return want?.k === 'obj' ? want : { k: 'obj', props: out };
      }
      case 'Func': return funcType(e, env, want?.k === 'fn' ? want : undefined);
      case 'Unary': {
        const t = expr(e.arg, env);
        if (e.op === 'typeof') return STR;
        if (e.op === '!') return BOOL;
        if (!fits(t, NUM)) err(e.line, `I can't make ${typeText(t)} negative.`);
        return NUM;
      }
      case 'Update': {
        const t = expr(e.target, env);
        if (!fits(t, NUM)) err(e.line, `${e.op} needs a number, and this is ${typeText(t)}.`);
        konstCheck(e.target, env);
        return NUM;
      }
      case 'Binary': return binary(e, env);
      case 'Logical': {
        const l = expr(e.left, env);
        const n = narrowing(e.left);
        const r = expr(e.right, narrowed(env, n, e.op === '&&' ? 'yes' : 'no'));
        return widen(l).k === 'bool' && widen(r).k === 'bool' ? BOOL : union([l, r]);
      }
      case 'Cond': {
        expr(e.test, env);
        const n = narrowing(e.test);
        return union([expr(e.yes, narrowed(env, n, 'yes'), want), expr(e.no, narrowed(env, n, 'no'), want)]);
      }
      case 'Assign': {
        const t = e.target.n === 'Id' ? env.find(e.target.name)?.declared ?? expr(e.target, env) : expr(e.target, env);
        const got = expr(e.value, env, t);
        konstCheck(e.target, env);
        if (e.op === '=') { if (!fits(got, t)) err(e.line, `This holds ${typeText(t)}, so it can't take ${typeText(got)}.`); }
        else if (e.op === '+=') { if (!(fits(t, STR) || (fits(t, NUM) && fits(got, NUM)))) err(e.line, `I can't add ${typeText(got)} to ${typeText(t)}.`); }
        else if (!fits(t, NUM) || !fits(got, NUM)) err(e.line, `${e.op} needs numbers.`);
        return t;
      }
      case 'Member': return member(e, env);
      case 'Index': {
        const t = expr(e.obj, env);
        const i = expr(e.index, env);
        if (t.k === 'arr') { if (!fits(i, NUM)) err(e.line, `A list's place is a number, not ${typeText(i)}.`); return t.of; }
        if (fits(t, STR)) return STR;
        return ANY;
      }
      case 'Call': return call(e, env);
      case 'New': e.args.forEach((a) => expr(a, env)); return ERROR;
      default: return ANY;
    }
  }
  const konstCheck = (target, env) => {
    if (target.n === 'Id' && env.find(target.name)?.konst) err(target.line, `"${target.name}" was made with const, so it can't change.`);
  };
  function binary(e, env) {
    const l = expr(e.left, env), r = expr(e.right, env);
    const bad = (why) => { err(e.line, why); return ANY; };
    switch (e.op) {
      case '+':
        if (l.k === 'any' || r.k === 'any') return ANY;
        if (fits(l, NUM) && fits(r, NUM)) return NUM;
        if ((fits(l, STR) && fits(r, union([STR, NUM]))) || (fits(r, STR) && fits(l, NUM))) return STR;
        return bad(`I can't add ${typeText(l)} and ${typeText(r)}.`);
      case '-': case '*': case '/': case '%':
        return fits(l, NUM) && fits(r, NUM) ? NUM : bad(`${e.op} needs two numbers, and this has ${typeText(l)} and ${typeText(r)}.`);
      case '<': case '>': case '<=': case '>=':
        if (!(fits(l, NUM) && fits(r, NUM)) && !(fits(l, STR) && fits(r, STR))) err(e.line, `I can't compare ${typeText(l)} and ${typeText(r)}.`);
        return BOOL;
      default:
        if (!fits(widen(l), widen(r)) && !fits(widen(r), widen(l)) && !overlaps(widen(l), widen(r))) err(e.line, `${typeText(l)} and ${typeText(r)} are never the same, so this can't be true.`);
        return BOOL;
    }
  }
  const overlaps = (a, b) => (a.k === 'union' ? a.of.some((x) => overlaps(x, b)) : b.k === 'union' ? b.of.some((x) => overlaps(a, x)) : fits(a, b) || fits(b, a));
  function member(e, env) {
    const known = pathOf(e) && env.find(pathOf(e));
    if (known) return known.t;
    const t = expr(e.obj, env);
    if (t.k === 'any') return ANY;
    const one = (o) => {
      if (o.k === 'obj') {
        const p = o.props[e.prop];
        return p ? (p.optional ? union([p.t, UNDEF]) : p.t) : null;
      }
      return methodOf(o, e.prop);
    };
    if (t.k === 'union') {
      if (t.of.some((x) => x.k === 'undef' || x.k === 'null')) {
        err(e.line, `This could be ${t.of.some((x) => x.k === 'undef') ? 'undefined' : 'null'}, so check it first before reading "${e.prop}".`);
        return ANY;
      }
      const all = t.of.map(one);
      if (all.some((x) => !x)) { err(e.line, `Not every kind of ${typeText(t)} has "${e.prop}". Check which one it is first.`); return ANY; }
      return union(all);
    }
    const found = one(t);
    if (!found) { err(e.line, `${typeText(t)} has no "${e.prop}".`); return ANY; }
    return found;
  }
  function call(e, env) {
    const f = expr(e.callee, env);
    if (f.k === 'any') { e.args.forEach((a) => expr(a, env)); return ANY; }
    if (f.k !== 'fn') { err(e.line, `${typeText(f)} isn't a function, so it can't be called.`); return ANY; }
    const need = f.params.filter((p) => !p.optional).length;
    if (!f.rest && (e.args.length < need || e.args.length > f.params.length)) {
      err(e.line, `This takes ${need === f.params.length ? need : `${need} to ${f.params.length}`} value${f.params.length === 1 ? '' : 's'}, and it was given ${e.args.length}.`);
    }
    const map = {};
    const tps = f.tps ?? [];
    if (e.typeArgs) tps.forEach((name, i) => { if (e.typeArgs[i]) map[name] = read(e.typeArgs[i], env, e.line); });
    e.args.forEach((a, i) => {
      const p = f.params[i]?.t ?? f.rest ?? ANY;
      const hint = subst(p, map);
      const got = expr(a, env, hint.k !== 'fn' && hasVar(hint) ? undefined : hint);
      if (tps.length && !e.typeArgs) unify(p, got, map, tps);
      const wanted = subst(p, map);
      if (!fits(got, wanted) && !(wanted.k === 'fn' && got.k === 'fn')) err(a.line ?? e.line, `This wants ${typeText(wanted)}, and it was given ${typeText(got)}.`);
    });
    return subst(f.ret, map);
  }

  block(tree, top, null);
  return errors.sort((a, b) => a.line - b.line);
}
