// The field guide: with nothing raised yet; 30 days in (emerged, being raised, waiting), a raised species' page and
// one not started; then with all 27 species emerged (every preset and five habits of your own tracked), each page
// opened from the grid: its name, both drawings, its lines and its source as a link.
import { SPECIES } from '../../src/cast/butterfly.js';
import { emptyProgress, track } from '../../src/progress.js';
import { PRESETS } from '../../src/subjects.js';
import { raisers } from '../../src/garden/model.js';
import { ago, practised, thirtyDays } from './lib/seed.js';

export default async ({ page, seed, touch, btn, shot, check }) => {
  const open = async () => { await touch(btn(/^Your garden/)); await touch(btn('Field guide')); };

  await seed();
  await open(); await shot('nothing-raised');
  check('nothing raised: every tile waits', await page.locator('.guide-tile.waiting').count() === SPECIES.length);

  await seed(thirtyDays(1));
  await open(); await shot('thirty-days');
  check('30 days in: emerged, being raised and waiting tiles', await page.locator('.guide-tile:not(.waiting)').count() >= 6
    && await page.locator('.guide-tile.waiting svg.silhouette').count() >= 10);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('thirty-days-bottom');
  await touch(page.locator('[data-species="common-brown"]')); await shot('page-raised');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('page-raised-bottom');
  await touch(btn('Back'));
  await touch(page.locator('[data-species="chequered-swallowtail"]')); await shot('page-being-raised');
  await touch(btn('Back'));
  await touch(page.locator('[data-species="blue-tiger"]')); await shot('page-not-started');
  check('not started: no lines, no source', await page.locator('.guide-page .source').count() === 0);
  await touch(btn('Back'));

  // Every species emerged.
  let p = { ...emptyProgress(), start: 'x' };
  for (const x of PRESETS) p = track(p, { id: x.id, hidden: false });
  for (const name of ['Stretch', 'Journal', 'Garden', 'Sing', 'Knit']) p = track(p, { name, icon: '⭐', plant: 'tulip' });
  p = practised(p, 'calm', 3);
  p.garden = { earned: Object.fromEntries(raisers(p).map((r) => [`emerged:${r.id}`, ago(1)])) };
  await seed(p);
  await open(); await shot('all-emerged');
  check('all 27 emerged', await page.locator('.guide-tile:not(.waiting)').count() === SPECIES.length, String(await page.locator('.guide-tile:not(.waiting)').count()));
  for (const s of SPECIES) {
    await touch(page.locator(`[data-species="${s.id}"]`));
    const href = await page.locator('.source a').first().getAttribute('href').catch(() => null);
    const drawn = await page.locator('.guide-arts svg.guide-art').evaluateAll((a) => a.filter((x) => x.getBBox().width > 0).length);
    check(`${s.id}: name, both drawings, lines, source a link`, await page.locator('.guide-page h1').textContent() === s.name && drawn === 2
      && await page.locator('.guide-page p:not(.latin):not(.said):not(.source)').count() === s.lines.length && /^https:\/\//.test(href ?? ''), `${drawn} drawn, ${href}`);
    await shot(`species-${s.id}`);
    await touch(btn('Back'));
  }
};
