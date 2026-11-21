// Keeping the learner's storage (src/keep.js). Chrome and the WebView decide by themselves; Firefox for Android asks the
// person ("Allow … to store data in persistent storage?"), over the page, and does not remember "Don't allow". The app
// brings it up once ever, at home, when something is logged, and never mid-lesson; after that only the ⋯ line's button asks.
// Plays: a first visit (no prompt before the first log entry, the prompt after it, a tap beside it, "Don't allow"), a lesson
// item answered (no prompt), a second visit (no prompt; the ⋯ line, its button, "Allow"), a third (no prompt, no line). Made for `--browser firefox`; in Chrome the same play must show no prompt and no line.
import { emptyProgress, track } from '../../src/progress.js';
import { subjects } from '../../src/subjects.js';
import { playMaths, showTab } from './lib/seed.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (ctx) => {
  const { page, seed, touch, btn, shot, check, grab, screenXml, uiNodes, tapUi, adb, browser } = ctx;
  const asks = browser === 'firefox';
  const drawn = () => {
    const s = grab();
    const px = [];
    for (let y = 1000; y < 2100; y += 9) for (let x = 40; x < 1040; x += 9) px.push(s.at(x, y).reduce((a, b) => a + b, 0) / 3);
    const mean = px.reduce((a, b) => a + b, 0) / px.length;
    return Math.round(Math.sqrt(px.reduce((a, b) => a + (b - mean) ** 2, 0) / px.length));
  };
  const prompt = async () => uiNodes(await screenXml()).find((x) => !x.page && /persistent storage/.test(x.text + x.desc))?.text ?? null;
  const kept = () => page.evaluate(() => navigator.storage.persisted()).catch(() => '?');
  const line = () => page.evaluate(() => { const l = document.querySelector('[data-persist]'); return !!l && !l.hidden; });
  const state = async (label) => {
    const [d, p, k] = [drawn(), await prompt(), await kept()];
    console.log(`  ${label}: page drawn ${d}, prompt ${p ? 'shown' : 'none'}, persisted ${k}`);
    await shot(label);
    return { d, p, k };
  };
  const reload = async () => { await page.reload({ waitUntil: 'networkidle' }); await sleep(2500); };
  const noPrompt = async (label, what) => { const s = await state(label); check(`${what}: no prompt`, !s.p, 'the browser asked'); return s; };
  const answerPrompt = async (label) => { await tapUi(label); await sleep(1500); };

  const maths = subjects.find((s) => s.id === 'maths').units[0].lessons[0];
  const learner = track({ ...emptyProgress(), start: 'x', picked: ['walk', 'learn'] }, { id: 'walk', hidden: false });
  // Visit 1: nothing logged yet; the first entry is the learner's tap on home.
  await seed(learner, { asked: false });
  await page.evaluate(() => localStorage.setItem('wingbeat.course', 'maths'));
  await reload();
  await touch(btn(/^Walk(,|$)/));
  await noPrompt('visit1-home', 'home with an empty log');
  await touch(btn('I walked today')); await sleep(2500);
  const first = await state('visit1-first-entry');
  check(asks ? 'the first log entry, on home, brings the prompt up' : 'Chrome shows no prompt after the first entry', asks ? !!first.p : !first.p, `prompt ${first.p}`);
  if (asks) {
    // A tap on the page beside the prompt, as a person might, wanting to carry on; the page stays drawn.
    adb('shell', 'input', 'tap', '540', '1500'); await sleep(1500);
    const beside = await state('visit1-tap-beside');
    check('a page with a prompt beside it is still drawn after a tap on it', beside.d > 5, `drawn ${beside.d}`);
    await answerPrompt(/^Don.t allow$/);
    const after = await state('visit1-after-dont-allow');
    check('"Don\'t allow" closes the prompt and storage is not kept', !after.p && after.k === false, `prompt ${after.p}, persisted ${after.k}`);
  }

  // The same visit, mid-lesson: an answered item is a save, and no prompt comes up.
  await showTab(ctx, 'learn');
  await touch(btn(`Continue · ${maths.title}`));
  await playMaths(maths, ctx, 2);
  await noPrompt('visit1-lesson-answered', 'mid-lesson');

  // Visit 2: nothing asks; ⋯ has the line, its button asks, "Allow" keeps it.
  await reload();
  await noPrompt('visit2-home', 'a second visit');
  await touch(page.locator('.menu'));
  await shot('visit2-settings');
  check(asks ? 'the ⋯ line is there while storage is not kept' : 'Chrome has no ⋯ line', (await line()) === asks, `line ${await line()}`);
  if (asks) {
    await touch(btn('Turn on')); await sleep(2000);
    const p = await state('visit2-asked-by-button');
    check('the line\'s button brings the prompt up', !!p.p, 'no prompt');
    await answerPrompt('Allow');
    const done = await state('visit2-after-allow');
    const status = await page.evaluate(() => document.querySelector('[role="status"]').textContent);
    check('after "Allow": persisted, the line gone, the status line says so', done.k === true && !(await line()) && /keeping/.test(status), `persisted ${done.k}, status "${status}"`);
  }

  // Visit 3: kept (or Chrome's own business): no prompt, no line.
  await reload();
  await noPrompt('visit3-home', 'a third visit');
  await touch(page.locator('.menu'));
  await sleep(500);
  check('the third visit has no ⋯ line', !(await line()), 'the line is there');
};
