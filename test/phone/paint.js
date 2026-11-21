// Is the page drawn after it loads? In Firefox for Android a reloaded page was seen on screen as its background only,
// with the page itself whole (its DOM, its checks), until something happened. This reloads home and measures the
// screen over time and after each thing that might bring the drawing back, to say which does.
import { thirtyDays } from './lib/seed.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async ({ page, seed, run, shot, check, grab, adb }) => {
  /** How much the page's part of the screen varies: about 0 is a page drawn as its background only. */
  const drawn = () => {
    const s = grab();
    const px = [];
    for (let y = 700; y < 2100; y += 9) for (let x = 40; x < 1040; x += 9) px.push(s.at(x, y).reduce((a, b) => a + b, 0) / 3);
    const mean = px.reduce((a, b) => a + b, 0) / px.length;
    return Math.round(Math.sqrt(px.reduce((a, b) => a + (b - mean) ** 2, 0) / px.length));
  };
  const say = async (label) => {
    const d = drawn();
    const page_ = await page.evaluate(() => ({ hidden: document.hidden, state: document.readyState, kids: document.getElementById('app').childElementCount, focus: document.hasFocus() })).catch((e) => e.message);
    console.log(`  ${label}: drawn ${d} ${JSON.stringify(page_)}`);
    return d;
  };
  const blanks = [];
  for (const [label, patch] of [['empty', {}], ['month', thirtyDays(1)], ['empty-again', {}], ['month-again', thirtyDays(1)]]) {
    await seed(patch);
    const at = [await say(`${label} reloaded`)];
    await sleep(3000); at.push(await say(`${label} +3 s real`));
    await run(3000); at.push(await say(`${label} +3 s on the clock`));
    if (at.at(-1) < 5) {
      await shot(`${label}-blank`);
      await page.evaluate(() => { document.body.style.outline = '1px solid transparent'; }); await sleep(800); at.push(await say(`${label} after a style change`));
      adb('shell', 'input', 'swipe', '540', '1500', '540', '1450', '200'); await sleep(1200); at.push(await say(`${label} after a small finger drag`));
      adb('shell', 'input', 'tap', '540', '2300'); await sleep(1200); at.push(await say(`${label} after a tap on the page's foot`));
    }
    if (at[0] < 5) blanks.push(label);
    await shot(label);
  }
  check('the page is drawn as soon as it has loaded', !blanks.length, blanks.join(', '));
};
