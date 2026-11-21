// The garden with all five habits started: the header fits, the tabs swipe inside themselves,
// the full garden in this season with Lumi's pond, the ⋯ season toggle, a plant's habit view, and a
// Calm session that brings what arrives (heard: its chime): its caterpillar hatching. Maths is
// finished and chess started, so the garden has every stage, and the field guide opens from the
// garden and from home.
import { award } from '../../src/garden/model.js';
import { emptyProgress, finishSession } from '../../src/progress.js';
import { season, southern } from '../../src/garden/season.js';
import { subjects } from '../../src/subjects.js';
import { practised } from './lib/seed.js';

export default async ({ page, seed, touch, btn, swipe, shot, run, check, checkSound }) => {
  let p = { ...emptyProgress(), start: 'x' };
  p = practised(p, 'learn', 3);
  p = practised(p, 'move', 12);
  p = practised(p, 'break', 2);
  p = practised(p, 'reflect', 5);
  p = practised(p, 'calm', 4, 2);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  for (const id of ['maths', 'chess']) {
    const s = subjects.find((x) => x.id === id);
    for (const l of id === 'maths' ? s.units.flatMap((u) => u.lessons) : s.units[0].lessons) p = finishSession(p, `${id}:${l.id}`, [], yesterday);
  }
  p = award(p).progress; // what that much practice has earned, as if done in the app…
  p = practised(p, 'calm', 1); // …then yesterday's Calm, so today's is its fifth day: it hatches
  await seed(p);
  await shot('home');
  // Chess has a finished unit, so home opens scrolled to its next lesson: back to the top for the header.
  await page.evaluate(() => scrollTo(0, 0));

  const inView = (sel) => page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  }, sel);
  check('home: no title bar, no sound button', await page.locator('.bar, .sound').count() === 0);
  // A wide screen (a tablet) puts the tabs in a column in a rail that scrolls inside itself: ⋯ closes it, reached by scrolling the rail.
  const wide = await page.evaluate(() => getComputedStyle(document.querySelector('.rail')).position === 'sticky');
  if (wide) {
    await page.evaluate(() => document.querySelector('.rail').scrollTo(0, 1e5));
    check('home (wide): the rail scrolls to ⋯, fully on screen', await inView('.tabs-row > .menu'));
    await page.evaluate(() => document.querySelector('.rail').scrollTo(0, 0));
    await shot('rail');
  } else {
  check('home: ⋯ fully on screen, at the end of the tabs row', await inView('.tabs-row > .menu'));

  const tabs = page.locator('.paths');
  const before = await page.evaluate(() => [scrollX, scrollY, document.querySelector('.paths').scrollLeft]);
  await swipe(tabs, -250); await shot('tabs-swiped');
  const after = await page.evaluate(() => [scrollX, scrollY, document.querySelector('.paths').scrollLeft]);
  check('tabs: swipe scrolls the tab row', after[2] !== before[2], `scrollLeft ${before[2]} → ${after[2]}`);
  check('tabs: swipe leaves the page still', after[0] === before[0] && after[1] === before[1], `page ${before.slice(0, 2)} → ${after.slice(0, 2)}`);
  }

  // The season is the device's own: its date, and its timezone's hemisphere.
  const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const want = season(new Date(), southern(tz));
  const seasonOf = () => page.locator('.garden-link svg.garden-scene').getAttribute('class');
  check(`garden: ${want} for ${tz}`, (await seasonOf()).includes(`season-${want}`), await seasonOf());
  await touch(btn('Settings'));
  await touch(btn('Southern hemisphere seasons')); await shot('season-toggle');
  await touch(btn('Back'));
  const flipped = season(new Date(), !southern(tz));
  check(`garden: the toggle turns it to ${flipped}`, (await seasonOf()).includes(`season-${flipped}`), await seasonOf());
  await shot('home-flipped');
  await touch(btn('Settings')); await touch(btn('Southern hemisphere seasons')); await touch(btn('Back'));

  await touch(btn(/^Your garden/)); await shot('garden');
  check("garden: Lumi lounges by the pond", await page.locator('.garden-view svg.pond svg.cast-lumi').count() === 1);
  await page.evaluate(() => document.querySelector('.plant-cards').scrollIntoView()); await page.waitForTimeout(500); await shot('garden-cards');
  await touch(page.locator('.plant-card[data-plant="calm"]')); await shot('calm-view');
  check('plant card opens the habit view', await page.getByRole('heading', { name: 'Calm', exact: true }).isVisible());
  await touch(btn('Back'));

  // The field guide from the garden: emerged, being raised, and silhouettes; a page, then back.
  await page.evaluate(() => scrollTo(0, 0));
  check('garden: every stage is drawn', await page.locator('.garden-view svg.creature').count() >= 3
    && await page.locator('.garden-view svg.visitor-butterfly').count() >= 1);
  await touch(btn('Field guide')); await shot('guide');
  check('guide: every kind of tile', await page.locator('.guide-tile:not(.waiting)').count() >= 4 && await page.locator('.guide-tile.waiting svg.silhouette').count() > 10);
  await touch(page.locator('[data-species="blue-triangle"]')); await shot('guide-page');
  check('guide page: the raised one, its source a link', await page.getByRole('heading', { name: 'Blue Triangle' }).isVisible()
    && /^https:/.test(await page.locator('.source a').first().getAttribute('href')));
  await touch(btn('Back')); await touch(btn('Back')); await touch(btn('Back')); await shot('home-again');

  // From home: what the shown course is raising, into its page.
  await touch(btn(/^Learning(,|$)/));
  await page.evaluate(() => scrollTo(0, 0));
  await touch(page.locator('.raising')); await shot('guide-from-home');
  check('home: its line opens that species', await page.locator('.guide-page h1').innerText().then((t) => /Swallowtail|Triangle|Emperor/.test(t)));
  await touch(btn('Back'));

  await touch(btn(/^Calm(,|$)/));
  await touch(btn(/^Continue · /));
  await touch(btn('Start')); await run(45000);
  const arrived = await page.locator('.arrivals').innerText().catch(() => '');
  check('end screen: something arrived', /hatched/.test(arrived), arrived.replace(/\s+/g, ' ').trim());
  await shot('end');
  checkSound(); // the arrival's chime
  await touch(btn('Calmer')); await touch(btn(/^Continue/)); await shot('home-after');
};
