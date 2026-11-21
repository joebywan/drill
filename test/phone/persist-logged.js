// Keeping storage (src/keep.js), a learner who already has a log and was never asked: home asks once, and not again on
// the next return to home. Its own scenario and so its own Firefox install: after an answer Firefox for Android does not
// show the page's next prompt in the same session, so it cannot follow `persist`. In Chrome: no prompt at all.
import { emptyProgress, finishPractice, track } from '../../src/progress.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async ({ page, seed, touch, btn, shot, check, screenXml, uiNodes, tapUi, browser }) => {
  // After `persist` in the same run, Firefox already keeps this site's storage (its "Allow"): then nothing is asked, rightly.
  const kept = await page.evaluate(() => navigator.storage?.persisted?.() ?? false);
  if (kept) console.log('  storage is already kept on this install (persist ran first in this run): no prompt is the right answer; play it in its own run to see the prompt');
  const asks = browser === 'firefox' && !kept;
  const prompt = async () => uiNodes(await screenXml()).find((x) => !x.page && /persistent storage/.test(x.text + x.desc))?.text ?? null;
  const learner = track({ ...emptyProgress(), start: 'x', picked: ['walk', 'learn'] }, { id: 'walk', hidden: false });
  await seed(finishPractice(learner, 'walk', null, new Date()), { asked: false });
  await sleep(2500);
  await shot('home');
  const first = await prompt();
  check(asks ? 'a learner with a log, never asked, is asked on home' : `${kept ? 'storage already kept' : 'Chrome'}: no prompt on home`, asks ? !!first : !first, `prompt ${first}`);
  if (asks) { await tapUi(/^Don.t allow$/); await sleep(1500); }
  await touch(page.locator('.menu'));
  await touch(btn('Back')); await sleep(2500);
  await shot('home-again');
  const again = await prompt();
  check('the next return to home: no prompt', !again, `prompt ${again}`);
};
