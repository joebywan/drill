// No network. Run it against the live site (the page is served from GitHub Pages with max-age=600 and no service worker):
//   npm run phone -- offline-all --url https://knowhowit.com.au/wingbeat/
// Against this checkout (no --url), adb reverse still reaches the page with airplane mode on, so its requests are refused
// by Playwright instead (OFFLINE_WAIT_SECS=0 then: the cache rounds mean nothing).
// One lesson played online, then airplane mode on: carry on in the open page (a lesson, a lazy-loaded game); reload; open
// the site in a new tab; each right after the load (the files are fresh in Chrome's cache) and again after more than ten
// minutes (they are not). Nothing is fixed or built: this says what there is. Then the installed app, which carries its own
// files, the same way. OFFLINE_WAIT_SECS (default 650) is the wait for the cache to go stale; 0 skips the second round.
import { existsSync, readFileSync } from 'node:fs';
import { answerCoding } from './coding-all.js';
import { sleep, stateOf, within } from './lib/device.js';
import { playMaths } from './lib/seed.js';

const maths = JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url))).units[0].lessons[0];
const coding = JSON.parse(readFileSync(new URL('../../src/data/coding.json', import.meta.url))).units[0].lessons[0];
const PKG = 'com.joebywan.wingbeat';
const APK = process.env.APP_APK || new URL('../../android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url).pathname;
const WAIT = Number(process.env.OFFLINE_WAIT_SECS ?? 650);

export default async (h) => {
  const { page, ctx, adb, attach, seed, touch, btn, shot, run, check } = h;
  const say = (m) => console.log(`  ${m}`);
  const sh = (...a) => adb('shell', ...a);
  const reach = (p) => within(p.evaluate(() => fetch(location.href, { cache: 'no-store' }).then((r) => `reached (${r.status})`, () => 'cannot reach')), 15000, 'no answer');
  const airplane = async (on) => { sh('cmd', 'connectivity', 'airplane-mode', on ? 'enable' : 'disable'); await sleep(on ? 4000 : 9000); };
  try {
    // Online: a finished lesson, and a second one begun.
    await seed();
    await touch(page.locator('[data-course="maths"]'));
    await touch(btn(`Continue · ${maths.title}`));
    await playMaths(maths, h);
    await touch(btn(/^Continue/)).catch(() => {});
    const url = page.url();
    say(`site: ${url}`);
    const savedOnline = (await stateOf(page)).saved;
    await touch(page.locator('[data-course="coding"]'));
    await touch(btn(`Continue · ${coding.title}`));
    await touch(btn('Continue', { exact: true })); // the teach card
    await shot('online-second-lesson');
    const loadedAt = Date.now();

    await airplane(true);
    const reached = await reach(page);
    say(`airplane mode: ${sh('settings', 'get', 'global', 'airplane_mode_on').trim()}; the open page: ${reached}`);
    // Served from this checkout, adb reverse still reaches it with the radio off: refuse every request here instead, as no
    // connection would (the HTTP cache is not consulted then, so the reload and new-tab rounds say nothing about it).
    if (/^reached/.test(reached)) { await ctx.route('**/*', (r) => r.abort('internetdisconnected')); say(`a local page: its requests refused while "offline"; the open page: ${await reach(page)}`); }

    // 1. Carry on in the open page.
    for (const item of coding.items.slice(1, 4)) { // three builds, by taps, offline
      await answerCoding({ page, tap: touch, btn }, item);
      await page.locator('.foot.show').waitFor({ timeout: 15000 });
      await touch(btn('Continue', { exact: true }));
    }
    await shot('offline-open-page-carried-on');
    // The rest of the lesson and its end screen.
    for (const item of coding.items.slice(4)) {
      if (item.type !== 'teach') await answerCoding({ page, tap: touch, btn }, item);
      await page.locator('.foot.show').waitFor({ timeout: 15000 });
      await touch(btn('Continue', { exact: true }));
    }
    await shot('offline-lesson-end');
    check('offline, the open page: the lesson reaches its end screen', await page.locator('.summary').count() === 1);
    await touch(btn('Continue', { exact: true })).catch(() => {});
    const savedOffline = await page.evaluate(() => localStorage.getItem('wingbeat.progress'));
    check('offline: the finished lesson is saved (the page keeps it in the phone)', JSON.parse(savedOffline).done['coding:steps-0'] === true);
    // A thing loaded on demand, the first time it is asked for.
    await touch(page.locator('[data-course="chess"]'));
    const mate = page.locator('[data-game="mate"]');
    if (await mate.count()) {
      await touch(mate); await run(1500); await shot('offline-mate-game');
      say(`offline, a lazily loaded game (Mate): ${await page.locator('.foot, .board').count() ? 'something drew' : 'nothing drew'}; text: ${(await page.locator('#app').innerText()).replace(/\s+/g, ' ').slice(0, 120)}`);
      const said = await page.locator('#said').innerText();
      check('offline, Mate: Rosa says there is no connection, and the banner offers Try again', /no connection/.test(said) && await btn('Try again').isVisible(), said);
      await touch(btn('Try again')); await run(1500); await shot('offline-mate-again');
      check('offline, Mate: Try again with still no connection says so again, nothing broken', /no connection/.test(await page.locator('#said').innerText()) && !(await page.locator('.stage button').count()));
      await touch(btn('Quit lesson'));
    } else say('offline: no Mate game on chess home to open');

    // 2. Reload, 3. a new tab: right after the load, then once the cache has gone stale.
    const rounds = [['fresh cache', 0], ...(WAIT ? [['stale cache', Math.max(0, WAIT - (Date.now() - loadedAt) / 1000)]] : [])];
    for (const [label, wait] of rounds) {
      if (wait) { say(`waiting ${Math.round(wait)} s for the cache to go stale…`); await sleep(wait * 1000); }
      let reloaded;
      try { await page.reload({ waitUntil: 'load', timeout: 25000 }); reloaded = 'loaded'; } catch (e) { reloaded = `failed: ${e.message.split('\n')[0]}`; }
      await sleep(1500); await shot(`offline-reload-${label.replace(' ', '-')}`);
      const text = await within(page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)), 8000, '(no answer)');
      say(`${label}, reload: ${reloaded}; page says: ${text}`);
      let fresh;
      try {
        const p2 = await ctx.newPage();
        try { await p2.goto(url, { waitUntil: 'load', timeout: 25000 }); fresh = 'loaded'; } catch (e) { fresh = `failed: ${e.message.split('\n')[0]}`; }
        await sleep(1500); await shot(`offline-newtab-${label.replace(' ', '-')}`);
        const t2 = await within(p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)), 8000, '(no answer)');
        say(`${label}, new tab: ${fresh}; page says: ${t2}`);
        if (fresh === 'loaded') {
          const saved = await within(p2.evaluate(() => localStorage.getItem('wingbeat.progress')), 5000);
          check(`${label}, new tab: the learner's progress is there`, !!saved && JSON.parse(saved).done['coding:steps-0'] === true);
        }
        await p2.close();
      } catch (e) { say(`${label}, new tab: ${e.message.split('\n')[0]}`); }
    }

    // Back online: nothing the learner did is gone.
    await airplane(false);
    await ctx.unroute('**/*');
    await page.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch((e) => say(`back online, reload: ${e.message.split('\n')[0]}`));
    await run(800);
    const back = await stateOf(page);
    say(`back online: ${back.saved ? `progress has ${Object.keys(JSON.parse(back.saved).done).length} finished lessons (was ${Object.keys(JSON.parse(savedOnline).done).length} when the network went)` : 'no progress read'}`);
    check('back online: the lessons finished online and offline are both kept', !!back.saved && JSON.parse(back.saved).done['coding:steps-0'] === true && Object.keys(JSON.parse(back.saved).done).length >= Object.keys(JSON.parse(savedOnline).done).length + 1);
  } finally { await airplane(false).catch(() => {}); await ctx.unroute('**/*').catch(() => {}); }

  // The installed app carries its own files.
  if (!existsSync(APK)) { say(`no APK at ${APK}: build it first`); return; }
  adb('install', '-r', APK);
  sh('am', 'start', '-W', '-n', `${PKG}/.MainActivity`); await sleep(2500);
  const app = await attach(PKG);
  await app.seed();
  await airplane(true);
  try {
    await app.touch(app.page.locator('[data-course="coding"]'));
    await app.touch(app.btn(`Continue · ${coding.title}`));
    await app.touch(app.btn('Continue', { exact: true }));
    for (const item of coding.items.slice(1, 3)) {
      await answerCoding({ page: app.page, tap: app.touch, btn: app.btn }, item);
      await app.page.locator('.foot.show').waitFor({ timeout: 15000 });
      await app.touch(app.btn('Continue', { exact: true }));
    }
    await app.shot('app-offline-lesson');
    check('app, offline: items play', await app.page.locator('.tiles').count() === 1);
    const before = await stateOf(app.page);
    let reloaded;
    try { await app.page.reload({ waitUntil: 'load', timeout: 25000 }); reloaded = 'loaded'; } catch (e) { reloaded = `failed: ${e.message.split('\n')[0]}`; }
    await sleep(1500); await app.shot('app-offline-reload');
    say(`app, offline, reload: ${reloaded}; page: ${(await within(app.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 100)), 8000, '(no answer)'))}`);
    check('app, offline: it reloads and keeps the learner\'s progress', reloaded === 'loaded' && (await stateOf(app.page)).saved === before.saved);
    sh('am', 'force-stop', PKG); sh('am', 'start', '-W', '-n', `${PKG}/.MainActivity`); await sleep(3500);
    const cold = await attach(PKG).catch((e) => ({ err: e.message }));
    say(`app, offline, cold start: ${cold.err ? `could not attach: ${cold.err.split('\n')[0]}` : 'came up'}`);
    await shot('app-offline-cold');
  } finally { await airplane(false).catch(() => {}); }
};
