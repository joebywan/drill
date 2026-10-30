// Maths from a first visit with real touches: the intro's Learn something → Maths, home on the Maths
// path, the skip-ahead offer looked at and left, then the first lesson played: choices, tiles, pairs
// and a finger drag on the number line.
import { readFileSync } from 'node:fs';
import { answer, right, together } from '../../src/maths/items.js';
import { tick } from '../../src/play/items.js';

const first = JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url))).units[0].lessons[0];

export default async ({ page, touch, btn, swipe, shot, check }) => {
  const pick = (name) => page.getByRole('button', { name, exact: true });
  const bottom = page.locator('.choices');
  await touch(btn('Next'));
  await touch(pick('Learn something'));
  await touch(pick('Maths')); await shot('intro');
  await touch(btn('Show my home')); await shot('home');
  check('Maths is the course shown', (await pick('Maths').getAttribute('aria-pressed')) === 'true');
  await touch(btn('Done some maths already? Skip ahead')); await shot('placement');
  await touch(btn('Back'));
  await touch(btn(`Continue · ${first.title}`));
  for (const [i, item] of first.items.entries()) {
    await shot(`item${i}-${item.type}`);
    if (item.type === 'pick') await touch(bottom.getByRole('button', { name: item.options.find((o) => right(item, o)), exact: true }));
    if (item.type === 'tiles') for (const c of answer(item)) await touch(bottom.locator('.tile:not([disabled])', { hasText: c }));
    if (item.type === 'pairs') {
      const left = [...item.tiles.keys()];
      while (left.length) {
        const a = left.shift();
        const b = left.find((j) => together(item, item.tiles[a], item.tiles[j]));
        left.splice(left.indexOf(b), 1);
        await touch(bottom.locator('.tile').nth(a)); await touch(bottom.locator('.tile').nth(b));
      }
    }
    if (item.type === 'line') {
      const k = Array.from({ length: item.ticks + 1 }, (_, j) => j).find((j) => right(item, tick(item, j)));
      const track = page.locator('.numline .track');
      const box = await track.boundingBox();
      await swipe(track, 2 * ((box.width * k) / item.ticks - box.width / 2)); // a drag that ends on the answer
    }
    if (item.type !== 'teach') {
      await page.locator('.foot.show').waitFor();
      await shot(`item${i}-answered`);
      check(`${item.id} right`, await page.locator('.foot.right').isVisible());
    }
    await touch(btn('Continue'));
  }
  await shot('summary');
  check('right first try, all of them', await page.getByText(/(\d+) of \1 right first try/).isVisible());
  await touch(btn('Continue')); await shot('home-after');
};
