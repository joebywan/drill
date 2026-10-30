// The garden with all five habits started: the header fits, the tabs swipe inside themselves,
// the full garden in this season with Lumi's pond, the ⋯ season toggle, a plant's habit view, and a
// Calm session that brings what arrives (heard: its chime).
import { award } from '../../src/garden/model.js';
import { emptyProgress, finishPractice, finishSession } from '../../src/progress.js';
import { season, southern } from '../../src/garden/season.js';

/** `p` with `habit` practised on each of the days `from`…`to` days ago (from > to). */
const practised = (p, habit, from, to = 1) => {
  for (let i = from; i >= to; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    p = habit === 'learn' ? finishSession(p, null, [], d) : finishPractice(p, habit, null, d);
  }
  return p;
};

export default async ({ page, seed, touch, btn, swipe, shot, run, check, checkSound }) => {
  let p = { ...emptyProgress(), start: 'x' };
  p = practised(p, 'learn', 3);
  p = practised(p, 'move', 12);
  p = practised(p, 'break', 2);
  p = practised(p, 'reflect', 5);
  p = practised(p, 'calm', 7, 2);
  p = award(p).progress; // what that much practice has earned, as if done in the app…
  p = practised(p, 'calm', 1); // …then yesterday's Calm makes the 7-day streak, not yet rewarded
  await seed(p);
  await shot('home');

  const inView = (sel) => page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  }, sel);
  check('header: Sound fully on screen', await inView('.bar .sound'));
  check('header: ⋯ fully on screen', await inView('.bar .menu'));

  const tabs = page.locator('.paths');
  const before = await page.evaluate(() => [scrollX, scrollY, document.querySelector('.paths').scrollLeft]);
  await swipe(tabs, -250); await shot('tabs-swiped');
  const after = await page.evaluate(() => [scrollX, scrollY, document.querySelector('.paths').scrollLeft]);
  check('tabs: swipe scrolls the tab row', after[2] !== before[2], `scrollLeft ${before[2]} → ${after[2]}`);
  check('tabs: swipe leaves the page still', after[0] === before[0] && after[1] === before[1], `page ${before.slice(0, 2)} → ${after.slice(0, 2)}`);

  // The season is the device's own: its date, and its timezone's hemisphere.
  const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const want = season(new Date(), southern(tz));
  const seasonOf = () => page.locator('.garden-link svg.garden-scene').getAttribute('class');
  check(`garden: ${want} for ${tz}`, (await seasonOf()).includes(`season-${want}`), await seasonOf());
  await touch(btn('Your progress'));
  await touch(btn('Southern hemisphere seasons')); await shot('season-toggle');
  await touch(btn('Back'));
  const flipped = season(new Date(), !southern(tz));
  check(`garden: the toggle turns it to ${flipped}`, (await seasonOf()).includes(`season-${flipped}`), await seasonOf());
  await shot('home-flipped');
  await touch(btn('Your progress')); await touch(btn('Southern hemisphere seasons')); await touch(btn('Back'));

  await touch(btn(/^Your garden/)); await shot('garden');
  check("garden: Lumi lounges by the pond", await page.locator('.garden-view svg.pond svg.cast-lumi').count() === 1);
  await page.evaluate(() => document.querySelector('.plant-cards').scrollIntoView()); await page.waitForTimeout(500); await shot('garden-cards');
  await touch(page.locator('.plant-card[data-plant="calm"]')); await shot('calm-view');
  check('plant card opens the habit view', await page.getByRole('heading', { name: 'Calm', exact: true }).isVisible());
  await touch(btn('Back')); await touch(btn('Back')); await shot('home-again');

  await touch(btn(/^Calm(,|$)/));
  await touch(btn(/^Continue · /));
  await touch(btn('Start')); await run(45000);
  const arrived = await page.locator('.arrivals').innerText().catch(() => '');
  check('end screen: something arrived', /arrived|found|opened|came/.test(arrived), arrived.replace(/\s+/g, ' ').trim());
  await shot('end');
  checkSound(); // the arrival's chime
  await touch(btn('Calmer')); await touch(btn(/^Continue/)); await shot('home-after');
};
