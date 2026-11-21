// The phone on its side (about 866 x 308 CSS px in Chrome): home on each tab for someone a month in, the garden and
// Settings, which work on their side; then a Calm routine and a lesson of each course, which ask for the phone upright
// (docs/WINGBEAT.md: made for an upright phone) and are exactly where they were once it is (each screen is also audited for
// buttons a person cannot reach). Shared by landscape-all (Chrome) and landscape-app-all (the installed app, on a tablet:
// a phone's app stays upright). Leaves the phone upright.
import { atTop, daysIn, showTab } from './seed.js';
import { audit, turn } from './device.js';

/** Looks at the screen as it is: a picture, and the audit's numbers (what is under a bar, what cannot be reached). */
const look = async (h, name, notes) => {
  await h.shot(name);
  const a = await audit(h.page);
  console.log(`  ${name}: page ${a.page}, content ${a.scrollH}px tall, fixed bars ${a.barPx}px (${Math.round(a.barShare * 100)}% of the screen)${a.over > 0 ? `, ${a.over}px SIDEWAYS` : ''}${a.unreachable.length ? `, UNREACHABLE: ${a.unreachable.slice(0, 3).join('; ')}` : ''}`);
  h.check(`${name}: nothing sideways, every button can be reached`, a.over <= 0 && !a.unreachable.length, a.unreachable.slice(0, 2).join('; '));
  notes.push({ name, ...a });
  return a;
};

export default async (h, { notes = [], light = !!process.env.LANDSCAPE_LIGHT } = {}) => { // light: two tabs, a Coding and a Maths lesson
  const { page, touch, btn, seed, run } = h;
  await turn(h, 'landscape');
  try {
    await seed(daysIn(30));
    console.log(`  landscape page: ${await page.evaluate(() => `${innerWidth}x${innerHeight}`)}`);
    for (const tab of (await page.locator('.path-tab[data-path]').evaluateAll((t) => t.map((x) => x.dataset.path))).filter((t) => !light || ['learn', 'calm'].includes(t))) {
      await showTab(h, tab); await atTop(page);
      const here = await page.evaluate(() => { const r = document.querySelector('.node.here')?.getBoundingClientRect(); return r ? Math.round(r.top + scrollY) : null; });
      console.log(`  home ${tab}: the next lesson's node starts ${here === null ? '(none)' : `${here}px down the page`}`);
      await look(h, `home-${tab}`, notes);
      await page.evaluate(() => document.querySelector('.node.here')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(800);
      await h.shot(`home-${tab}-scrolled`);
    }
    await atTop(page);
    await touch(btn(/^Your garden/)); await run(1500); await look(h, 'garden', notes);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(600); await h.shot('garden-end');
    await touch(btn('Back'));
    await touch(btn('Settings')); await look(h, 'settings', notes); await touch(btn('Back'));

    // What a lesson or routine shows on its side: the one line, and none of the screen under it.
    const sideways = async (name) => {
      await look(h, name, notes);
      const r = await page.evaluate(() => ({ line: (() => { const u = document.querySelector('.upright'); return u && getComputedStyle(u).display !== 'none' ? u.textContent : null; })(), stage: getComputedStyle(document.querySelector('.stage')).visibility }));
      h.check(`${name}: on its side, one line asks for the phone upright, over the screen`, !!r.line && r.stage === 'hidden', JSON.stringify(r));
    };
    const where = () => page.evaluate(() => ({ topic: document.querySelector('.topic')?.textContent, said: document.querySelector('#said')?.textContent, count: document.querySelector('.count')?.textContent ?? null, paused: document.querySelector('.practice-pause')?.getAttribute('aria-pressed') ?? null }));
    // Mid-lesson the page can't be measured again (calibrate() blanks it), so these turns don't: what is done upright is
    // done with Playwright's clicks, and the touches on its side keep the origin measured on its side at the start.
    const to = (side) => turn({ adb: h.adb, run }, side);
    const upright = async (name, before) => {
      await to('portrait'); await h.shot(`${name}-upright`);
      const now = await where();
      h.check(`${name}: upright again, exactly where it was`, now.topic === before.topic && now.said === before.said && now.count === before.count, `${JSON.stringify(before)} -> ${JSON.stringify(now)}`);
      h.check(`${name}: upright again, the line is gone`, !(await page.locator('.upright').isVisible()));
      return now;
    };

    // A Calm routine: begun on its side, started upright, turned mid-breath, carried on upright, ended on its side.
    await showTab(h, 'calm');
    await touch(btn(/^Continue · /)); await sideways('calm-teach');
    await upright('calm-teach', await where());
    await btn('Start').click(); await run(1500);
    await to('landscape'); await run(1000);
    await sideways('calm-running');
    const held = await where();
    h.check('calm-running: turned on its side, the routine holds', held.paused === 'true', JSON.stringify(held));
    await run(30000);
    await upright('calm-running', held);
    await btn('Carry on').click();
    for (let i = 0; i < 12 && !(await page.locator('.summary').count()); i++) await run(30000);
    await to('landscape');
    await look(h, 'calm-end', notes); // the end screen is a reading screen: it works on its side
    await touch(btn(/^Continue/));

    // A lesson of each course, opened on its side: the line; upright, the lesson as it was; ✕ and on its side again.
    await showTab(h, 'learn');
    for (const course of light ? ['coding', 'maths'] : ['coding', 'maths', 'chess', 'javascript', 'japanese']) {
      await touch(page.locator(`[data-course="${course}"]`));
      await touch(btn(/^Continue · /)); await run(1500);
      await sideways(`${course}-lesson`);
      await upright(`${course}-lesson`, await where());
      await btn('Quit lesson').click();
      await to('landscape');
    }
  } finally {
    await turn(h, 'portrait');
  }
  return notes;
};
