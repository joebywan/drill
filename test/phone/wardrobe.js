// Lumi's wardrobe with seeded skins: opened from ⋯ and from the garden, given skins worn with one
// tap, the rest dimmed with what gives them; then Lumi wears hers in Reflect, which she coaches.
import { award } from '../../src/garden/model.js';
import { emptyProgress, finishPractice } from '../../src/progress.js';

export default async ({ page, seed, touch, btn, shot, check }) => {
  let p = { ...emptyProgress(), start: 'x', picked: [], done: { 'event:spring-market': true, 'event:autumn-harvest': true } };
  for (let i = 9; i >= 1; i--) { const d = new Date(); d.setDate(d.getDate() - i); p = finishPractice(p, 'calm', null, d); }
  p = award(p).progress; // the daisy, the crown and the straw hat
  await seed(p);

  await touch(btn('Settings'));
  await touch(btn("Lumi's wardrobe")); await shot('wardrobe');
  check('wardrobe: three given, four dimmed', await page.locator('button.skin-card[data-skin]').count() === 4
    && await page.locator('li.skin-card.later').count() === 4);
  check('wardrobe: just Lumi to start', await page.locator('[data-skin=""]').getAttribute('aria-pressed') === 'true');
  await touch(page.locator('[data-skin="crown"]')); await shot('wearing-crown');
  check('one tap wears it', await page.locator('[data-skin="crown"]').getAttribute('aria-pressed') === 'true');
  check('the choice is saved', await page.evaluate(() => JSON.parse(localStorage.getItem('wingbeat.progress')).skin) === 'crown');
  await page.evaluate(() => document.querySelector('.later').scrollIntoView()); await shot('wardrobe-dimmed');
  await touch(btn('Back')); await touch(btn('Back'));

  await touch(btn(/^Your garden/));
  await touch(btn('Wardrobe')); await shot('wardrobe-from-garden');
  await touch(page.locator('[data-skin="strawhat"]'));
  check('from the garden too', await page.locator('[data-skin="strawhat"]').getAttribute('aria-pressed') === 'true');
  await touch(btn('Back')); await touch(btn('Back'));

  // Reflect's coach is Lumi: she wears the hat there.
  await touch(btn(/^Reflect(,|$)/));
  await touch(btn(/^Continue · /)); await shot('reflect');
  check('Reflect: Lumi in her straw hat', await page.locator('.who svg.skin-strawhat').count() === 1);
};
