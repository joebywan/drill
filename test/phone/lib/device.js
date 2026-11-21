// Shared by the device-condition scenarios (landscape, away, interrupted, moving, offline): what a phone in a hand
// does that a phone on a test bench does not. Not a scenario itself.
import { mkdirSync, writeFileSync } from 'node:fs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** `p`, or `fallback` if it has not settled in `ms`: a page Chrome froze while another app was in front never answers. */
export const within = (p, ms, fallback = null) => Promise.race([p, sleep(ms).then(() => fallback)]);
const CHROME = 'com.android.chrome';

/** Turns the phone to 'landscape' or 'portrait' (auto-rotate off, the user's rotation set), then measures the page again. */
export async function turn({ adb, run, calibrate }, to) {
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
  adb('shell', 'settings', 'put', 'system', 'user_rotation', to === 'landscape' ? '1' : '0');
  await sleep(2500); await run(1000);
  await calibrate();
}

/** What is wrong with the screen for a person using it: buttons that cannot be reached, bars covering work, sideways overflow. */
export const audit = (page) => page.evaluate(() => {
  const app = document.getElementById('app');
  const name = (e) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/)[0]}` : ''} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 24)}"`;
  const shown = (e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && !e.closest('.visually-hidden'); };
  const fixed = [...app.querySelectorAll('*')].filter((e) => getComputedStyle(e).position === 'fixed' && shown(e)).map((e) => ({ n: name(e), r: e.getBoundingClientRect() }));
  const barPx = fixed.reduce((t, f) => t + (f.r.height < innerHeight * 0.8 ? f.r.height : 0), 0);
  const unreachable = [];
  const y0 = scrollY;
  for (const e of app.querySelectorAll('button, a, input, [role="button"]')) {
    if (!shown(e)) continue;
    e.scrollIntoView({ block: 'center', inline: 'center' });
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!hit || !(e === hit || e.contains(hit) || hit.contains(e))) unreachable.push(`${name(e)} is under ${hit ? name(hit) : 'nothing'}`);
    else if (r.bottom > innerHeight + 1 || r.top < -1) unreachable.push(`${name(e)} is off the screen at its best scroll`);
  }
  scrollTo(0, y0);
  return { page: `${innerWidth}x${innerHeight}`, scrollH: document.documentElement.scrollHeight, over: document.documentElement.scrollWidth - innerWidth, fixed: fixed.map((f) => `${f.n} ${Math.round(f.r.height)}px`), barPx: Math.round(barPx), barShare: +(barPx / innerHeight).toFixed(2), unreachable };
});

/** The wake-lock evidence, three ways: the page's own flag, Android's power service, and the window flag. Raw lines are kept. */
export async function awake({ page, adb }, notes, label) {
  const html = !page ? null : await within(page.evaluate(() => document.documentElement.hasAttribute('data-awake')), 3000, 'frozen');
  const power = adb('shell', 'dumpsys', 'power');
  const locks = power.split('\n').filter((l) => /WakeLock|WAKE_LOCK/.test(l) && !/^\s*Wake Locks: size/.test(l)).map((l) => l.trim());
  const win = adb('shell', 'dumpsys', 'window').split('\n').filter((l) => /keepScreenOn|KEEP_SCREEN_ON|mHoldScreen/i.test(l)).map((l) => l.trim());
  const screen = (power.match(/mWakefulness=(\w+)/) || [])[1];
  mkdirSync(notes, { recursive: true });
  writeFileSync(`${notes}/awake-${label}.txt`, `page data-awake: ${html}\nwakefulness: ${screen}\n--- power wake locks\n${locks.join('\n')}\n--- window\n${win.join('\n')}\n`);
  const held = locks.filter((l) => /SCREEN_BRIGHT|FULL_WAKE|SCREEN_DIM/.test(l));
  return { html, screen, held: held.length, win: win.length, locks };
}

/** Sends Chrome (or `pkg`) away with Home, waits `secs` of real time, and brings it back. `during` runs while it is away. */
export async function putDown({ adb }, secs, during = async () => {}, pkg = CHROME) {
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(1500);
  await during(); await sleep(secs * 1000);
  adb('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1'); await sleep(2500);
}

/** Locks the screen (power key), waits `secs`, wakes it and dismisses the lock screen. `during` runs while it is off. */
export async function screenOff({ adb }, secs, during = async () => {}) {
  adb('shell', 'input', 'keyevent', 'KEYCODE_SLEEP'); await sleep(1500);
  await during(); await sleep(secs * 1000);
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'); await sleep(1000);
  adb('shell', 'wm', 'dismiss-keyguard'); await sleep(1500);
}

/** The page's text and the learner's saved progress, to compare before and after something happens to the phone. */
export const stateOf = (page) => within(page.evaluate(() => ({ text: document.getElementById('app').innerText, saved: localStorage.getItem('wingbeat.progress'), hidden: document.hidden })), 8000, { text: '(page did not answer)', saved: null, hidden: null });
