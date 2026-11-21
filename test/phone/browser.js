// What the phone's browser itself brings to the page (made for `--browser firefox`, runs in Chrome too): its address
// bar, top or bottom and sliding away as the page scrolls, against the app's fixed bars; the phone's back button
// through nested screens (src/nav.js); swiping a box that scrolls in itself (scrollBox() in src/fit.js) and the page
// behind it; pull to refresh at the top of home and mid-lesson. Prints what it measures; checks what must hold.
// In Firefox run it with its toolbar as it ships, sliding away: `PHONE_TOOLBAR=hides npm run phone -- --browser firefox browser`.
import { readFileSync } from 'node:fs';
import { withCheckpoint } from '../../src/repeat.js';
import testing from '../../src/code/courses/testing.js';
import { playCourse } from '../../tools/play.js';
import { answerCode } from './code-all.js';
import { thirtyDays } from './lib/seed.js';

const maths = JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url))).units[0].lessons[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (h) => {
  const { page, adb, touch, btn, shot, seed, run, check, screenAt, uiNodes, screenXml, pkg } = h;
  const sh = (cmd) => adb('shell', cmd);
  const loads = () => page.loads?.() ?? null; // the bridge counts the pages that loaded
  // A reload nobody asked for, in any mode: a mark left on the page is gone.
  const mark = () => page.evaluate(() => { window.__still = true; });
  const reloaded = async () => !(await page.evaluate(() => window.__still === true).catch(() => false));
  const front = () => new RegExp(`mCurrentFocus=.*${pkg.replaceAll('.', '\\.')}`).test(sh('dumpsys window | grep mCurrentFocus'));
  /** The browser's address bar on screen (the node showing the page's host), or null when it has slid away. */
  const bar = async () => {
    const n = uiNodes(await screenXml()).find((x) => !x.page && /localhost:\d+/.test(x.text + x.desc));
    return n ? n.box : null;
  };
  /** Where `loc` is on the screen, in screen pixels: from the page's view as the screen has it now (a toolbar that slid away moved it). */
  const onScreen = async (loc) => {
    const b = await loc.first().boundingBox();
    if (!b) return null;
    const view = uiNodes(await screenXml()).find((x) => x.page)?.box.top;
    const [, top] = screenAt(0, b.y), [, bottom] = screenAt(0, b.y + b.height), shift = view === undefined ? 0 : view - screenAt(0, 0)[1];
    return { top: top + shift, bottom: bottom + shift };
  };
  const [, H] = sh('wm size').match(/(\d+)x(\d+)\s*$/).slice(1).map(Number);
  /** A real finger drag, screen pixels. */
  const drag = async (x, y0, y1, ms = 400) => { sh(`input swipe ${x} ${Math.round(y0)} ${x} ${Math.round(y1)} ${ms}`); await sleep(900); };
  const fixedClear = async (where, loc) => {
    const [b, c] = [await bar(), await onScreen(loc)];
    console.log(`  ${where}: address bar ${b ? `${b.top}-${b.bottom}` : 'hidden'}, ${await loc.first().textContent().catch(() => '?')} at ${c ? `${Math.round(c.top)}-${Math.round(c.bottom)}` : 'none'} of ${H}`);
    if (b && c) check(`${where}: the address bar is clear of the app's bottom button`, c.bottom <= b.top || c.top >= b.bottom, `bar ${b.top}-${b.bottom}, button ${Math.round(c.top)}-${Math.round(c.bottom)}`);
    if (c) check(`${where}: the bottom button sits in the thumb's reach (lower third)`, c.top > H * 0.6, `${Math.round(c.top)} of ${H}`);
  };

  // 0. What this browser offers the app: haptics, keeping the screen on, a voice (src/feel.js, src/practice/kit.js).
  await seed(thirtyDays(1));
  const apis = await page.evaluate(async () => {
    const lock = navigator.wakeLock ? await navigator.wakeLock.request('screen').then((l) => { l.release(); return 'granted'; }, (e) => `refused: ${e.name}`) : 'missing';
    const voices = typeof speechSynthesis === 'undefined' ? null : await new Promise((r) => { const v = speechSynthesis.getVoices(); if (v.length) r(v); else { speechSynthesis.onvoiceschanged = () => r(speechSynthesis.getVoices()); setTimeout(() => r(speechSynthesis.getVoices()), 3000); } });
    return { vibrate: typeof navigator.vibrate, vibrateAnswers: navigator.vibrate?.(1) ?? null, wakeLock: lock, speech: voices === null ? 'missing' : `${voices.length} voices${voices.some((v) => /^ja/.test(v.lang)) ? ', Japanese among them' : ''}`, persist: !!navigator.storage?.persist };
  });
  console.log(`  this browser offers: ${JSON.stringify(apis)}`);

  // 1. The address bar against the app's fixed bars: home at the top and scrolled, a lesson, its verdict.
  const cont = page.getByRole('button', { name: /^Continue · / });
  const top = await bar();
  console.log(`  address bar at ${top ? `${top.top}-${top.bottom} (${top.top > H / 2 ? 'bottom' : 'top'})` : 'not found'}; page origin ${screenAt(0, 0).map(Math.round)}`);
  await shot('home-top'); await fixedClear('home at the top', cont);
  await drag(540, H * 0.7, H * 0.3); await drag(540, H * 0.7, H * 0.3);
  await shot('home-scrolled'); await fixedClear('home scrolled down', cont);
  await drag(540, H * 0.4, H * 0.6); await shot('home-scrolled-back');
  await page.evaluate(() => localStorage.setItem('wingbeat.course', 'maths'));
  await seed();
  await touch(btn(`Continue · ${maths.title}`)); await shot('lesson');
  for (const i of maths.items) { if (i.type !== 'teach') break; await touch(btn('Continue', { exact: true })); }
  await shot('lesson-item');
  await touch(page.locator('.choices button').first()); await page.locator('.foot.show').waitFor();
  await shot('lesson-verdict'); await fixedClear('a lesson\'s verdict', page.locator('.foot .next'));

  // 2. Pull to refresh: a finger pulled down from the top of the page, mid-lesson and on home.
  const pull = async (where) => {
    await mark();
    await page.evaluate(() => scrollTo(0, 0)); await sleep(500);
    await drag(540, screenAt(0, 40)[1], screenAt(0, 380)[1], 600); await sleep(2500);
    const again = await reloaded();
    console.log(`  pull to refresh ${where}: ${again ? 'the page RELOADED' : 'no reload'}`);
    await shot(`pull-${where}`);
    return again;
  };
  const reloadedMid = await pull('mid-lesson');
  check('pull to refresh mid-lesson leaves the lesson where it was', !reloadedMid);
  if (reloadedMid) {
    // What a fix would rest on: does this browser keep pull to refresh off the root that says overscroll-behavior: none?
    await touch(btn(`Continue · ${maths.title}`));
    await page.evaluate(() => { document.documentElement.style.overscrollBehaviorY = 'none'; });
    console.log(`  with overscroll-behavior-y: none on the root: ${(await pull('mid-lesson-none')) ? 'still reloads' : 'no reload'}`);
  }
  await seed(thirtyDays(1));
  console.log(`  (home) ${(await pull('home')) ? 'pull to refresh reloads home' : 'no reload on home'}`);

  // 3. The phone's back button through nested screens, then out of the app from home.
  await seed(thirtyDays(1));
  const back = async () => { sh('input keyevent KEYCODE_BACK'); await sleep(1200); await page.clock.runFor(500).catch(() => {}); };
  const where = () => page.evaluate(() => ({ screen: document.querySelector('#app > main, #app > div')?.className ?? '', h1: document.querySelector('h1')?.textContent ?? '', depth: history.state?.depth ?? 0, length: history.length })).catch(() => null);
  const trail = [];
  const step = async (label) => { const w = await where(); trail.push({ label, ...w }); console.log(`  back: ${label}: ${JSON.stringify(w)}`); return w; };
  await step('home');
  await touch(btn('Settings')); await step('settings'); await back();
  check('back from Settings lands on home', (await step('after back'))?.screen.includes('home'));
  await touch(btn(/^Your garden/)); await touch(btn('Field guide')); await touch(page.locator('[data-species]').first()); await step('species');
  await back(); await step('back 1'); await back(); await step('back 2'); await back();
  check('back three times from a species page lands on home', (await step('back 3'))?.screen.includes('home'));
  await touch(btn(/^Continue · /)); await step('lesson'); await shot('back-lesson');
  await back(); await shot('back-from-lesson');
  check('back from a lesson closes it', (await step('back from lesson'))?.screen.includes('home'));
  if (h.browser === 'chrome') console.log('  back on home: not played in Chrome through Playwright, where leaving the page would leave the page it drives behind (bridged browsers play it)');
  else {
  const pages = loads();
  await back(); await shot('back-from-home');
  const left = !front() || pages !== loads();
  console.log(`  back on home: ${front() ? 'the browser is still in front' : 'the browser went to the background'}${pages !== loads() ? ', and the page loaded again' : ''}`);
  check('back on home leaves the app (as the wrapper does)', left);
  // Back to the app as a person would: its address opened again (the tab may be gone), and wait for it to load.
  const n = loads();
  sh(`am start -a android.intent.action.VIEW -d ${page.url()} ${pkg}`);
  for (let i = 0; i < 30 && n !== null && loads() === n; i++) await sleep(1000);
  await sleep(2000);
  }

  // 4. A box that scrolls in itself, on a short phone: a Test writing lesson with the longest code under test (unit 4, tl-2).
  let probed = false;
  const probe = async () => {
    if (probed || !(await page.locator('.scrolls.more-below').count())) return;
    probed = true;
    const box = page.locator('.scrolls.more-below').first();
    const b = await box.boundingBox();
    const [cx, mid] = screenAt(b.x + b.width / 2, b.y + b.height / 2), x = Math.round(cx), reach = (screenAt(0, b.height)[1] - screenAt(0, 0)[1]) * 0.35;
    const state = () => page.evaluate(() => ({ box: document.querySelector('.scrolls')?.scrollTop, page: scrollY }));
    const s0 = await state();
    await mark();
    await shot('box-before');
    await drag(x, mid + reach, mid - reach); const s1 = await state(); await shot('box-swiped');
    for (let i = 0; i < 3; i++) await drag(x, mid + reach, mid - reach);
    const s2 = await state(); await shot('box-past-its-end');
    for (let i = 0; i < 4; i++) await drag(x, mid - reach, mid + reach);
    const s3 = await state(); await shot('box-pulled-past-its-top');
    console.log(`  scroll box ${await box.evaluate((e) => e.className)}: ${JSON.stringify([s0, s1, s2, s3])}`);
    check('a finger scrolls the box', s1.box > s0.box);
    check('swiping past the box\'s end leaves the page behind it put', s2.page === s1.page, `${s1.page} -> ${s2.page}`);
    const again = await reloaded();
    check('pulling past the box\'s top neither moves nor reloads the page', s3.page === s2.page && !again, `${s2.page} -> ${s3.page}${again ? ', reloaded' : ''}`);
  };
  const course = { id: 'testing', units: testing.units.map(withCheckpoint) };
  // Here only to reach a box that scrolls: only the topic line is checked as a part, so this lesson's layout is left to code-all (CODE_SMALL=1080x1700),
  // which reports it (on this short phone the verdict covers .code-program after an answer, in Chrome and Firefox alike).
  await playCourse(h, { course, unit: 4, only: ['tl-2'], small: '1080x1700', parts: ['.topic'], tray: [],
    answer: async (hh, it) => { await probe(); return answerCode(hh, it); } });
  if (!probed) console.log('  no box scrolled in itself in that lesson');
  await run(500);
};
