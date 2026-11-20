// Lumi's wardrobe with nothing given yet and with all seven; then each skin worn where Lumi is drawn: home
// (Reflect's path, which she coaches), the garden, and a Calm end screen's wingbeat, where she stands by your butterfly.
import { SKIN_RULES } from '../../src/garden/model.js';
import { emptyProgress } from '../../src/progress.js';
import { ago, practised, thirtyDays } from './lib/seed.js';

export default async ({ page, seed, touch, btn, shot, run, check }) => {
  const wardrobe = async () => { await touch(btn('Settings')); await touch(btn("Lumi's wardrobe")); };
  // Two days in: nothing earned yet (30 days in has earned the daisy, the bow tie and the costume).
  await seed(practised({ ...emptyProgress(), start: 'x' }, 'calm', 2));
  await wardrobe(); await shot('none-given');
  check('none given: only Just Lumi to tap, seven dimmed', await page.locator('button.skin-card[data-skin]').count() === 1 && await page.locator('li.skin-card.later').count() === 7);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('none-given-bottom');

  const all = thirtyDays(1);
  all.garden.earned = { ...all.garden.earned, ...Object.fromEntries(SKIN_RULES.map(([id]) => [`skin:${id}`, ago(1)])) };
  await seed(all);
  await wardrobe(); await shot('all-given');
  check('all seven given', await page.locator('button.skin-card[data-skin]').count() === 8 && await page.locator('li.skin-card.later').count() === 0);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('all-given-bottom');

  for (const [id] of SKIN_RULES) {
    await seed({ ...all, skin: id });
    await touch(btn(/^Reflect(,|$)/)); await shot(`${id}-home`);
    check(`${id}: worn on home`, await page.locator(`.guide svg.skin-${id}`).count() === 1);
    await touch(btn(/^Your garden/)); await shot(`${id}-garden`);
    await touch(btn('Back'));
    await touch(btn(/^Calm(,|$)/));
    await touch(btn(/^Continue · /)); await touch(btn('Start')); await run(45000);
    check(`${id}: worn on the end screen`, await page.locator(`.wingbeat-moment svg.skin-${id}`).count() === 1);
    await page.locator('.wingbeat-moment').scrollIntoViewIfNeeded(); await shot(`${id}-end`);
  }
};
