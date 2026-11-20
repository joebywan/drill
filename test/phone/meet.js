// "Meet Fennel", the JavaScript course's first screen, opened again and again by the routes a person takes, looking
// each time for its big green button drawn without its words (seen in Firefox for Android, never reproduced): the
// button's pixels on screen against the label the page says it has. Made for `--browser firefox`; runs in Chrome too.
//   MEET_REPS=2 ...          each route twice as often (default 1: 102 visits, 3 looks each)
//   MEET_SMALL=1080x1700 ... on a short phone; PHONE_FONT=2.0 for large text
// Every look goes to test-results/phone/meet/looks.json; a blank one keeps its picture, the page's state, the
// computed styles of the button and its ancestors and the animations running, beside it.
import { readFileSync, writeFileSync } from 'node:fs';
import { playMaths } from './lib/seed.js';

const OUT = new URL('../../test-results/phone/meet/', import.meta.url).pathname;
const maths = JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url))).units[0].lessons[0];
const COURSES = ['chess', 'maths', 'japanese', 'coding', 'javascript', 'typescript', 'testing'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (h) => {
  const { page, adb, touch, btn, shot, seed, run, grab, check, origin, dpr, swipe, calibrate, pkg } = h;
  const times = (n) => Math.ceil(n * (Number(process.env.MEET_REPS) || 1)); // MEET_REPS=0.1 for a quick try
  const small = process.env.MEET_SMALL;
  if (small) { adb('shell', 'wm', 'size', small); await run(1500); await calibrate(); }
  const looks = [];
  let blank = 0;
  const go = page.locator('.meet ~ .cta [data-go]');

  /** Fennel not met yet, Learning showing `course`, the lesson's own coach screens on (no WINGBEAT_PLAIN). */
  const ready = async (course = 'javascript') => {
    await page.evaluate((c) => localStorage.setItem('wingbeat.course', c), course);
    await seed({ met: Object.fromEntries(COURSES.filter((c) => c !== 'javascript').map((c) => [c, true])) });
    await plain(false);
  };
  const plain = (on) => page.evaluate((v) => { window.WINGBEAT_PLAIN = v; }, on);
  /** A tap with no waiting, so a look can catch the screen as it comes in. */
  const tapNow = async (loc) => {
    await loc.first().scrollIntoViewIfNeeded();
    const b = await loc.first().boundingBox();
    adb('shell', 'input', 'tap', String(Math.round(origin.x + (b.x + b.width / 2) * dpr)), String(Math.round(origin.y + (b.y + b.height / 2) * dpr)));
  };
  /** The button as drawn: the share of its pixels unlike its background (its words), and what the page says of it. */
  const look = async (route, when) => {
    const screen = grab();
    const state = await page.evaluate(() => {
      const b = document.querySelector('.meet ~ .cta [data-go]');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const styles = [];
      for (let e = b; e && e !== document.documentElement; e = e.parentElement) {
        const s = getComputedStyle(e);
        styles.push({ el: `${e.tagName.toLowerCase()}.${e.className}`, color: s.color, background: s.backgroundColor, opacity: s.opacity, visibility: s.visibility, transform: s.transform, font: `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, textIndent: s.textIndent, overflow: s.overflow, position: s.position, contain: s.contain, willChange: s.willChange, filter: s.filter });
      }
      const range = document.createRange(); range.selectNodeContents(b);
      const t = range.getBoundingClientRect();
      return {
        text: b.textContent, box: { x: r.x, y: r.y, width: r.width, height: r.height }, textBox: { x: t.x, y: t.y, width: t.width, height: t.height },
        styles, scrollY, innerHeight, visual: [visualViewport.height, visualViewport.offsetTop],
        animations: document.getAnimations().map((a) => `${a.animationName ?? a.id ?? ''} ${a.playState} ${a.effect?.target?.tagName?.toLowerCase() ?? ''}.${a.effect?.target?.getAttribute?.('class') ?? ''}`),
        fonts: document.fonts.status, hidden: document.hidden,
      };
    }).catch((e) => ({ error: e.message }));
    if (!state?.box) { looks.push({ route, when, state }); return; }
    const x0 = Math.round(origin.x + state.box.x * dpr) + 6, y0 = Math.round(origin.y + state.box.y * dpr) + 6;
    const x1 = Math.round(origin.x + (state.box.x + state.box.width) * dpr) - 6, y1 = Math.round(origin.y + (state.box.y + state.box.height) * dpr) - 6;
    const count = new Map();
    const px = [];
    for (let y = Math.max(0, y0); y < Math.min(screen.height, y1); y += 2) for (let x = Math.max(0, x0); x < Math.min(screen.width, x1); x += 2) {
      const c = screen.at(x, y); px.push(c);
      const k = c.join(); count.set(k, (count.get(k) ?? 0) + 1);
    }
    const bg = [...count].sort((a, b) => b[1] - a[1])[0]?.[0].split(',').map(Number) ?? [0, 0, 0];
    const ink = px.filter((c) => Math.hypot(c[0] - bg[0], c[1] - bg[1], c[2] - bg[2]) > 80).length / Math.max(1, px.length);
    const row = { route, when, ink: +ink.toFixed(4), bg: `rgb(${bg})`, text: state.text, at: new Date().toISOString() };
    looks.push(row);
    if (state.text.trim() && ink < 0.004) {
      blank++;
      const name = `blank-${blank}-${route}-${when}`;
      await shot(name);
      writeFileSync(`${OUT}${name}.json`, JSON.stringify({ ...row, state }, null, 1));
      console.log(`  BLANK: ${route} ${when}: ink ${ink} with text "${state.text}"`);
    }
  };
  /** Opens the screen by `open`, looks as it comes in (0.15 s, 0.6 s) and once it has settled (2 s), and goes back home. */
  const visit = async (route, open, back = true) => {
    const t = Date.now();
    await open();
    for (const at of [150, 600, 2000]) { await sleep(Math.max(0, at - (Date.now() - t))); await look(route, `${at}ms`); }
    if (!(await go.count())) { await shot(`${route}-not-meet`); throw new Error(`${route}: the Meet screen did not open`); }
    if (back) await backHome();
  };
  /** ← back to home; again if the tap went missing (the first one after the browser comes back to the front can). */
  const backHome = async () => {
    for (let i = 0; i < 3 && !(await page.locator('.home').count()); i++) {
      await touch(page.locator('.bar .back'));
      await page.locator('.home').waitFor({ timeout: 4000 }).catch(() => {});
    }
    await page.locator('.home').waitFor();
  };
  const cont = () => page.getByRole('button', { name: /^Continue · / });

  try {
    // 1. From home, JavaScript showing: Continue, then ← back home, again and again.
    await ready();
    for (let i = 0; i < times(45); i++) await visit('home', () => tapNow(cont()));
    await shot('home-route');

    // 2. After switching course: from Chess, tap JavaScript, then Continue.
    for (let i = 0; i < times(20); i++) {
      await touch(page.locator('[data-course="chess"]'));
      await visit('switch', async () => { await touch(page.locator('[data-course="javascript"]')); await tapNow(cont()); });
    }

    // 3. Straight after the page loads (a cold page: reload, then Continue at once).
    for (let i = 0; i < times(10); i++) await visit('reload', async () => { await page.reload(); await page.evaluate(() => { window.WINGBEAT_PLAIN = false; }); await tapNow(cont()); });

    // 4. Scrolling as it appears: a finger flick up the page the moment it opens.
    for (let i = 0; i < times(10); i++) {
      await visit('scrolling', async () => {
        await tapNow(cont()); await sleep(80);
        adb('shell', 'input', 'swipe', '540', '1600', '540', '900', '150');
      });
    }

    // 5. The browser in the background and back: on the Meet screen itself, and on home before opening it.
    const away = async () => {
      adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(3000);
      adb('shell', `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1`); await sleep(1500);
    };
    for (let i = 0; i < times(8); i++) {
      await visit('background-on-meet', async () => { await tapNow(cont()); await sleep(1200); await away(); }, false);
      await look('background-on-meet', 'back+4s');
      await backHome();
    }
    for (let i = 0; i < times(7); i++) { await away(); await visit('background-then-open', () => tapNow(cont())); }

    // 6. After a lesson: a Maths lesson played to its end, then JavaScript's Continue.
    for (let i = 0; i < times(2); i++) {
      await ready('maths'); await plain(true); // the lesson as written, no echoes
      await touch(btn(`Continue · ${maths.title}`));
      await playMaths(maths, h);
      for (let k = 0; k < 4 && !(await page.locator('.home').count()); k++) await touch(btn('Continue', { exact: true }));
      await run(3000); await plain(false);
      await touch(page.locator('[data-course="javascript"]'));
      await visit('after-lesson', () => tapNow(cont()));
    }
  } finally {
    writeFileSync(`${OUT}looks.json`, JSON.stringify(looks, null, 1));
    if (small) { adb('shell', 'wm', 'size', 'reset'); await run(1500); await calibrate(); }
  }
  const drawn = looks.filter((l) => l.ink !== undefined);
  const ink = drawn.map((l) => l.ink).sort((a, b) => a - b);
  console.log(`  ${drawn.length} looks at the button, ink from ${ink[0]} to ${ink.at(-1)}, median ${ink[ink.length >> 1]}; ${looks.length - drawn.length} with no button`);
  check(`Meet Fennel: the button's words drawn in every look (${drawn.length})`, blank === 0, `${blank} blank`);
};
