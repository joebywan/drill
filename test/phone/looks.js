// What only a phone shows: the new screens in the phone's dark theme, or with its text at 1.3× (LOOKS=large: the runner
// sets the font scale before Chrome starts, since a change mid-run makes Chrome replace its page). Home (Calm, and
// Learning with what Chess is raising in the streak row), "Your
// butterfly", the field guide and a species page, the wardrobe, Move's routine chooser and Walk's habit view with
// its "when". Both settings are put back at the end.
import { looks, moveDone, thirtyDays } from './lib/seed.js';

export default async ({ page, adb, seed, touch, btn, shot, check }) => {
  const { p } = moveDone(thirtyDays(1));
  const set = looks(adb);
  const tour = async (mode) => {
    await seed(p);
    await touch(btn(/^Calm(,|$)/)); await page.evaluate(() => scrollTo(0, 0)); await shot(`${mode}-home`);
    await touch(btn(/^Learning(,|$)/)); await touch(page.locator('[data-course="chess"]')); await page.evaluate(() => scrollTo(0, 0));
    check(`${mode}: Learning's streak row ends with what Chess is raising`, await page.locator('.streak-row > .raising:last-child svg').isVisible());
    await shot(`${mode}-home-learning`);
    await touch(page.locator('.yours-link')); await shot(`${mode}-yours`); await touch(btn('Back'));
    await touch(btn(/^Your garden/)); await touch(btn('Field guide')); await shot(`${mode}-guide`);
    await touch(page.locator('[data-species="common-brown"]')); await shot(`${mode}-species`);
    await touch(btn('Back')); await touch(btn('Back'));
    await touch(btn('Wardrobe')); await shot(`${mode}-wardrobe`); await touch(btn('Back')); await touch(btn('Back'));
    await touch(btn(/^Move(,|$)/)); await touch(btn('Something else')); await shot(`${mode}-chooser`); await touch(btn('Back'));
    await touch(btn(/^Walk(,|$)/)); await touch(page.locator('.streak-line')); await shot(`${mode}-walk-view`); await touch(btn('Back'));
  };
  const mode = process.env.LOOKS || 'dark';
  try {
    if (mode === 'dark') {
      set.dark(); await page.reload();
      // The phone's own night mode, not an emulated one: the runner lets it through (tools/phone.js, helpersFor).
      check("dark: the page sees the phone's night mode", await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches));
    } else {
      // Set by the runner before Chrome started (tools/phone.js, PHONE_FONT_SCALE).
      const scale = adb('shell', 'settings', 'get', 'system', 'font_scale').trim();
      check('large: the phone\'s font scale is 1.3', scale === '1.3', scale);
      await seed(p);
      // A tab is 44px tall at 1.0 (16px text, 8px padding, 2px border): Chrome scales the text, so it grows.
      const tab = await page.evaluate(() => Math.round(document.querySelector('.path-tab').getBoundingClientRect().height));
      check('large: Chrome takes notice (a tab is taller than at 1.0)', tab > 46, `${tab}px`);
    }
    await tour(mode);
  } finally {
    // The font scale is the runner's to put back, after the page is done with: changing it now would close the page.
    if (mode === 'dark') set.off();
  }
};
