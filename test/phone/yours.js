// "Your butterfly" with no panels, one, seven and all fourteen: the wings, the line under them, the legend of
// habit colours, its three states and what comes next. Seeded 30 days in, with the wings cut back.
import { thirtyDays } from './lib/seed.js';

export default async ({ page, seed, touch, shot, check }) => {
  const full = thirtyDays(1);
  for (const n of [0, 1, 7, 14]) {
    await seed({ ...full, wings: full.wings.slice(0, n) });
    await touch(page.locator('.yours-link'));
    const said = await page.locator('.yours-page .said').first().textContent();
    check(`${n} panels: the line under the wings`, n ? said === `${n} of 14 panels coloured` : /^No panels yet/.test(said), said);
    await shot(`panels-${n}`);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
    await shot(`panels-${n}-bottom`);
  }
};
