// The phone on its side (about 915 x 330 CSS px): home on each tab for someone a month in, the garden, Settings, a Calm
// routine running and ended, and one lesson of each course played by real taps (tools/play.js reports what is covered,
// clipped or off the screen; each screen is also audited for buttons a person cannot reach). Shared by landscape-all
// (Chrome) and landscape-app-all (the installed app). Leaves the phone upright.
import { answerCoding, course as coding } from '../coding-all.js';
import chess from '../chess-all.js';
import code from '../code-all.js';
import maths from '../maths-all.js';
import { playCourse } from '../../../tools/play.js';
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
  process.env.PLAY_SHOTS = '1';
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

    // A Calm routine, running and ended.
    await showTab(h, 'calm');
    await touch(btn(/^Continue · /)); await look(h, 'calm-teach', notes);
    await touch(btn('Start')); await run(1500); await look(h, 'calm-running', notes);
    for (let i = 0; i < 12 && !(await page.locator('.summary').count()); i++) await run(30000);
    await look(h, 'calm-end', notes);

    // One lesson of each course, played through.
    await page.evaluate(() => localStorage.setItem('wingbeat.habit', 'learn')); // home shows Learning again, where the courses are
    const env = (o) => { for (const [k, v] of Object.entries(o)) process.env[k] = v; };
    const unitOf = (id) => coding.units.findIndex((u) => u.lessons.some((l) => l.id === id)) + 1;
    for (const id of light ? ['steps-0'] : ['steps-0', 'draw-0']) await playCourse(h, { course: coding, unit: unitOf(id), only: [id], answer: answerCoding });
    if (!light) { env({ CODE_COURSE: 'javascript', CODE_UNIT: '1', CODE_LESSONS: 'jsv-1' }); await code(h); }
    env({ MATHS_UNIT: '1', MATHS_LESSONS: 'ten-0' }); await maths(h);
    if (!light) { env({ CHESS_UNIT: '1', CHESS_LESSONS: 'board-0' }); await chess(h); }
  } finally {
    await turn(h, 'portrait');
  }
  return notes;
};
