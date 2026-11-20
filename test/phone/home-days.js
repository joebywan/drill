// Home at the top of the page for a learner brand new (day 0), and 1, 7, 30 and 60 days in: Learning with Chess, with
// Maths, Calm and a one-tap habit (Walk). Prints, for each, where the first unit's title and the next lesson's node
// start and the page's height, in CSS px. HOME_SMALL=1080x1700 plays it on a short phone (a 412x533 page).
import { atTop, daysIn, showTab } from './lib/seed.js';

const DAYS = [0, 1, 7, 30, 60];
const TABS = [['chess', 'learn', 'chess'], ['maths', 'learn', 'maths'], ['calm', 'calm'], ['walk', 'walk']];

export default async ({ page, seed, touch, shot, check, adb, calibrate, run }) => {
  const small = process.env.HOME_SMALL;
  if (small) { adb('shell', 'wm', 'size', small); await run(1500); await calibrate(); }
  const rows = [];
  try {
    for (const d of DAYS) {
      await seed(daysIn(d));
      for (const [name, tab, course] of TABS) {
        await showTab({ page, touch }, tab);
        if (course) { await touch(page.locator(`[data-course="${course}"]`)); await page.locator(`[data-course="${course}"][aria-pressed="true"]`).waitFor(); }
        await atTop(page);
        const at = await page.evaluate(() => {
          const y = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? Math.round(r.top + scrollY) : null; };
          return { unit: y('.street h2'), here: y('.node.here'), height: innerHeight, width: innerWidth };
        });
        check(`day ${d}, ${name}: home drew`, await page.locator('.garden-link').count() === 1);
        rows.push({ state: `day ${d} ${name}`, ...at });
        await shot(`day${d}-${name}`);
      }
    }
  } finally {
    if (small) { adb('shell', 'wm', 'size', 'reset'); await run(1500); await calibrate(); }
  }
  console.log('\nstate            unit h2   .here   page');
  for (const r of rows) console.log(`${r.state.padEnd(16)} ${String(r.unit ?? '-').padStart(7)} ${String(r.here ?? '-').padStart(7)}   ${r.width}x${r.height}`);
};
