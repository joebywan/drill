/**
 * Phone tests: drives Chrome on an Android emulator with real touches. Not part of `npm test` or CI.
 *   npm run phone -- [scenario...] [--url <base>] [--avd <name>]   (no scenario: all of test/phone/*.js)
 * With no --url it serves this checkout on a free port, forwarded with `adb reverse`, and Chrome opens
 * http://localhost:<port>/: a secure context, so APIs such as Wake Lock are there as on the real site.
 * A few runs at a time, machine-wide (PHONE_SLOTS, default 4), each on its own emulator: a run takes
 * the first free slot's lock file `/tmp/wingbeat-phone-<n>.lock` (created with 'wx', holding its PID,
 * so a lock left by a process that is gone is taken over) and prints "waiting for the emulator" until
 * it can. Slot n's emulator is `emulator-<5554 + 2n>`; one already running there that no run started
 * (someone driving it by hand) is waited for the same way. Holding the lock, it boots the AVD (--avd,
 * else PHONE_AVD, default splendor36; e.g. --avd daybook_tablet) read-only, which is what lets one AVD
 * run several times over, and shuts it down at the end, then lets go of the lock, on error and Ctrl-C
 * too. Screenshots: test-results/phone/<scenario>/NN-name.png. A scenario gets the same helpers for an app's
 * WebView from `attach(pkg)` once the app is up (test/phone/app.js).
 * `--browser firefox` plays the same scenarios in Firefox for Android instead: its APK (FIREFOX_APK, else the newest
 * ~/Android/wingbeat-test/fenix-*.apk) is installed on the read-only emulator for the run, and the page is driven
 * through tools/bridge.js, a script the test server adds to the page, since Firefox does not speak Playwright's
 * protocol; `--browser chrome-bridge` drives Chrome the same way. PHONE_FONT=1.3 sets the phone's font size first.
 * Exits non-zero on page errors or a failed device check.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { _android as android } from 'playwright';
import { bridged } from './bridge.js';

const ROOT = new URL('..', import.meta.url).pathname;
const SDK = process.env.ANDROID_HOME || `${homedir()}/Android/Sdk`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let serial = null; // this run's emulator, once it has a slot: every adb call below goes to it
const adb = (...a) => execFileSync(`${SDK}/platform-tools/adb`, serial ? ['-s', serial, ...a] : a, { encoding: 'utf8' });

const args = process.argv.slice(2);
const option = (name) => { const at = args.indexOf(name); return at >= 0 ? args.splice(at, 2)[1] : null; };
let base = option('--url');
const AVD = option('--avd') || process.env.PHONE_AVD || 'splendor36';
// The browser: Chrome through Playwright, or a package driven through the bridge (tools/bridge.js).
const BROWSER = option('--browser') || process.env.PHONE_BROWSER || 'chrome';
const BRIDGED = { firefox: 'org.mozilla.firefox', 'chrome-bridge': 'com.android.chrome' };
if (BROWSER !== 'chrome' && !BRIDGED[BROWSER]) { console.error(`--browser is chrome, firefox or chrome-bridge, not ${BROWSER}`); process.exit(2); }
const PKG = BRIDGED[BROWSER] ?? 'com.android.chrome';
const firefoxApk = () => {
  if (process.env.FIREFOX_APK) return process.env.FIREFOX_APK;
  const dir = `${homedir()}/Android/wingbeat-test/`;
  const apk = (existsSync(dir) ? readdirSync(dir) : []).filter((f) => /^fenix-.*\.apk$/.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1);
  if (!apk) throw new Error(`no Firefox APK: set FIREFOX_APK or put fenix-*.apk in ${dir}`);
  return dir + apk;
};
const all = readdirSync(`${ROOT}test/phone`).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const names = args.length ? args : all.filter((n) => !n.endsWith('-all')); // `-all` scenarios play a whole course: ask for them by name
const unknown = names.filter((n) => !all.includes(n));
if (unknown.length) { console.error(`unknown scenario: ${unknown.join(', ')} (have: ${all.join(', ')})`); process.exit(2); }

// --- A few runs at a time, an emulator each -----------------------------------------------
// /tmp, not tmpdir(): a sandboxed agent may have its own TMPDIR, and the locks must be one set for the machine.
const SLOTS = Number(process.env.PHONE_SLOTS) || 4;
const lockOf = (n) => `${process.platform === 'win32' ? tmpdir() : '/tmp'}/wingbeat-phone-${n}.lock`;
const portOf = (n) => 5554 + 2 * n; // the emulator's console port, which names it: emulator-<port>
let LOCK = null; // the slot's lock this run is trying for, or holds
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const holder = () => { try { return readFileSync(LOCK, 'utf8').trim(); } catch { return null; } };
// An emulator up or booting on a slot's port: adb lists it, or a qemu process was started on it (adb doesn't list it until it is up).
const emulatorUp = (port) => {
  if (new RegExp(`^emulator-${port}\\s`, 'm').test(adb('devices'))) return true;
  try { execFileSync('pgrep', ['-f', `qemu-system.* -port ${port}( |$)`], { stdio: 'ignore' }); return true; } catch { return false; }
};
/** Waits until this run holds a slot's lock and no emulator is on that slot's port; then it is ours to boot there. Gives the port. */
async function takeSlot() {
  let said = false;
  for (;;) {
    for (let n = 0; n < SLOTS; n++) {
      LOCK = lockOf(n);
      try {
        writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
        if (!emulatorUp(portOf(n))) return portOf(n);
        rmSync(LOCK, { force: true }); // someone else's emulator: let go and look further, as agents do by hand
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        const pid = Number(holder());
        // A holder that is gone (killed outright) left its lock: take it over. An empty file is a run
        // between creating it and writing its PID, unless it has been empty for a while.
        // ponytail: two waiters breaking the same stale lock at once could both go; it needs a crash, then a tie.
        const stale = pid ? !alive(pid) : Date.now() - (statSync(LOCK, { throwIfNoEntry: false })?.mtimeMs ?? 0) > 10_000;
        if (stale) { rmSync(LOCK, { force: true }); n--; }
      }
    }
    LOCK = null;
    if (!said) { console.log('waiting for the emulator…'); said = true; }
    await sleep(5000);
  }
}
const release = () => { if (LOCK && holder() === String(process.pid)) rmSync(LOCK, { force: true }); };
process.on('exit', release); // the last word, whatever happens

const cleanup = [];
let failed = false;
let tidying = null;
const tidy = async () => { for (const f of cleanup.splice(0)) await Promise.resolve().then(f).catch((e) => console.error('cleanup:', e.message)); };
// Ctrl-C (or a kill) still shuts down the emulator and the server, then lets go of the lock.
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { console.log(`\n${sig}: cleaning up`); await (tidying ??= tidy()); process.exit(130); });
try {
  const port = await takeSlot();
  // Serve this checkout unless told where to go.
  let served = null; // the local port, forwarded to the phone once it is up
  let bridge = null; // in a bridged browser: the server, which carries the page's bridge, and its `page`
  if (!base || BRIDGED[BROWSER]) {
    const port = await new Promise((r) => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
    if (BRIDGED[BROWSER]) {
      if (base) throw new Error('--url: a bridged browser plays this checkout, served with its bridge');
      bridge = await bridged(port, (url) => launch(url));
      cleanup.push(() => bridge.close());
    } else {
      const server = spawn(process.execPath, [`${ROOT}tools/serve.js`], { env: { ...process.env, HOST: '0.0.0.0', PORT: String(port) }, stdio: 'ignore' });
      cleanup.push(() => server.kill());
    }
    served = port;
  }

  // Holding the slot with no emulator on its port, this run boots one there and shuts it down.
  {
    serial = `emulator-${port}`;
    console.log(`booting ${AVD} as ${serial}…`);
    const emu = spawn(`${SDK}/emulator/emulator`, ['-avd', AVD, '-port', String(port), '-read-only', '-no-window', '-no-audio', '-no-boot-anim', '-gpu', 'swiftshader_indirect'], { stdio: 'ignore', cwd: tmpdir() }); // its shared network daemon outlives the run: not in this checkout
    cleanup.push(async () => {
      try { adb('emu', 'kill'); } catch { emu.kill(); }
      for (let i = 0; i < 30 && emu.exitCode === null; i++) await sleep(1000);
      if (emu.exitCode === null) emu.kill('SIGKILL');
    });
    adb('wait-for-device');
    for (let i = 0; adb('shell', 'getprop', 'sys.boot_completed').trim() !== '1'; i++) {
      if (i > 180) throw new Error('emulator did not finish booting in 3 minutes');
      await sleep(1000);
    }
  }

  // One network that stays put. The emulators share one simulated Wi-Fi, which drops when another emulator starts or stops;
  // Android then moves to mobile data, and Chrome fails whatever it is fetching (net::ERR_NETWORK_CHANGED: a page that never
  // loads, a module that never arrives). So Wi-Fi is off, mobile data is the only network, and nothing probes it to decide
  // it has gone (captive_portal_mode 0). The emulator is read-only, so none of this outlasts the run.
  adb('shell', 'settings', 'put', 'global', 'captive_portal_mode', '0');
  adb('shell', 'svc', 'wifi', 'disable');
  const defaultNet = () => (adb('shell', 'dumpsys', 'connectivity').match(/Active default network: (\d+)/) || [])[1];
  for (let i = 0, same = 0, was; i < 30 && same < 3; i++) { // settled: the same network three seconds running
    const now = defaultNet();
    same = now && now === was ? same + 1 : 0;
    was = now;
    await sleep(1000);
  }

  if (BROWSER === 'firefox') {
    const apk = firefoxApk();
    console.log(`installing ${apk.split('/').at(-1)} (gone when the read-only emulator shuts down)…`);
    adb('install', '-r', '-g', apk); // -g: its runtime permissions granted, so Android's own notification dialog doesn't stand over the page
  }
  if (process.env.PHONE_FONT) adb('shell', 'settings', 'put', 'system', 'font_scale', process.env.PHONE_FONT);
  // PHONE_ANIMATIONS=off: Android's "Remove animations", which browsers pass on as prefers-reduced-motion.
  if (process.env.PHONE_ANIMATIONS === 'off') for (const k of ['animator_duration_scale', 'transition_animation_scale', 'window_animation_scale']) adb('shell', 'settings', 'put', 'global', k, '0');

  // localhost on the phone is this machine's port: a secure context, unlike http://10.0.2.2.
  if (served) {
    adb('reverse', `tcp:${served}`, `tcp:${served}`);
    cleanup.unshift(() => adb('reverse', '--remove', `tcp:${served}`)); // before the emulator goes
    base = `http://localhost:${served}/`;
  }

  // Ours among the emulators up. Listing asks each one its model, so one shutting down in another slot can fail it: ask again.
  let device = null, ctx = null;
  if (bridge) device = { screenshot: async ({ path }) => writeFileSync(path, execFileSync(`${SDK}/platform-tools/adb`, ['-s', serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 1 << 28, timeout: 30_000 })) };
  for (let i = 0; !device; i++) {
    try { device = (await android.devices()).find((d) => d.serial() === serial); } catch (e) { if (i === 5) throw e; }
    if (!device) { if (i === 5) throw new Error(`${serial} is not among adb's devices`); await sleep(1000); }
  }
  if (!bridge) {
    ctx = await device.launchBrowser();
    // At most 10 s: Chrome may have frozen its page while an app was in front, and then closing it never returns.
    cleanup.unshift(() => Promise.race([(async () => { for (const p of ctx.pages()) await p.close(); await ctx.close(); await device.close(); })(), sleep(10_000)]));
  }
  const errors = [], requests = [];
  const results = [];
  const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); failed ||= !ok; };

  /** The screen's UI tree from `uiautomator dump`, as XML. */
  const screenXml = async () => {
    for (let i = 0; i < 3; i++) { // uiautomator is sometimes killed mid-dump (exit 137): try again
      try { adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml'); return adb('shell', 'cat', '/sdcard/ui.xml'); } catch { await sleep(1000); }
    }
    return '';
  };
  /** The screen's nodes: text, content-desc, resource-id, centre, and whether the page drew it (under a WebView or GeckoView). */
  const uiNodes = (xml) => {
    const out = [];
    const un = (s) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    let depth = 0, inside = Infinity; // the depth of the page's view, while in it
    for (const m of xml.matchAll(/<(\/?)node\b([^>]*?)(\/?)>/g)) {
      if (m[1]) { if (depth === inside) inside = Infinity; depth--; continue; }
      const d = depth + 1;
      const a = (k) => un(m[2].match(new RegExp(` ${k}="([^"]*)"`))?.[1] ?? '');
      if (inside === Infinity && /GeckoView|android\.webkit\.WebView/.test(a('class'))) inside = d;
      const b = a('bounds').match(/\d+/g)?.map(Number) ?? [0, 0, 0, 0];
      out.push({ text: a('text'), desc: a('content-desc'), rid: a('resource-id'), cls: a('class'), checked: a('checked') === 'true', clickable: a('clickable') === 'true', page: d >= inside, at: [(b[0] + b[2]) >> 1, (b[1] + b[3]) >> 1], box: { left: b[0], top: b[1], right: b[2], bottom: b[3] } });
      if (!m[3]) depth = d; else if (inside === d) inside = Infinity;
    }
    return out;
  };
  // The browser's own prompts sit over the page: Chrome's ("Chrome notifications make things easier", …) and Firefox's first run.
  // Chrome's own views have a resource-id, the page's (e.g. a × labelled "No thanks") none; Firefox's are those outside its GeckoView.
  // Firefox's include its site prompts, such as "Allow … to store data in persistent storage?", declined (test/phone/persist.js looks at that one).
  const PROMPTS = BROWSER === 'firefox' ? ['Not now', 'Not Now', 'No thanks', 'No, thanks', 'Skip', 'Maybe later', 'Dismiss', 'Got it', 'Don’t allow', "Don't allow"] : ['No thanks', 'No, thanks', 'Not now'];
  const own = (node) => (BROWSER === 'firefox' ? !node.page : !!node.rid);
  /** Taps the browser's own control (never the page's) whose text or description `label` matches: true if there was one. */
  const tapUi = async (label, xml) => {
    const hit = uiNodes(xml ?? await screenXml()).find((x) => own(x) && [x.text, x.desc].some((t) => (label instanceof RegExp ? label.test(t) : t === label)));
    if (!hit) return false;
    adb('shell', 'input', 'tap', String(hit.at[0]), String(hit.at[1])); await sleep(800);
    return true;
  };
  const declinePrompts = async () => {
    for (let i = 0; i < 6; i++) {
      const xml = await screenXml();
      const label = PROMPTS.find((l) => uiNodes(xml).some((x) => own(x) && (x.text === l || x.desc === l)));
      if (!label || !(await tapUi(label, xml))) return;
      console.log(`  declined ${BROWSER} prompt: ${label}`);
    }
  };
  /**
   * Firefox's first run, as the owner agreed (2026-11-21): data collection turned off under "Manage settings", then
   * Continue on the screen that says continuing agrees to Firefox's Terms of Use; default browser, sign-in and
   * notifications declined (declinePrompts). One step: true if it did something.
   */
  let stage = 0, tries = 0; // stage 0: welcome screen first seen, 1: data settings shown, 2: back from them
  const firstRun = async (nodes) => {
    const terms = nodes.find((x) => !x.page && /agree to the Firefox Terms of Use/.test(x.text + x.desc));
    const manage = nodes.find((x) => !x.page && /Manage settings/.test(x.text + x.desc));
    const data = nodes.some((x) => !x.page && /Send technical and interaction data/.test(x.text));
    if (data) { // the data settings: every switch on it off, then back
      const on = nodes.filter((x) => !x.page && x.checked && /Switch|View/.test(x.cls));
      for (const x of on) { adb('shell', 'input', 'tap', String(x.at[0]), String(x.at[1])); await sleep(600); }
      if (on.length) { console.log(`  Firefox first run: turned off ${on.length} data setting(s)`); return true; }
      adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(1000); stage = 2;
      return true;
    }
    if (stage < 2 && terms && !manage) { // large text: the welcome card scrolls, and the data line is further down it
      const card = nodes.find((x) => !x.page && /ScrollView/.test(x.cls)) ?? terms;
      const [top, bottom] = [card.box.top, card.box.bottom], x = String(card.at[0]);
      adb('shell', 'input', 'swipe', x, String(Math.round(bottom - (bottom - top) * 0.15)), x, String(Math.round(top + (bottom - top) * 0.15)), '500');
      await sleep(1000);
      return true;
    }
    if (stage < 2 && terms && manage) { // "Manage settings" is a link in the paragraph's last words: along its last line, then the one above
      const xs = [0.12, 0.3, 0.45, 0.6, 0.75, 0.9];
      if (++tries > 2 * xs.length) throw new Error('Firefox first run: could not open "Manage settings" to turn data collection off');
      const line = tries <= xs.length ? manage.box.bottom - 25 : manage.box.bottom - 80;
      const at = [manage.box.left + xs[(tries - 1) % xs.length] * (manage.box.right - manage.box.left), line];
      adb('shell', 'input', 'tap', ...at.map((v) => String(Math.round(v))));
      console.log('  Firefox first run: opened Manage settings?');
      await sleep(1500);
      return true;
    }
    if (nodes.some((x) => !x.page && /as your default browser/.test(x.text)) && await tapUi('Cancel')) { console.log('  Firefox first run: declined being the default browser'); return true; }
    if (stage === 2 && (terms || manage) && await tapUi('Continue')) { console.log('  Firefox first run: Continue (agrees to the Terms of Use; data collection off)'); return true; }
    return false;
  };
  /**
   * Firefox's "Scroll to hide toolbar" turned off (Settings › Customize), unless PHONE_TOOLBAR=hides. With it on, the
   * page's geometry and the screen disagree by the toolbar's height whenever it might slide: a fixed bottom bar's box
   * is reported below the screen (its Continue under nothing the page can name), and a page scrolled by script to its
   * end slides back. Taps aimed from the page would miss; test/phone/browser.js plays the default (hides) on purpose.
   */
  const keepToolbar = async () => {
    const find = async (re, scrolls = 5) => {
      for (let i = 0; i <= scrolls; i++) {
        if (await tapUi(re)) { await sleep(1200); return true; }
        adb('shell', 'input', 'swipe', '540', '1700', '540', '900', '300'); await sleep(800);
      }
      return false;
    };
    if (!(await tapUi(/^(More options|Main menu|Menu)$/))) return console.log('  Firefox: no menu button found, toolbar left as it is');
    await sleep(1200);
    if (!(await find(/^Settings$/, 2)) || !(await find(/^Customi[sz]e$/))) { adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); return console.log('  Firefox: Customize not found, toolbar left as it is'); }
    for (let i = 0; i < 5; i++) {
      const nodes = uiNodes(await screenXml());
      const row = nodes.find((x) => !x.page && /Scroll to hide toolbar/i.test(x.text));
      if (!row) { adb('shell', 'input', 'swipe', '540', '1700', '540', '900', '300'); await sleep(800); continue; }
      // Its own switch: the one whose middle is level with the label's (the rows sit close; the one above is Pull to refresh).
      const near = (x) => /Switch/.test(x.cls) && Math.abs(x.at[1] - row.at[1]) < 50;
      const sw = nodes.find((x) => near(x) && x.checked);
      if (process.env.FIRST_RUN_DUMP) writeFileSync(`${process.env.FIRST_RUN_DUMP}/customize.xml`, await screenXml());
      if (sw) { adb('shell', 'input', 'tap', String(sw.at[0]), String(sw.at[1])); await sleep(1000); }
      const on = !!sw, now = uiNodes(await screenXml()).some((x) => near(x) && x.checked);
      console.log(`  Firefox: "Scroll to hide toolbar" ${on ? (now ? 'is still on' : 'turned off') : 'was already off'}`);
      break;
    }
    for (let i = 0; i < 4 && !uiNodes(await screenXml()).some((x) => !x.page && /localhost:\d+/.test(x.text + x.desc)); i++) { adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(1000); }
  };
  /** Opens `url` in a bridged browser and gets past its first-run screens until the page shows under the address bar. */
  const launch = async (url) => {
    // Chrome's first run is switched off as Playwright does it (its command-line file); Firefox's is got past by declinePrompts.
    if (PKG === 'com.android.chrome') {
      adb('shell', 'am', 'force-stop', PKG); // it reads the file as it starts, and may already be up
      adb('shell', "echo '_ --disable-fre --no-default-browser-check --no-first-run' > /data/local/tmp/chrome-command-line");
    }
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, PKG);
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
      await sleep(1500);
      const xml = await screenXml(), nodes = uiNodes(xml);
      if (bridge.page.loads() && nodes.some((x) => !x.page && /localhost:\d+/.test(x.text + x.desc))) { // the page, with the browser's own bar over it
        if (BROWSER === 'firefox' && process.env.PHONE_TOOLBAR !== 'hides') await keepToolbar();
        return;
      }
      const shown = nodes.filter((x) => !x.page && (x.text || x.desc)).map((x) => x.text || x.desc).join(' | ');
      if (!seen.has(shown)) {
        seen.add(shown); console.log(`  waiting for the page; on screen: ${shown.slice(0, 300)}`);
        if (process.env.FIRST_RUN_DUMP) { // what each first-run screen is made of, to teach the runner a new one
          mkdirSync(process.env.FIRST_RUN_DUMP, { recursive: true });
          writeFileSync(`${process.env.FIRST_RUN_DUMP}/screen-${seen.size}.xml`, xml);
          await device.screenshot({ path: `${process.env.FIRST_RUN_DUMP}/screen-${seen.size}.png` });
        }
      }
      if (BROWSER === 'firefox' && await firstRun(nodes)) continue;
      await declinePrompts();
    }
    throw new Error(`the page never showed under ${BROWSER}'s address bar in 90 s (FIRST_RUN_DUMP=<dir> keeps each screen)`);
  };

  const [w, h] = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)\s*$/).slice(1).map(Number);
  let out = '', n = 0; // the running scenario's screenshot folder and count

  /**
   * The helpers a scenario drives a page with, for Chrome's page and for an app's WebView alike
   * (`attach`): page errors are collected, the clock is Playwright's, and taps land where the page
   * really sits on screen, measured by blanking it and tapping, then `load` brings the page back.
   * `pkg` is whose sound and vibrations the device checks look for.
   */
  const helpersFor = async (page, pkg, load) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => r.status() >= 400 && requests.push(`${r.status()} ${r.url()}`));
    page.on('requestfailed', (r) => requests.push(`${r.failure()?.errorText} ${r.url()}`));
    // Playwright pins prefers-color-scheme to light on every page it drives: let the phone's own night mode through.
    await page.emulateMedia({ colorScheme: null });
    page.setDefaultTimeout(30_000); // a WebView's page has none of its own: a missing button would wait forever
    // Scenarios walk a lesson's own items: no warm-ups or echoes. The real requestAnimationFrame is kept before
    // page.clock replaces it, so shot() can wait for frames the screen will really show.
    await page.addInitScript(() => { window.WINGBEAT_PLAIN = true; window.__frame = requestAnimationFrame.bind(window); });
    await page.clock.install(); // timed routines run on page.clock, so minutes take seconds
    // PHONE_STYLE='<css>' adds a style to every page load: to find which rule a screen's trouble comes from (bisecting).
    // PHONE_NOANIM='<selector>': Web Animations on the elements it matches (or inside them) run at once, for the same.
    if (process.env.PHONE_NOANIM) await page.addInitScript((sel) => { const real = Element.prototype.animate; Element.prototype.animate = function (k, o) { return real.call(this, k, this.closest(sel) ? { ...(typeof o === 'number' ? {} : o), duration: 0, delay: 0, iterations: 1 } : o); }; }, process.env.PHONE_NOANIM);
    if (process.env.PHONE_STYLE) await page.addInitScript((c) => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = c; document.head.append(s); }), process.env.PHONE_STYLE);
    await load();
    await declinePrompts();
    const home = page.url();

    // Where the page's (0,0) is on screen: blank the page, tap, and read where the tap landed. Again (`calibrate`)
    // after the screen size changes (`wm size`, a short phone): Chrome's toolbar moves with it. Leaves the page blank.
    // Chrome's Default zoom changes devicePixelRatio too (test/phone/zoom.js), so it is read again each time.
    let dpr = 1;
    const origin = { x: 0, y: 0 };
    const shown = { height: 0, y: 0, top: false }; // the page as calibrated: its height, where it starts, the toolbar over it
    const calibrate = async () => {
      let [sw, sh] = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)\s*$/).slice(1).map(Number); // always the upright size
      if (await page.evaluate(() => innerWidth > innerHeight)) [sw, sh] = [sh, sw]; // a phone on its side
      dpr = await page.evaluate(() => devicePixelRatio);
      await page.evaluate(() => {
        window.__tap = null;
        document.body.replaceChildren();
        document.body.style.cssText = 'height:100vh;margin:0';
        addEventListener('pointerdown', (e) => { window.__tap = [e.clientX, e.clientY]; }, { once: true, capture: true });
      });
      for (let i = 0; !(await page.evaluate(() => window.__tap)); i++) { // the first tap after launch can go missing
        if (i === 5) throw new Error('calibration tap never reached the page');
        adb('shell', 'input', 'tap', String(sw >> 1), String(Math.round(sh * 0.6)));
        await sleep(1000);
      }
      const [cx, cy] = await page.evaluate(() => window.__tap);
      Object.assign(origin, { x: (sw >> 1) - cx * dpr, y: Math.round(sh * 0.6) - cy * dpr });
      // A browser's toolbar slides away as a finger scrolls the page, and the page grows by its height: at the top, it
      // moves the page up the screen too. Where the toolbar is, and the page's height with it showing, aim taps after.
      const bar = uiNodes(await screenXml()).find((x) => !x.page && /localhost:\d+/.test(x.text + x.desc));
      Object.assign(shown, { height: await page.evaluate(() => innerHeight), y: origin.y, top: BROWSER !== 'firefox' && !!bar && bar.at[1] < sh / 2 }); // Firefox's innerHeight grows by its toolbar on any page that scrolls, toolbar shown or not
      console.log(`page origin on screen (${pkg}): ${Math.round(origin.x)},${Math.round(origin.y)} (dpr ${dpr}, screen ${sw}x${sh}); real frames for shot(): ${await page.evaluate(() => String(window.__frame).includes('[native code]'))}`);
      if (bridge) console.log(`  page ${JSON.stringify(await page.evaluate(() => ({ inner: [innerWidth, innerHeight], visual: [visualViewport.width, visualViewport.height, visualViewport.offsetTop], screen: [mozInnerScreenX, mozInnerScreenY], vh: CSS.supports('height', '1dvh') })).catch((e) => e.message))}`);
    };
    await calibrate();

    const run = async (ms) => { await page.clock.runFor(ms); await sleep(300); };
    /** Back to the page as a first visit sees it: storage cleared, reloaded. */
    const fresh = async () => {
      await page.goto(home, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'networkidle' }); await run(800);
    };
    await fresh();
    // A finger is not a point: with PLAY_JITTER=0.85 a tap lands at a random spot out to that share of the way to the
    // target's edge (seeded by PLAY_SEED, so a run can be repeated); with it unset, dead centre.
    let seedN = Number(process.env.PLAY_SEED) || 1;
    const random = () => { seedN = (seedN + 0x6d2b79f5) | 0; let t = Math.imul(seedN ^ (seedN >>> 15), 1 | seedN); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const touch = async (loc, jitter = Number(process.env.PLAY_JITTER) || 0) => {
      loc = loc.first();
      await loc.waitFor();
      const was = await page.evaluate(() => scrollY);
      await loc.scrollIntoViewIfNeeded();
      // A page scrolled by script settles a moment later: Firefox draws it a frame or two after. Until it has stayed put
      // for 400 ms (at most 3 s), so a finger isn't put down on what was there before.
      const settle = async (from) => {
        for (let at = await page.evaluate(() => scrollY), still = 0, t = 0; at !== from && still < 400 && t < 3000; t += 100) {
          await sleep(100);
          const now = await page.evaluate(() => scrollY);
          still = now === at ? still + 100 : 0;
          at = now;
        }
      };
      await settle(was);
      // Firefox for Android scrolled by script to the page's end slides back by its toolbar's height (the page can only
      // reach its end with the toolbar slid away, which a finger does): a target left under a fixed bar is brought out
      // as a person would, a finger drag up the page.
      for (let i = 0; bridge && i < 3; i++) {
        const under = await loc.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const t = document.elementFromPoint(r.x + r.width / 2, Math.min(r.y + r.height / 2, innerHeight - 1));
          return t && (el.contains(t) || t.contains(el)) ? 0 : Math.round(r.y + r.height / 2 - innerHeight / 2);
        });
        if (under <= 0) break;
        const from = await page.evaluate(() => scrollY);
        const mid = Math.round(screenAt(0, (await page.evaluate(() => innerHeight)) * 0.6)[1]);
        adb('shell', 'input', 'swipe', '540', String(mid), '540', String(Math.round(mid - Math.min(under, 300) * dpr)), '500');
        console.log(`  ${loc} was under a fixed bar: a finger drag brought it up`);
        await sleep(600); await settle(from);
      }
      const [b, height] = await Promise.all([loc.boundingBox(), page.evaluate(() => innerHeight)]);
      // A toolbar at the top that slid away (or back) grew the page by at most its height (Chrome); shrinking is the
      // keyboard, which moves nothing. Firefox's innerHeight and mozInnerScreenY change when its page doesn't move:
      // there the tap's own landing, below, corrects the aim.
      if (shown.top) origin.y = shown.y - (height > shown.height && height - shown.height <= 80 ? height - shown.height : 0) * dpr;
      const off = (size) => (random() * 2 - 1) * jitter * size / 2;
      const [x, y] = [Math.round(origin.x + (b.x + b.width / 2 + off(b.width)) * dpr), Math.round(origin.y + (b.y + b.height / 2 + off(b.height)) * dpr)];
      await loc.evaluate((el) => {
        window.__hit = null;
        addEventListener('pointerdown', (e) => {
          const t = e.target instanceof Element ? e.target : null;
          window.__hit = [e.clientX, e.clientY, !t || el.contains(t) || t.contains(el) ? '' : `${t.tagName.toLowerCase()} "${(t.getAttribute('aria-label') || t.textContent).trim().slice(0, 30)}"`];
        }, { once: true, capture: true });
      });
      adb('shell', 'input', 'tap', String(x), String(y));
      await sleep(700);
      // Where the finger landed in the page: a page that has moved on screen since calibrating (a browser's toolbar
      // sliding away as the page scrolls) shows as a tap off where it was aimed, and the next tap is aimed anew.
      let hit = await page.evaluate(() => window.__hit).catch(() => undefined);
      if (hit === null) { // the page saw no finger at all (it went to the browser, or nowhere): a person taps again
        console.log(`  a tap aimed at ${loc} never reached the page: tapped again`);
        await declinePrompts(); // a prompt of the browser's over the page takes the tap
        adb('shell', 'input', 'tap', String(x), String(y));
        await sleep(700);
        hit = await page.evaluate(() => window.__hit).catch(() => undefined);
      }
      if (hit?.[2]) console.log(`  a tap aimed at ${loc} landed on ${hit[2]}`);
      if (hit) {
        const miss = [x - origin.x - hit[0] * dpr, y - origin.y - hit[1] * dpr];
        if (Math.hypot(...miss) > 2 * dpr) { origin.x += miss[0]; origin.y += miss[1]; shown.y += miss[1]; console.log(`  a tap landed ${miss.map(Math.round)} px from where it was aimed: the page moved on screen; origin now ${Math.round(origin.x)},${Math.round(origin.y)}`); }
      }
      await page.clock.runFor(700);
    };
    const btn = (name, opts) => page.getByRole('button', { name, ...opts }); // opts: e.g. { exact: true }, so 'Run' isn't a chip named run(
    /** `loc`'s box cut to what is on screen (a page-tall element's middle is far below the glass). */
    const visible = async (loc) => {
      const b = await loc.first().boundingBox();
      const [vw, vh] = await page.evaluate(() => [innerWidth, innerHeight]);
      const x = Math.max(b.x, 0), y = Math.max(b.y, 0);
      return { x, y, width: Math.min(b.x + b.width, vw) - x, height: Math.min(b.y + b.height, vh) - y };
    };
    /** A real finger drag across the middle of `loc`, `dx` CSS px sideways and `dy` down (a negative one scrolls the content up). */
    const swipe = async (loc, dx, dy = 0) => {
      const b = await visible(loc);
      const at = (v, o) => String(Math.round(o + v * dpr));
      const x0 = b.x + b.width / 2 - dx / 2, y0 = b.y + b.height / 2 - dy / 2;
      adb('shell', 'input', 'swipe', at(x0, origin.x), at(y0, origin.y), at(x0 + dx, origin.x), at(y0 + dy, origin.y), '400');
      await sleep(800);
    };
    /** A finger put down on `loc` and held `ms` (a long press). */
    const press = async (loc, ms = 800) => {
      const b = await loc.first().boundingBox();
      const x = String(Math.round(origin.x + (b.x + b.width / 2) * dpr)), y = String(Math.round(origin.y + (b.y + b.height / 2) * dpr));
      adb('shell', 'input', 'swipe', x, y, x, y, String(ms));
      await sleep(500);
    };
    /** Two taps on the middle of `loc`, one after the other in a single shell (a double tap). */
    const doubleTap = async (loc) => {
      const b = await loc.first().boundingBox();
      const x = Math.round(origin.x + (b.x + b.width / 2) * dpr), y = Math.round(origin.y + (b.y + b.height / 2) * dpr);
      adb('shell', `input tap ${x} ${y}; input tap ${x} ${y}`);
      await sleep(800); await page.clock.runFor(700);
    };
    const dragTo = async (from, to) => {
      const at = async (loc) => { const b = await loc.first().boundingBox(); return [origin.x + (b.x + b.width / 2) * dpr, origin.y + (b.y + b.height / 2) * dpr].map((n) => String(Math.round(n))); };
      adb('shell', 'input', 'swipe', ...await at(from), ...await at(to), '600');
      await sleep(800);
    };
    /** Starts from the home path, skipping placement, with `patch` merged into the saved progress. */
    const seed = async (patch = {}) => {
      await page.evaluate((patch) => localStorage.setItem('wingbeat.progress', JSON.stringify({
        version: 2, habits: { learn: { count: 0, last: null, forgiven: [] } }, log: [], done: {}, cards: {}, start: 'x', met: Object.fromEntries(['chess', 'maths', 'japanese', 'coding', 'javascript', 'typescript', 'testing'].map((c) => [c, true])), ...patch,
      })), patch);
      await page.reload({ waitUntil: 'networkidle' }); await run(800);
    };
    // Lumi's hop after a lesson (walkTo) runs on real time, 1.65 s: let it land before the shot.
    let lastShot = null;
    const shot = async (label) => {
      // At most 3 s: a page out of sight (another app in front) may never finish an animation.
      await Promise.race([page.evaluate(() => Promise.all(document.querySelector('.guide')?.getAnimations().map((a) => a.finished.catch(() => {})) ?? [])).catch(() => {}), sleep(3000)]);
      // Then until the page has painted (two real frames, at most 1 s), and 400 ms more: on the software-rendered
      // emulator the screen shows a heavy frame a few hundred ms after the page has drawn it.
      await Promise.race([page.evaluate(() => new Promise((r) => (window.__frame ?? requestAnimationFrame)(() => (window.__frame ?? requestAnimationFrame)(r)))).catch(() => {}), sleep(1000)]);
      await sleep(400);
      const path = `${out}/${String(n++).padStart(2, '0')}-${label}.png`;
      await device.screenshot({ path });
      if (bridge) { // a page whole in the DOM but drawn on screen as its background only: say so, with what the browser shows
        const g = grab(), px = [];
        for (let y = Math.round(origin.y) + 60; y < g.height - 300; y += 13) for (let x = 40; x < g.width - 40; x += 13) px.push(g.at(x, y).reduce((a, b) => a + b, 0));
        const mean = px.reduce((a, b) => a + b, 0) / px.length;
        const spread = Math.sqrt(px.reduce((a, b) => a + (b - mean) ** 2, 0) / px.length);
        // The same picture as the shot before while the page now says something else: the screen stopped changing.
        const text = await page.evaluate(() => document.getElementById('app')?.innerText ?? '').catch(() => '');
        const sig = px.join();
        if (lastShot && lastShot.sig === sig && lastShot.text !== text) console.log(`  FROZEN: ${path.split('/').slice(-2).join('/')} shows the same picture as ${lastShot.path.split('/').slice(-2).join('/')}, though the page has changed`);
        lastShot = { sig, text, path };
        if (spread < 4 && text.trim().length > 0) {
          const own = uiNodes(await screenXml()).filter((x) => !x.page && (x.text || x.desc)).map((x) => x.text || x.desc).join(' | ');
          console.log(`  BLANK: ${path.split('/').slice(-2).join('/')} shows the page's background only (the page has content); browser shows: ${own.slice(0, 200)}`);
        }
      }
    };
    const uids = () => adb('shell', 'cmd', 'package', 'list', 'packages', '-U', pkg).match(/uid:\d+/g)?.map((u) => u.slice(4)) || [];
    /** `pkg` is playing sound right now: its stream is started and AudioFlinger has an active track (both, as booleans). */
    const playing = () => {
      const ids = uids();
      const started = adb('shell', 'dumpsys', 'audio').split('\n').some((l) => l.includes('state:started') && ids.some((u) => l.includes(`u/pid:${u}/`)));
      // A track row: "Id Active Client(pid/uid) ...", e.g. "56    yes    3897/  10160".
      const flinger = adb('shell', 'dumpsys', 'media.audio_flinger');
      return { started, track: ids.some((u) => new RegExp(`\\byes\\s+\\d+/\\s*${u}\\b`).test(flinger)) };
    };
    const checkSound = () => {
      const { started, track } = playing();
      check(`sound: ${pkg} audio stream state:started (dumpsys audio)`, started);
      check(`sound: active ${pkg} track (dumpsys media.audio_flinger)`, track);
    };
    const vibrations = () => (adb('shell', 'dumpsys', 'vibrator_manager').match(new RegExp(pkg.replaceAll('.', '\\.'), 'g')) || []).length;
    /** Where a point of the page (CSS px from its top left) is on the screen, as calibrated. */
    const screenAt = (x, y) => [origin.x + x * dpr, origin.y + y * dpr];
    return { page, touch, btn, swipe, press, doubleTap, dragTo, shot, run, seed, fresh, checkSound, playing, vibrations, calibrate, screenAt };
  };
  const page = bridge ? bridge.page : await ctx.newPage();
  const chrome = await helpersFor(page, PKG, () => page.goto(base, { waitUntil: 'networkidle' }));
  /** An app's WebView, once the app is up (`device.webView`), with the same helpers as Chrome's page. */
  const attach = async (pkg) => {
    if (bridge) throw new Error('attach: the installed app is played with --browser chrome');
    const view = await device.webView({ pkg });
    const p = await view.page();
    return helpersFor(p, pkg, () => p.reload({ waitUntil: 'networkidle' }));
  };
  /** The screen as raw pixels (`screencap` without -p): `at(x, y)` is a screen pixel's [r, g, b]. */
  const grab = () => {
    const raw = execFileSync(`${SDK}/platform-tools/adb`, ['-s', serial, 'exec-out', 'screencap'], { maxBuffer: 1 << 28, timeout: 30_000 }) // a screen that stopped drawing can hold it forever;
    const [width, height] = [raw.readUInt32LE(0), raw.readUInt32LE(4)];
    const head = raw.length - width * height * 4; // the header's length differs between Android versions
    return { width, height, at: (x, y) => { const i = head + (y * width + x) * 4; return [raw[i], raw[i + 1], raw[i + 2]]; } };
  };
  const type = async (text) => { adb('shell', 'input', 'text', text.replaceAll(' ', '%s')); await sleep(800); };

  for (const name of names) {
    console.log(`\n▶ ${name}`);
    out = `${ROOT}test-results/phone/${name}`;
    rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
    n = 0;
    const before = { errors: errors.length, requests: requests.length, results: results.length };
    await chrome.fresh();
    await declinePrompts();
    try {
      const { default: scenario } = await import(`${ROOT}test/phone/${name}.js`);
      await scenario({ ...chrome, device, ctx, adb, type, check, declinePrompts, screenXml, uiNodes, tapUi, grab, attach, browser: BROWSER, pkg: PKG });
    } catch (e) {
      errors.push(`scenario ${name}: ${e.message.split('\n').filter((l) => !/^Call log:|^\s*$/.test(l)).slice(0, 2).join(' ')}`);
      await chrome.shot('failed').catch(() => {});
    }
    // Chrome may have frozen its page while an app was in front (test/phone/app.js): then skip this.
    const overflow = await Promise.race([page.evaluate(() => document.documentElement.scrollWidth - innerWidth).catch(() => 0), sleep(5000).then(() => 0)]); // a scenario may have killed Chrome
    check('no sideways overflow', overflow <= 0, overflow > 0 ? `${overflow}px` : '');
    for (const r of results.slice(before.results)) console.log(`  ${r}`);
    for (const e of errors.slice(before.errors)) console.log(`  ERROR ${e}`);
    for (const r of requests.slice(before.requests)) console.log(`  REQUEST ${r}`);
    console.log(`  screenshots: test-results/phone/${name}/ (${n})`);
  }
  console.log(`\n${errors.length ? `${errors.length} page error(s)` : 'no page errors'}, ${requests.length} failed request(s), ${results.filter((r) => r.startsWith('FAIL')).length} failed check(s)`);
  failed ||= errors.length > 0;
} catch (e) {
  console.error(e);
  failed = true;
} finally {
  await (tidying ??= tidy());
  release();
}
process.exit(failed ? 1 : 0);
