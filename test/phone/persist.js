// The app asks the browser to keep its storage (navigator.storage.persist(), once a visit, on the first save). Chrome
// answers quietly; Firefox for Android asks the person ("Allow … to store data in persistent storage?"). This makes the
// first save of a visit (Walk's "I walked today") and looks at what the browser shows, whether the page is drawn under
// it, after a tap on the page beside it, after each answer, and on the next visit. Made for `--browser firefox`.
import { emptyProgress, track } from '../../src/progress.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async ({ page, seed, touch, btn, shot, check, grab, screenXml, uiNodes, tapUi, adb, pkg }) => {
  /** How much the page's part of the screen varies: about 0 is a page drawn as its background (or a dimmed one) only. */
  const drawn = () => {
    const s = grab();
    const px = [];
    for (let y = 1000; y < 2100; y += 9) for (let x = 40; x < 1040; x += 9) px.push(s.at(x, y).reduce((a, b) => a + b, 0) / 3);
    const mean = px.reduce((a, b) => a + b, 0) / px.length;
    return Math.round(Math.sqrt(px.reduce((a, b) => a + (b - mean) ** 2, 0) / px.length));
  };
  const prompt = async () => uiNodes(await screenXml()).find((x) => !x.page && /persistent storage/.test(x.text + x.desc))?.text ?? null;
  const state = async (label) => {
    const [d, p, kept] = [drawn(), await prompt(), await page.evaluate(() => navigator.storage.persisted()).catch(() => '?')];
    console.log(`  ${label}: page drawn ${d}, prompt ${p ? 'shown' : 'none'}, persisted ${kept}`);
    await shot(label);
    return { d, p };
  };
  const walk = { ...track({ ...emptyProgress(), start: 'x', picked: ['walk'] }, { id: 'walk', hidden: false }) };
  const firstSave = async (label) => {
    await seed(walk);
    await touch(btn(/^Walk(,|$)/));
    await state(`${label}-before`);
    await touch(btn('I walked today')); await sleep(1500);
    return state(`${label}-saved`);
  };

  const asked = await firstSave('visit1');
  check('the first save of a visit asks the person nothing', !asked.p, 'Firefox asks to allow persistent storage');
  if (!asked.p) return;
  // A tap on the page beside the prompt, as a person might, wanting to carry on.
  adb('shell', 'input', 'tap', '540', '1500'); await sleep(1500);
  const beside = await state('visit1-tap-beside');
  for (let i = 0; i < 3; i++) { adb('shell', 'input', 'tap', '540', '1500'); await sleep(800); }
  await state('visit1-more-taps');
  if (await prompt()) { await tapUi(/^Don.t allow$/); await sleep(1500); }
  await state('visit1-after-dont-allow');
  // Away and back: does a page left undrawn come back?
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(2500);
  adb('shell', `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1`); await sleep(3000);
  await state('visit1-away-and-back');

  const again = await firstSave('visit2');
  console.log(`  after "Don't allow", the next visit ${again.p ? 'asks again' : 'does not ask'}`);
  if (again.p) { await tapUi('Allow'); await sleep(1500); await state('visit2-after-allow'); }
  const third = await firstSave('visit3');
  console.log(`  after "Allow", the next visit ${third.p ? 'asks again' : 'does not ask'}`);
  check('a page with a prompt beside it is still drawn after a tap on it', beside.d > 5, `drawn ${beside.d}`);
};
