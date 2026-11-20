// One-tap habits: the five newest presets (Tidy, Floss, Music, Make, Call), each added from the sheet and logged
// once; then a "when" set for Tidy as it is added, changed in its habit view, and cleared there.
import { PRESETS } from '../../src/subjects.js';

const NEWEST = PRESETS.slice(-5);

export default async ({ page, seed, touch, btn, shot, check }) => {
  await seed();
  for (const [i, x] of NEWEST.entries()) {
    await touch(btn('Add a habit'));
    if (!i) await shot('sheet');
    await touch(page.locator(`[data-track="${x.id}"]`));
    if (x.id === 'tidy') {
      await shot('when-ask');
      await touch(btn('After breakfast'));
      check('Tidy: the when is on its panel', (await page.locator('.log-habit .when').textContent()) === 'After breakfast');
    } else await touch(btn('Skip'));
    await shot(`${x.id}-before`);
    await touch(btn(x.did));
    await shot(`${x.id}-after`);
    check(`${x.id}: logged`, (await page.locator(`.path-tab[data-path="${x.id}"]`).getAttribute('aria-label')) === `${x.name}, 1-day streak`);
  }

  await touch(page.locator('.path-tab[data-path="tidy"]'));
  await touch(page.locator('.streak-line'));
  await touch(btn('Change when')); await shot('when-change');
  await touch(btn('Before bed')); await shot('when-changed');
  check('changed in the habit view', (await page.locator('main.habit .when').textContent()) === 'Before bed');
  await touch(btn('Change when'));
  await touch(page.locator('[data-skip]')); await shot('when-cleared');
  check('cleared: no when in the habit view', await page.locator('main.habit .when').count() === 0);
  await touch(btn('Back')); await shot('tidy-no-when');
  check('cleared: none on the panel', await page.locator('.log-habit .when').count() === 0);
};
