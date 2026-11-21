// Real swipes (adb input swipe) on the screens that scroll: home's long path for someone 60 days in, the tabs row and
// the course chips sideways, the garden, the field guide's list and a habit's week view. Each page swipe goes up and
// down again; what is checked is that the page follows, comes to rest where it stopped (nothing half-scrolled or still
// drifting), never moves sideways, keeps fixed bars on the screen, and that a swipe which begins on a button does not
// press it. (The boxes that scroll in themselves are swiped by tools/play.js with PLAY_SWIPE=1.)
// Horizontal swipes stay off the screen edges (the phone's own back gesture starts there).
import { daysIn, showTab, atTop } from './lib/seed.js';

export default async ({ page, seed, touch, btn, swipe, shot, check, adb, run, calibrate }) => {
  const state = () => page.evaluate(() => ({ y: Math.round(scrollY), x: Math.round(scrollX), max: document.documentElement.scrollHeight - innerHeight, over: document.documentElement.scrollWidth - innerWidth,
    fixed: [...document.querySelectorAll('#app *')].filter((e) => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().height > 0).every((e) => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= -1; }), where: document.querySelector('main')?.className ?? '' }));
  const rest = async () => { const a = await state(); await page.waitForTimeout(1500); const b = await state(); return { ...b, drift: b.y - a.y }; };

  /** Up three swipes, down three, from the middle of the page or from `grab` (a button): the page follows both ways. */
  const pageSwipes = async (name, grab = null) => {
    await atTop(page);
    const start = await rest();
    const ys = [start.y];
    const from = () => (grab ? page.locator(grab) : page.locator('body'));
    for (let i = 0; i < 3; i++) { await swipe(page.locator(grab && i === 0 ? grab : '#app'), 0, -420); ys.push((await rest()).y); }
    await shot(`${name}-down`);
    const bottom = await rest();
    for (let i = 0; i < 8 && ys.at(-1) > 0; i++) { await swipe(page.locator('#app'), 0, 420); ys.push((await rest()).y); } // stops at the top: a swipe down there is the pull-down below
    const top = await rest();
    await shot(`${name}-top-again`);
    check(`${name}: swiping up scrolls the page (${ys.slice(0, 4).join(' > ')} of ${start.max}px)`, start.max < 20 || ys[3] > ys[0] + 100);
    check(`${name}: swiping back reaches the top`, top.y === 0, `${top.y}px`);
    check(`${name}: nothing drifts after the finger lifts`, [bottom, top].every((s) => Math.abs(s.drift) <= 1), `${bottom.drift}, ${top.drift}`);
    check(`${name}: never sideways`, [bottom, top].every((s) => s.x === 0 && s.over <= 0), `${bottom.x}/${bottom.over}`);
    check(`${name}: fixed bars stay on the screen`, bottom.fixed && top.fixed);
    check(`${name}: still the same screen (nothing pressed)`, bottom.where === start.where && top.where === start.where, `${start.where} / ${bottom.where} / ${top.where}`);
    return { start, bottom, top };
  };
  /** A finger pulled down from the top of the page: Chrome's pull-to-refresh would reload it and lose the screen (the marker). */
  const pull = async (name) => {
    await atTop(page);
    await page.evaluate(() => { window.__marker = 'same page'; });
    await swipe(page.locator('#app'), 0, 600); await page.waitForTimeout(3000);
    check(`${name}: a pull down from the top does not reload the page`, await page.evaluate(() => window.__marker).catch(() => null) === 'same page');
    await shot(`${name}-pulled`);
  };
  /** A row sideways: it scrolls in itself, the page and the pressed button stay. */
  const rowSwipes = async (name, row, pressed) => {
    const read = () => page.evaluate(([r, p]) => ({ left: Math.round(document.querySelector(r).scrollLeft), max: document.querySelector(r).scrollWidth - document.querySelector(r).clientWidth, on: document.querySelector(p)?.getAttribute('data-path') ?? document.querySelector(p)?.getAttribute('data-course'), y: Math.round(scrollY), x: Math.round(scrollX) }), [row, pressed]);
    await atTop(page);
    const a = await read();
    await swipe(page.locator(row), -200, 0); await page.waitForTimeout(1200);
    const b = await read(); await shot(`${name}-left`);
    await swipe(page.locator(row), 200, 0); await page.waitForTimeout(1200);
    const c = await read(); await shot(`${name}-back`);
    console.log(`  ${name}: scrollLeft ${a.left} -> ${b.left} -> ${c.left} of ${a.max}; pressed ${a.on}`);
    check(`${name}: swiping left moves the row (or it fits)`, a.max <= 1 || b.left > a.left, JSON.stringify([a, b]));
    check(`${name}: swiping right brings it back`, a.max <= 1 || c.left < b.left, JSON.stringify([b, c]));
    check(`${name}: the swipe pressed nothing (${a.on} stays pressed), the page did not move`, a.on === b.on && b.on === c.on && b.y === a.y && c.x === 0, JSON.stringify([a, b, c]));
  };

  await seed(daysIn(60));
  await showTab({ page, touch }, 'learn');
  await pageSwipes('home path');
  await pageSwipes('home path from a node', '.node:not(.locked) >> nth=0');
  await pull('home');
  await rowSwipes('tabs row', '.paths', '.path-tab[aria-pressed="true"]');
  await rowSwipes('course chips', '.courses:not(.games)', '.course[aria-pressed="true"]');

  await touch(btn(/^Your garden/));
  await page.waitForTimeout(1500);
  await pageSwipes('garden');
  await pull('garden');
  await touch(btn('Field guide'));
  await pageSwipes('field guide list');
  await touch(btn('Back')); await touch(btn('Back')).catch(() => {});
  await page.waitForTimeout(800);
  await showTab({ page, touch }, 'learn');
  await touch(btn(/^Continue ·/)); await page.waitForTimeout(800);
  await pull('lesson');
  await touch(page.locator('.close, [aria-label="Close"], [aria-label="Back"]').first()).catch(() => {}); await page.waitForTimeout(800);
  await showTab({ page, touch }, 'calm');
  await touch(btn(/See your week$/));
  await pageSwipes('habit week view');
};
