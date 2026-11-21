// A page with no debugger on it. Playwright's connection keeps a page visible (the runner's Chrome also carries switches that
// stop backgrounding), so a page it drives never hears visibilitychange when the phone is put down. Here the page is set up
// through the runner, then Chrome or the app is restarted plain, started by hand over the devtools socket, the connection
// dropped, the phone put down, and only then read again. `away` runs a routine through Home and the lock screen this way.
import { awake, putDown, screenOff, sleep, within } from './device.js';

const CHROME = 'com.android.chrome';
const PORT = 19333;
const SOCKET = 'wingbeat_bare_devtools';

/** Restarts `pkg` plain (no runner switches) at `url`. */
export async function restart({ adb, declinePrompts }, pkg, url) {
  adb('shell', 'am', 'force-stop', pkg);
  adb('shell', 'rm', '-f', '/data/local/tmp/chrome-command-line');
  // Chrome opens a devtools socket only when told to; nothing else of the runner's switches (backgrounding, throttling) is given.
  if (pkg === CHROME) adb('shell', `echo '_ --disable-fre --no-default-browser-check --remote-debugging-socket-name=${SOCKET}' > /data/local/tmp/chrome-command-line`);
  if (pkg === CHROME) adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, pkg);
  else adb('shell', 'am', 'start', '-W', '-n', `${pkg}/.MainActivity`);
  await sleep(6000);
  await declinePrompts?.();
}

/**
 * Connects to the page by its devtools socket with a bare websocket (Playwright cannot attach to a WebView this way), and
 * gives the few calls the checks use: evaluate(fn, arg), click(/name/), reload(). `close()` lets go of the page again.
 */
export async function connect({ adb }, pkg, url) {
  const socket = pkg === CHROME ? SOCKET : adb('shell', 'cat', '/proc/net/unix').match(/@(webview_devtools_remote_\d+)/)?.[1];
  if (!socket) throw new Error(`no devtools socket for ${pkg}`);
  adb('forward', `tcp:${PORT}`, `localabstract:${socket}`);
  let target;
  for (let i = 0; i < 20 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page' && (pkg !== CHROME || t.url.startsWith(url.split('#')[0]))); } catch { /* not up yet */ }
    if (!target) await sleep(500);
  }
  if (!target) throw new Error(`no page to attach to (sockets: ${adb('shell', 'cat', '/proc/net/unix').split('\n').filter((l) => /devtools/.test(l)).map((l) => l.split(/\s+/).pop()).join(' ')})`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('devtools websocket failed')); });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); waiting.delete(d.id); };
  const send = (method, params = {}) => new Promise((ok) => { waiting.set(++id, ok); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (fn, arg) => {
    const r = await send('Runtime.evaluate', { expression: `(${fn})(${JSON.stringify(arg ?? null)})`, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.error || r.result?.exceptionDetails) throw new Error(r.error?.message ?? r.result.exceptionDetails.exception?.description ?? 'evaluate failed');
    return r.result.result.value;
  };
  const page = {
    url: () => target.url, evaluate,
    reload: async () => { await send('Page.reload'); },
    click: (re) => evaluate(({ src }) => {
      const b = [...document.querySelectorAll('button, a')].find((x) => new RegExp(src).test((x.getAttribute('aria-label') || x.textContent).trim()));
      if (!b) throw new Error(`no button ${src}`);
      b.click(); return true;
    }, { src: re.source }),
  };
  return { page, close: () => ws.close() };
}

/** A screenshot with no debugger: the screen itself, pulled over adb. */
export function screen({ adb }, path) { adb('shell', 'screencap', '-p', '/sdcard/bare.png'); adb('pull', '/sdcard/bare.png', path); }

/** What a routine's page says (count, pause), read through a short connection. */
export async function read(h, pkg, url) {
  const c = await connect(h, pkg, url);
  try {
    return await within(c.page.evaluate(() => ({
      count: document.querySelector('.count')?.textContent ?? null, paused: document.querySelector('.practice-pause')?.getAttribute('aria-pressed') ?? null,
      hidden: document.hidden, wl: window.__wl, focus: document.hasFocus(), vis: (window.__vis ?? []).join(' '), end: !!document.querySelector('.summary'), awake: document.documentElement.hasAttribute('data-awake'),
      now: Date.now() % 100000,
    })), 8000, { count: '(no answer)' });
  } finally { await c.close(); }
}

/** Puts the learner's saved state (as `keep` read it) into a freshly started page, and reloads it: storage written just before a force-stop is not always on disk. */
const put = async (page, store) => { await page.evaluate((st) => { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); }, store); await page.reload(); await sleep(3500); };

/** One case: a routine started plain, the phone put down for `secs` (`how`: 'home' | 'screen-off'), read again. Returns what was seen. */
export async function routineAway(h, { pkg, url, tab, cont, then, how, secs, notes, label, store }) {
  const { adb, playing } = h;
  await restart(h, pkg, url);
  let c = await connect(h, pkg, url);
  await put(c.page, store);
  await c.page.evaluate(() => { window.__wl = navigator.wakeLock ? 'asked for nothing yet' : 'no navigator.wakeLock'; const w = navigator.wakeLock; if (w) { const ask = w.request.bind(w); w.request = (t) => ask(t).then((l) => { window.__wl = 'granted'; return l; }, (e) => { window.__wl = `${e.name}: ${e.message}`; throw e; }); } });
  await c.page.evaluate(() => { window.__vis = []; document.addEventListener('visibilitychange', () => window.__vis.push(`${document.visibilityState}@${Date.now() % 100000}`)); });
  try {
    await c.page.click(new RegExp(`^${tab}(,|$)`)); await sleep(1200);
    await c.page.click(cont); await sleep(1500);
    await c.page.click(/^Start$/);
    if (then) { await sleep(1000); await c.page.click(then); }
  } catch (e) {
    screen(h, `${notes}/${label}-setup-failed.png`);
    throw new Error(`${e.message.split('\n')[0]}; the page at ${c.page.url()} says: ${(await c.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200))).trim()}`);
  }
  await sleep(4000);
  await c.close();
  const before = await read(h, pkg, url);
  const running = { sound: playing(), lock: await awake({ adb }, notes, `${label}-running`) };
  screen(h, `${notes}/${label}-before.png`);
  let away;
  const leave = how === 'home' ? (d) => putDown({ adb, page: null }, secs, d, pkg) : (d) => screenOff({ adb, page: null }, secs, d);
  await leave(async () => { await sleep(3000); away = { sound: playing(), lock: await awake({ adb }, notes, `${label}-away`) }; });
  screen(h, `${notes}/${label}-after.png`);
  const after = await read(h, pkg, url);
  await sleep(3000);
  const later = await read(h, pkg, url);
  const back = { sound: playing(), lock: await awake({ adb }, notes, `${label}-back`) };
  return { before, running, away, after, later, back };
}


/** The whole bare check for `pkg` (Chrome or the app): Calm and Move through Home and the lock screen, then a kill. */
export async function bareTour(h, pkg, dir) {
  const { adb, seed, page, check, shot } = h;
  const notes = new URL(`../../../test-results/phone/${dir}/`, import.meta.url).pathname;
  const say = (m) => console.log(`  ${m}`);
  const secs = Number(process.env.AWAY_SECS ?? 20);
  await seed({ done: { 'maths:ten-0': true } });
  await page.evaluate(() => { localStorage.setItem('wingbeat.bell', 'on'); localStorage.setItem('wingbeat.rain', 'on'); });
  const url = page.url();
  const store = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const { mkdirSync } = await import('node:fs');
  mkdirSync(notes, { recursive: true });
  const un = (v) => (v == null ? '-' : JSON.stringify(v));
  for (const [name, tab, cont, then] of [['calm', 'Calm', /^Continue · /], ['move', 'Move', /^Continue/], ['focus', 'Focus', /^Continue · /, /^Reading$/]]) {
    for (const how of ['home', 'screen-off']) {
      const label = `${name}-${how}`;
      const r = await routineAway(h, { pkg, url, tab, cont, then, how, secs, notes, label, store });
      say(`${label}: before: count ${r.before.count}, paused ${r.before.paused}, sound ${un(r.running.sound)}, screen kept on: power ${r.running.lock.held}, window ${r.running.lock.win}, page flag ${r.before.awake}, wake lock: ${r.before.wl}, has focus ${r.before.focus}`);
      say(`${label}: away: sound ${un(r.away.sound)}, screen kept on: power ${r.away.lock.held}, window ${r.away.lock.win}, wakefulness ${r.away.lock.screen}`);
      say(`${label}: back: visibility events ${r.after.vis || '(none)'}; count ${r.after.count}, paused ${r.after.paused}, ended ${r.after.end}, hidden ${r.after.hidden}; 3 s later count ${r.later.count}, paused ${r.later.paused}; sound ${un(r.back.sound)}`);
      const focus = name === 'focus'; // Focus keeps wall-clock time while away (hidden: 'run') and holds the screen: its own rules
      check(`${label}: the page heard it was hidden and shown again`, /hidden/.test(r.after.vis) && /visible/.test(r.after.vis), r.after.vis);
      if (!focus) {
        check(`${label}: the routine is paused on return, not run on or ended`, r.after.paused === 'true' && !r.after.end, `paused ${r.after.paused}, ended ${r.after.end}`);
        check(`${label}: the count is frozen on return`, r.after.count === r.later.count, `${r.after.count} then ${r.later.count}`);
        check(`${label}: no sound while away`, !r.away.sound.started && !r.away.sound.track, un(r.away.sound));
      }
      check(`${label}: the screen is kept awake while it runs, and not while away`, r.running.lock.held > 0 && r.away.lock.held === 0, `running ${r.running.lock.held}, away ${r.away.lock.held}`);
    }
  }

  // The process thrown away while Home shows: what the learner finds.
  await restart(h, pkg, url);
  let c = await connect(h, pkg, url);
  await put(c.page, store);
  await c.page.click(/^Continue · /);
  await sleep(1500);
  const text = (p) => p.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' ').slice(0, 150));
  const midLesson = await text(c.page);
  await c.close();
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(2000);
  adb('shell', 'am', 'kill', pkg); await sleep(3000);
  say(`am kill: ${pkg} processes left: "${(() => { try { return adb('shell', 'pidof', pkg).trim(); } catch { return ''; } })()}"`);
  adb('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1'); await sleep(7000);
  screen(h, `${notes}/after-kill.png`);
  c = await connect(h, pkg, url).catch((e) => { say(`after the kill: ${e.message}`); return null; });
  if (c) {
    const found = await within(c.page.evaluate(() => ({ text: document.getElementById('app')?.innerText.replace(/\s+/g, ' ').slice(0, 150), saved: localStorage.getItem('wingbeat.progress') })), 10000);
    await c.close();
    say(`mid-lesson before the kill: "${midLesson}"`);
    say(`after the kill the learner finds: "${found?.text}"; lessons saved: ${found?.saved ? Object.keys(JSON.parse(found.saved).done).join(',') : 'none read'}`);
    check('after the kill the finished lesson is still saved', !!found?.saved && JSON.parse(found.saved).done['maths:ten-0'] === true);
  }
  void shot;
}
