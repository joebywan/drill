// What Learning's streak row shows at each stage of what Maths is raising (egg, hatchling, half-grown and full-grown
// caterpillar, chrysalis), and Calm's tab at 14 days (a chrysalis), in light and in the phone's own dark mode.
// HOME_SMALL=1080x1700 plays it on a short phone. Prints each picture's box in screen px for the notes' sheet.
import { RAISED, looks, mathsRaising, practised, showTab, atTop } from './lib/seed.js';
import { award } from '../../src/garden/model.js';
import { emptyProgress } from '../../src/progress.js';

export default async ({ page, adb, seed, touch, shot, check, calibrate, run }) => {
  const small = process.env.HOME_SMALL;
  const set = looks(adb);
  const boxes = [];
  const look = async (label) => {
    await atTop(page);
    const r = await page.evaluate(() => {
      const b = document.querySelector('.streak-row .raising')?.getBoundingClientRect();
      const l = document.querySelector('.streak-row .streak-line')?.getBoundingClientRect();
      return b && { x: b.x, y: b.y, w: b.width, h: b.height, level: l ? Math.abs((b.top + b.bottom) / 2 - (l.top + l.bottom) / 2) : null,
        name: document.querySelector('.streak-row .raising').getAttribute('aria-label'), tag: document.querySelector('.streak-row .raising').tagName, dpr: devicePixelRatio };
    });
    check(`${label}: the picture is a button named by what it raises`, !!r && r.tag === 'BUTTON' && / is raising an? /.test(r.name), r?.name);
    check(`${label}: level with the streak line`, !!r && r.level !== null && r.level <= 3, String(r?.level));
    if (r) boxes.push({ label, ...r });
    await shot(label);
  };
  const tour = async (mode) => {
    for (const stage of Object.keys(RAISED)) {
      await page.evaluate(() => localStorage.setItem('wingbeat.course', 'maths'));
      await seed(mathsRaising(stage));
      await showTab({ page, touch }, 'learn');
      await touch(page.locator('[data-course="maths"]')); await page.locator('[data-course="maths"][aria-pressed="true"]').waitFor();
      await look(`${mode}-${stage}`);
    }
    await seed(award(practised({ ...emptyProgress(), start: 'x', picked: ['calm'] }, 'calm', 14)).progress);
    await showTab({ page, touch }, 'calm');
    await look(`${mode}-calm-chrysalis`);
  };
  try {
    if (small) { adb('shell', 'wm', 'size', small); await run(1500); await calibrate(); }
    await tour('light');
    set.dark(); await page.reload();
    check("dark: the page sees the phone's night mode", await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches));
    await tour('dark');
  } finally {
    set.off();
    if (small) { adb('shell', 'wm', 'size', 'reset'); await run(1500); await calibrate(); }
  }
  for (const b of boxes) console.log(`BOX ${b.label} ${JSON.stringify({ x: b.x, y: b.y, w: b.w, h: b.h, dpr: b.dpr })}`);
};
