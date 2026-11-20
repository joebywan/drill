/**
 * Drives a page in a browser that has no driver Playwright speaks (Firefox for Android: the phone runner's
 * `--browser firefox`, tools/phone.js). The test server puts one script in index.html (`bridged()`); it asks
 * this side for work over plain HTTP (a long poll), runs it and posts back what happened. `page` answers the
 * part of Playwright's Page the phone scenarios use (evaluate, locators, the clock, goto and reload, page errors
 * and failed requests), so a scenario runs unchanged. Taps stay real (adb) and screenshots come off the screen.
 * Nothing here is served by the real site, and src/ knows nothing of it.
 */
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { answer } from './serve.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Playwright's own fake clock (what `page.clock` installs in Chrome), read out of its bundle, so both browsers keep time alike. */
function clockSource() {
  const bundle = readFileSync(new URL('../node_modules/playwright-core/lib/coreBundle.js', import.meta.url), 'utf8');
  const line = bundle.split('\n').find((l) => l.trimStart().startsWith("source = '") && l.includes('packages/injected/src/clock.ts'));
  if (!line) throw new Error("Playwright's clock source is not where tools/bridge.js looks for it: Playwright changed, look again");
  return new Function(`return ${line.trim().slice('source = '.length).replace(/;$/, '')}`)();
}

/** The script the page runs first, before the app: it fetches work, runs it and reports page errors. Runs in the page, so self-contained. */
function client() {
  const id = Math.random().toString(36).slice(2);
  // The real ones, before an init script's clock replaces them.
  const wait = setTimeout.bind(window), now = Date.now.bind(Date), get = fetch.bind(window);
  const post = (path, body) => get(`/__bridge/${path}`, { method: 'POST', body: JSON.stringify({ page: id, ...body }) }).catch(() => {});
  addEventListener('error', (e) => post('event', { type: 'pageerror', message: e.error?.message ?? e.message }));
  addEventListener('unhandledrejection', (e) => post('event', { type: 'pageerror', message: e.reason?.message ?? String(e.reason) }));

  // Locators, read as Playwright reads them: role and accessible name, text, CSS, hidden things left out of roles.
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const matches = (m, s, exact) => (m.re ? new RegExp(m.re, m.flags).test(norm(s)) : exact ? norm(s) === norm(m.text) : norm(s).toLowerCase().includes(norm(m.text).toLowerCase()));
  const ROLES = {
    button: 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]',
    heading: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
    textbox: 'textarea, input:not([type]), input[type="text"], input[type="email"], input[type="tel"], input[type="url"], [role="textbox"]',
    link: 'a[href], [role="link"]',
  };
  const hiddenForAria = (el) => !el.checkVisibility({ visibilityProperty: true }) || !!el.closest('[aria-hidden="true"]');
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const textOf = (el) => norm([...el.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType !== 1 || n.getAttribute('aria-hidden') === 'true' || !n.checkVisibility({ visibilityProperty: true })) return '';
    const own = n.getAttribute('aria-label') || (n.tagName === 'IMG' ? n.alt : null);
    const block = !/^inline/.test(getComputedStyle(n).display);
    return block ? ` ${own ?? textOf(n)} ` : own ?? textOf(n);
  }).join(''));
  const nameOf = (el) => {
    const by = el.getAttribute('aria-labelledby');
    if (by) return norm(by.split(/\s+/).map((i) => document.getElementById(i)).filter(Boolean).map((e) => e.getAttribute('aria-label') || textOf(e)).join(' '));
    if (el.getAttribute('aria-label')?.trim()) return norm(el.getAttribute('aria-label'));
    if (el.matches('input, textarea, select')) return el.matches('[type="button"], [type="submit"], [type="reset"]') ? norm(el.value) : el.labels?.[0] ? textOf(el.labels[0]) : norm(el.title || el.placeholder);
    if (el.matches('button, [role="button"], h1, h2, h3, h4, h5, h6, [role="heading"], a, [role="link"], [role="tab"]')) return textOf(el);
    return norm(el.title);
  };
  const disabled = (el) => el.matches(':disabled') || el.closest('[aria-disabled="true"]') !== null;
  const byText = (root, s) => [...root.querySelectorAll('*')].filter((el) => !/^(SCRIPT|STYLE|NOSCRIPT|HEAD|TITLE)$/.test(el.tagName)
    && matches(s.text, el.textContent, s.exact) && ![...el.children].some((c) => matches(s.text, c.textContent, s.exact)));
  const find = (steps) => {
    let els = [document];
    for (const s of steps) {
      if (s.css) els = els.flatMap((e) => [...e.querySelectorAll(s.css)]);
      else if (s.role) {
        els = els.flatMap((e) => [...e.querySelectorAll(ROLES[s.role] ?? `[role="${s.role}"]`)]).filter((el) => {
          const said = el.getAttribute('role')?.split(/\s+/)[0];
          return (!said || said === s.role) && !hiddenForAria(el) && (!s.name || matches(s.name, nameOf(el), s.exact))
            && (s.disabled === undefined || disabled(el) === s.disabled) && (s.pressed === undefined || (el.getAttribute('aria-pressed') === 'true') === s.pressed);
        });
      } else if (s.text) els = els.flatMap((e) => byText(e, s));
      else if (s.hasText) els = els.filter((el) => matches(s.hasText, el.textContent, false));
      else if ('nth' in s) els = [els.at(s.nth)].filter(Boolean);
      els = [...new Set(els)];
    }
    return els.filter((e) => e !== document);
  };
  const ops = {
    count: (els) => els.length,
    visible: ([el]) => !!el && visible(el),
    box: ([el]) => { if (!el || !visible(el)) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; },
    text: ([el]) => el.textContent,
    texts: (els) => els.map((e) => e.textContent),
    innerText: ([el]) => el.innerText,
    attr: ([el], name) => el.getAttribute(name),
    scroll: ([el]) => {
      const r = el.getBoundingClientRect();
      // Out of the viewport, or under something fixed over it (a bar of buttons): to the middle, where a finger can reach it.
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const under = top && !el.contains(top) && !top.contains(el);
      if (under || r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) el.scrollIntoView({ block: 'center', inline: 'center' });
    },
    eval: ([el], { fn, arg }) => (0, eval)(`(${fn})`)(el, arg),
  };
  /** Until the locator is in `state`, or `ms` pass: true or false. */
  const until = (steps, state, ms) => new Promise((done) => {
    const end = now() + ms;
    const tick = () => {
      const [el] = find(steps);
      const ok = state === 'attached' ? !!el : state === 'detached' ? !el : state === 'hidden' ? !el || !visible(el) : !!el && visible(el);
      if (ok || now() > end) done(ok); else wait(tick, 50);
    };
    tick();
  });
  window.__bridge = { op: ({ steps, op, x }) => ops[op](find(steps), x), until: ({ steps, state, ms }) => until(steps, state, ms) };

  const run = async ({ id: cmd, fn, expr, arg }) => {
    let reply;
    try {
      const value = await (expr !== undefined ? (0, eval)(expr) : (0, eval)(`(${fn})`)(arg));
      try { reply = JSON.stringify({ id: cmd, value }); } catch { reply = JSON.stringify({ id: cmd, value: null }); }
    } catch (e) {
      reply = JSON.stringify({ id: cmd, error: `${e?.name ?? 'Error'}: ${e?.message ?? e}` });
    }
    get('/__bridge/done', { method: 'POST', body: reply }).catch(() => {});
  };
  (async () => {
    await post('hello', { url: location.href });
    for (;;) {
      try {
        const r = await get(`/__bridge/next?page=${id}`);
        if (r.status === 410) return; // a newer page has taken over
        for (const cmd of await r.json()) run(cmd); // not awaited: an evaluate may run while others start
      } catch { await new Promise((r) => wait(r, 500)); }
    }
  })();
}

/**
 * A bridge and the server that carries it, on `port` (all interfaces, for `adb reverse`). `launch(url)` opens a
 * first page in the browser when there is none (adb's VIEW intent). Gives { page, close }.
 */
export async function bridged(port, launch) {
  const events = new EventEmitter();
  const inits = []; // the init scripts, in order: each page runs them before the app's own scripts
  const queue = []; // commands no page has taken yet
  const sent = new Map(); // id -> { resolve, reject, page }
  let seq = 0, current = null, url = null, loads = 0, poll = null, timeout = 30_000;
  let inflight = 0, last = Date.now(); // the page's own requests, for "the network is idle"
  const loaded = []; // waiters for the next page's hello

  const flush = () => {
    if (!poll || !queue.length) return;
    const { res, page, timer } = poll;
    poll = null; clearTimeout(timer);
    const cmds = queue.splice(0);
    for (const c of cmds) sent.get(c.id).page = page;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(cmds));
  };
  const body = (req) => new Promise((r) => { let s = ''; req.on('data', (d) => { s += d; }); req.on('end', () => r(s ? JSON.parse(s) : {})); });

  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/__bridge/page.js') {
      const js = `(${client})();\n${inits.map((s) => `try { ${s} } catch (e) { console.error(e); }`).join('\n')}`;
      return res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }).end(js);
    }
    if (path === '/__bridge/hello') {
      const { page, url: at } = await body(req);
      current = page; url = at; loads++;
      for (const [id, s] of sent) if (s.page && s.page !== page) { sent.delete(id); s.reject(new Error('Execution context was destroyed: the page navigated')); }
      if (poll && poll.page !== page) { clearTimeout(poll.timer); poll.res.writeHead(410).end(); poll = null; }
      loaded.splice(0).forEach((r) => r());
      return res.end();
    }
    if (path === '/__bridge/next') {
      const page = new URL(req.url, 'http://x').searchParams.get('page');
      if (page !== current) return res.writeHead(410).end();
      if (poll) { clearTimeout(poll.timer); poll.res.writeHead(200).end('[]'); }
      poll = { res, page, timer: setTimeout(() => { if (poll?.res === res) { poll = null; res.writeHead(200).end('[]'); } }, 15_000) };
      return flush();
    }
    if (path === '/__bridge/done') {
      const { id, value, error } = await body(req);
      const s = sent.get(id);
      sent.delete(id);
      if (s) error ? s.reject(new Error(error)) : s.resolve(value);
      return res.end();
    }
    if (path === '/__bridge/event') {
      const { type, message, page } = await body(req);
      if (page === current) events.emit(type, { message });
      return res.end();
    }
    inflight++;
    const status = await answer(req, res, '<script src="/__bridge/page.js"></script>').finally(() => { inflight--; last = Date.now(); });
    if (status >= 400) events.emit('response', { status: () => status, url: () => `http://localhost:${port}${req.url}` });
  });
  await new Promise((r) => server.listen(port, '0.0.0.0', r));

  /** Sends one thing to run in the page: a function and its argument, or an expression. */
  // At most a minute: a page the browser has closed or frozen (back out of it, another app in front) never answers.
  const send = (cmd) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { if (sent.delete(id)) { const at = queue.findIndex((c) => c.id === id); if (at >= 0) queue.splice(at, 1); reject(new Error('no page answered in 60 s')); } }, 60_000);
    sent.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); }, page: null });
    queue.push({ id, ...cmd }); flush();
  });
  const evaluate = (fn, arg) => send(typeof fn === 'function' ? { fn: String(fn), arg } : { expr: String(fn) });
  /** After a page's hello: its load event, then half a second with none of its requests in flight. */
  const settle = async () => {
    await evaluate(() => new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', () => r(), { once: true }))));
    while (inflight || Date.now() - last < 500) await sleep(100);
  };
  /** Starts a navigation and waits for the page that comes of it. */
  const navigate = async (start) => {
    const next = new Promise((r) => loaded.push(r));
    Promise.resolve().then(start).catch(() => {}); // the page that was asked may go before it answers
    await Promise.race([next, sleep(60_000).then(() => { throw new Error('no page loaded in 60 s'); })]);
    await settle();
  };
  /** Polls `check` (true when done) until `ms` pass; a navigation on the way is waited out, as Playwright does. */
  const poll_ = async (what, check, ms = timeout) => {
    const end = Date.now() + ms;
    for (;;) {
      try { if (await check(Math.max(0, Math.min(end - Date.now(), 5000)))) return; } catch (e) { if (!/navigated/.test(e.message)) throw e; }
      if (Date.now() > end) throw new Error(`Timeout ${ms}ms exceeded waiting for ${what}`);
      await sleep(100);
    }
  };

  const matcher = (m) => (m === undefined ? undefined : m instanceof RegExp ? { re: m.source, flags: m.flags } : { text: String(m) });
  class Locator {
    constructor(steps) { this.steps = steps; }
    #with(step) { return new Locator([...this.steps, step]); }
    toString() { return JSON.stringify(this.steps); }
    locator(css) { return this.#with({ css }); }
    getByRole(role, o = {}) { return this.#with({ role, name: matcher(o.name), exact: !!o.exact, disabled: o.disabled, pressed: o.pressed }); }
    getByText(text, o = {}) { return this.#with({ text: matcher(text), exact: !!o.exact }); }
    filter({ hasText }) { return this.#with({ hasText: matcher(hasText) }); }
    first() { return this.#with({ nth: 0 }); }
    last() { return this.#with({ nth: -1 }); }
    nth(i) { return this.#with({ nth: i }); }
    #op(op, x) { return evaluate((a) => window.__bridge.op(a), { steps: this.steps, op, x }); }
    async waitFor({ state = 'visible', timeout: ms = timeout } = {}) {
      await poll_(`${this} to be ${state}`, (wait) => evaluate((a) => window.__bridge.until(a), { steps: this.steps, state, ms: wait }), ms);
    }
    async #attached(op, x) { await this.waitFor({ state: 'attached' }); return this.#op(op, x); }
    count() { return this.#op('count'); }
    isVisible() { return this.#op('visible'); }
    allTextContents() { return this.#op('texts'); }
    boundingBox() { return this.#attached('box'); }
    textContent() { return this.#attached('text'); }
    innerText() { return this.#attached('innerText'); }
    getAttribute(name) { return this.#attached('attr', name); }
    scrollIntoViewIfNeeded() { return this.#attached('scroll'); }
    evaluate(fn, arg) { return this.#attached('eval', { fn: String(fn), arg }); }
  }
  const root = new Locator([]);

  const page = {
    on: (type, f) => { events.on(type, f); return page; },
    off: (type, f) => { events.off(type, f); return page; },
    emulateMedia: async () => {}, // the phone's own settings show through: there is nothing to undo
    setDefaultTimeout: (ms) => { timeout = ms; },
    addInitScript: async (script, arg) => { inits.push(typeof script === 'function' ? `(${script})(${JSON.stringify(arg)});` : script); },
    clock: {
      install: async () => {
        const at = Date.now();
        const script = `(() => { const module = {}; ${clockSource()}; if (!globalThis.__pwClock) globalThis.__pwClock = (module.exports.inject())(globalThis, 'firefox'); })();`;
        inits.push(script, `globalThis.__pwClock.controller.log('install', ${at}, ${at});`);
        if (current) { await evaluate(script); await evaluate(`globalThis.__pwClock.controller.install(${at})`); }
      },
      runFor: (ms) => evaluate(`globalThis.__pwClock.controller.runFor(${ms})`),
    },
    evaluate,
    waitForFunction: (fn, arg, { timeout: ms = timeout } = {}) => poll_('a function to return true', async () => !!(await evaluate(fn, arg)), ms),
    waitForTimeout: sleep,
    url: () => url,
    goto: (to) => navigate(() => (current ? evaluate((u) => { location.href = u; }, to) : launch(to))),
    reload: () => navigate(() => evaluate(() => location.reload())),
    locator: (css) => root.locator(css),
    getByRole: (role, o) => root.getByRole(role, o),
    getByText: (text, o) => root.getByText(text, o),
    route: async () => { throw new Error('page.route: not in the bridge (Firefox) mode'); },
    unroute: async () => {},
    loads: () => loads, // how many pages have said hello: a reload nobody asked for (pull to refresh) shows here
  };
  return { page, close: () => new Promise((r) => { if (poll) { clearTimeout(poll.timer); poll.res.writeHead(410).end(); poll = null; } server.closeAllConnections(); server.close(r); }) };
}
