// The app asks the browser to keep its storage (navigator.storage.persist(), once a visit, on the first save). Chrome
// answers quietly; Firefox for Android asks the person ("Allow … to store data in persistent storage?"). This plays the
// first save of a visit and looks at what the browser shows, whether the page is still drawn under and after it, and
// what each answer does. Made for `--browser firefox`.
import { thirtyDays } from './lib/seed.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async ({ page, seed, touch, btn, shot, check, grab, screenXml, uiNodes, tapUi, adb }) => {
  /** How much the page's part of the screen varies: about 0 is a page drawn as its background only. */
  const drawn = () => {
    const s = grab();
    const px = [];
    for (let y = 700; y < 2100; y += 9) for (let x = 40; x < 1040; x += 9) px.push(s.at(x, y).reduce((a, b) => a + b, 0) / 3);
    const mean = px.reduce((a, b) => a + b, 0) / px.length;
    return Math.round(Math.sqrt(px.reduce((a, b) => a + (b - mean) ** 2, 0) / px.length));
  };
  const prompt = async () => uiNodes(await screenXml()).find((x) => !x.page && /persistent storage/.test(x.text + x.desc))?.text ?? null;
  const state = async (label) => {
    const [d, p, kept] = [drawn(), await prompt(), await page.evaluate(() => navigator.storage.persisted()).catch(() => '?')];
    console.log(`  ${label}: page drawn ${d}, prompt ${p ? `"${p}"` : 'none'}, persisted ${kept}`);
    await shot(label);
    return { d, p };
  };
  const logcat = () => adb('logcat', '-d', '-t', '400', '*:W').split('\n').filter((l) => /gecko|Gecko|GFX|WebRender|Compositor|crash/i.test(l)).slice(-25).join('\n');

  adb('logcat', '-c');
  await seed(thirtyDays(1));
  await state('loaded');
  await touch(btn(/^Calm(,|$)/)); await sleep(1500);
  const asked = await state('after-first-save');
  check('the first save of a visit asks nothing of the person', !asked.p, asked.p ?? '');
  for (let i = 0; i < 3; i++) { await touch(btn(/^(Move|Learning)(,|$)/).first()); await sleep(1000); }
  await state('three-taps-later');
  console.log(`  logcat (warnings, Gecko):\n${logcat()}`);
  if (asked.p || await prompt()) {
    await tapUi("Don’t allow") || await tapUi("Don't allow");
    await sleep(1500);
    await state('after-dont-allow');
    await page.reload(); await touch(btn(/^Calm(,|$)/)); await sleep(1500);
    await state('next-visit-first-save');
    if (await prompt()) { await tapUi('Allow'); await sleep(1500); await state('after-allow'); }
  }
};
