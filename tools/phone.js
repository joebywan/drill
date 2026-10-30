/**
 * Phone tests: drives Chrome on an Android emulator with real touches. Not part of `npm test` or CI.
 *   npm run phone -- [scenario...] [--url <base>]      (no scenario: all of test/phone/*.js)
 * With no --url it serves this checkout on a free port and Chrome opens http://10.0.2.2:<port>/.
 * It boots the AVD (PHONE_AVD, default splendor36) read-only if no emulator is running, and shuts
 * down only an emulator it started. Screenshots: test-results/phone/<scenario>/NN-name.png.
 * Exits non-zero on page errors or a failed device check. One agent on the emulator at a time.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { _android as android } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const SDK = process.env.ANDROID_HOME || `${homedir()}/Android/Sdk`;
const AVD = process.env.PHONE_AVD || 'splendor36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...a) => execFileSync(`${SDK}/platform-tools/adb`, a, { encoding: 'utf8' });

const args = process.argv.slice(2);
const urlAt = args.indexOf('--url');
let base = urlAt >= 0 ? args.splice(urlAt, 2)[1] : null;
const all = readdirSync(`${ROOT}test/phone`).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const names = args.length ? args : all;
const unknown = names.filter((n) => !all.includes(n));
if (unknown.length) { console.error(`unknown scenario: ${unknown.join(', ')} (have: ${all.join(', ')})`); process.exit(2); }

const cleanup = [];
let failed = false;
try {
  // Serve this checkout unless told where to go.
  if (!base) {
    const port = await new Promise((r) => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
    const server = spawn(process.execPath, [`${ROOT}tools/serve.js`], { env: { ...process.env, HOST: '0.0.0.0', PORT: String(port) }, stdio: 'ignore' });
    cleanup.push(() => server.kill());
    base = `http://10.0.2.2:${port}/`;
  }

  // Boot the emulator only if none is running; then it's ours to shut down.
  if (!/^emulator-\S+\tdevice/m.test(adb('devices'))) {
    console.log(`booting ${AVD}…`);
    const emu = spawn(`${SDK}/emulator/emulator`, ['-avd', AVD, '-read-only', '-no-window', '-no-boot-anim', '-gpu', 'swiftshader_indirect'], { stdio: 'ignore' });
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

  const [device] = await android.devices();
  const ctx = await device.launchBrowser();
  cleanup.unshift(async () => { for (const p of ctx.pages()) await p.close(); await ctx.close(); await device.close(); });
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && requests.push(`${r.status()} ${r.url()}`));
  page.on('requestfailed', (r) => requests.push(`${r.failure()?.errorText} ${r.url()}`));
  await page.clock.install(); // timed routines run on page.clock, so minutes take seconds
  await page.goto(base, { waitUntil: 'networkidle' });

  // Chrome's own prompts ("Chrome notifications make things easier", …) sit over the page.
  const declinePrompts = async () => {
    for (const label of ['No thanks', 'No, thanks', 'Not now']) {
      let ui = '';
      for (let i = 0; i < 3 && !ui; i++) { // uiautomator is sometimes killed mid-dump (exit 137): try again
        try { adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml'); ui = adb('shell', 'cat', '/sdcard/ui.xml'); } catch { await sleep(1000); }
      }
      // Chrome's own views have a resource-id; the page's (e.g. a × labelled "No thanks") have none.
      const m = ui.match(new RegExp(`text="${label}" resource-id="[^"]+"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
      if (m) { adb('shell', 'input', 'tap', String((+m[1] + +m[3]) >> 1), String((+m[2] + +m[4]) >> 1)); await sleep(800); console.log(`  declined Chrome prompt: ${label}`); }
    }
  };
  await declinePrompts();

  // Where the page's (0,0) is on screen: blank the page, tap, and read where the tap landed.
  const dpr = await page.evaluate(() => devicePixelRatio);
  const [w, h] = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)\s*$/).slice(1).map(Number);
  await page.evaluate(() => {
    document.body.replaceChildren();
    document.body.style.cssText = 'height:100vh;margin:0';
    addEventListener('pointerdown', (e) => { window.__tap = [e.clientX, e.clientY]; }, { once: true, capture: true });
  });
  for (let i = 0; !(await page.evaluate(() => window.__tap)); i++) { // the first tap after launch can go missing
    if (i === 5) throw new Error('calibration tap never reached the page');
    adb('shell', 'input', 'tap', String(w >> 1), String(Math.round(h * 0.6)));
    await sleep(1000);
  }
  const [cx, cy] = await page.evaluate(() => window.__tap);
  const origin = { x: (w >> 1) - cx * dpr, y: Math.round(h * 0.6) - cy * dpr };
  console.log(`page origin on screen: ${Math.round(origin.x)},${Math.round(origin.y)} (dpr ${dpr})`);

  // The helpers every scenario gets.
  const run = async (ms) => { await page.clock.runFor(ms); await sleep(300); };
  const touch = async (loc) => {
    loc = loc.first();
    await loc.waitFor();
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    adb('shell', 'input', 'tap', String(Math.round(origin.x + (b.x + b.width / 2) * dpr)), String(Math.round(origin.y + (b.y + b.height / 2) * dpr)));
    await sleep(700); await page.clock.runFor(700);
  };
  const btn = (name) => page.getByRole('button', { name });
  /** A real finger drag across the middle of `loc`, `dx` CSS px sideways. */
  const swipe = async (loc, dx) => {
    const b = await loc.first().boundingBox();
    const at = (x) => String(Math.round(origin.x + x * dpr));
    const y = String(Math.round(origin.y + (b.y + b.height / 2) * dpr));
    const x0 = b.x + b.width / 2 - dx / 2;
    adb('shell', 'input', 'swipe', at(x0), y, at(x0 + dx), y, '400');
    await sleep(800);
  };
  const type = async (text) => { adb('shell', 'input', 'text', text.replaceAll(' ', '%s')); await sleep(800); };
  /** Starts from the home path, skipping placement, with `patch` merged into the saved progress. */
  const seed = async (patch = {}) => {
    await page.evaluate((patch) => localStorage.setItem('drill.progress', JSON.stringify({
      version: 2, habits: { learn: { count: 0, last: null, forgiven: [] } }, log: [], done: {}, cards: {}, start: 'x', ...patch,
    })), patch);
    await page.reload({ waitUntil: 'networkidle' }); await run(800);
  };
  const results = [];
  const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); failed ||= !ok; };
  /** Chrome is playing sound right now: its stream is started and AudioFlinger has an active track. */
  const checkSound = () => {
    const uids = adb('shell', 'cmd', 'package', 'list', 'packages', '-U', 'com.android.chrome').match(/uid:\d+/g)?.map((u) => u.slice(4)) || [];
    const started = adb('shell', 'dumpsys', 'audio').split('\n').some((l) => l.includes('state:started') && uids.some((u) => l.includes(`u/pid:${u}/`)));
    check('sound: Chrome audio stream state:started (dumpsys audio)', started);
    // A track row: "Id Active Client(pid/uid) ...", e.g. "56    yes    3897/  10160".
    const flinger = adb('shell', 'dumpsys', 'media.audio_flinger');
    check('sound: active com.android.chrome track (dumpsys media.audio_flinger)', uids.some((u) => new RegExp(`\\byes\\s+\\d+/\\s*${u}\\b`).test(flinger)));
  };
  const vibrations = () => (adb('shell', 'dumpsys', 'vibrator_manager').match(/com\.android\.chrome/g) || []).length;

  for (const name of names) {
    console.log(`\n▶ ${name}`);
    const out = `${ROOT}test-results/phone/${name}`;
    rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
    let n = 0;
    const shot = (label) => device.screenshot({ path: `${out}/${String(n++).padStart(2, '0')}-${label}.png` });
    const before = { errors: errors.length, requests: requests.length, results: results.length };
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' }); await run(800);
    await declinePrompts();
    try {
      const { default: scenario } = await import(`${ROOT}test/phone/${name}.js`);
      await scenario({ page, device, adb, touch, btn, swipe, type, shot, run, seed, check, checkSound, vibrations, declinePrompts });
    } catch (e) {
      errors.push(`scenario ${name}: ${e.message.split('\n').filter((l) => !/^Call log:|^\s*$/.test(l)).slice(0, 2).join(' ')}`);
      await shot('failed').catch(() => {});
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
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
  for (const f of cleanup) await Promise.resolve().then(f).catch((e) => console.error('cleanup:', e.message));
}
process.exit(failed ? 1 : 0);
