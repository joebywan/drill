// What only a phone shows: the new screens in the phone's dark theme. Home (Calm, and Learning with what Chess is
// raising in the streak row), "Your butterfly", the field guide and a species page, the wardrobe, Move's routine
// chooser and Walk's habit view with its "when". Night mode is put back at the end. Large text has its own scenarios:
// Chrome 133 doesn't pass the phone's font size on to a page, it offers Default zoom (zoom.js); the Android app follows
// the font size (app.js).
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
  try {
    set.dark(); await page.reload();
    // The phone's own night mode, not an emulated one: the runner lets it through (tools/phone.js, helpersFor).
    check("dark: the page sees the phone's night mode", await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches));
    await tour('dark');
  } finally {
    set.off();
  }
};
