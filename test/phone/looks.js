// What only a phone shows: the new screens in the phone's dark theme, or with its text at 1.3× (LOOKS=large: Chrome
// can close the page when the font scale changes, so each runs on its own). Home, "Your
// butterfly", the field guide and a species page, the wardrobe, Move's routine chooser and Walk's habit view with
// its "when". Both settings are put back at the end.
import { looks, moveDone, thirtyDays } from './lib/seed.js';

export default async ({ page, adb, seed, touch, btn, shot, check }) => {
  const { p } = moveDone(thirtyDays(1));
  const set = looks(adb);
  const tour = async (mode) => {
    await seed(p);
    await touch(btn(/^Calm(,|$)/)); await page.evaluate(() => scrollTo(0, 0)); await shot(`${mode}-home`);
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
      const size = () => page.evaluate(() => [getComputedStyle(document.body).fontSize, Math.round(document.querySelector('.path-tab').getBoundingClientRect().height)].join(' / '));
      await seed(p);
      const normal = await size();
      set.large(); await page.reload();
      await seed(p);
      check('large: Chrome takes notice (body font / tab height)', (await size()) !== normal, `${normal} → ${await size()}`);
    }
    await tour(mode);
  } finally {
    set.off();
  }
};
