// The first Learning lesson from a first visit: home with no questions, a look at the optional
// skip-ahead offer, then every item played with real taps.
import { readFileSync } from 'node:fs';
import { answer, kind, starPath } from '../../src/chess/items.js';

const first = JSON.parse(readFileSync(new URL('../../src/data/basics.json', import.meta.url))).units[0].lessons[0];

export default async ({ page, touch, btn, shot }) => {
  const square = (sq) => page.locator(`.board rect[data-square="${sq}"]`);
  await shot('home');
  await touch(btn('Know some chess already? Skip ahead')); await shot('placement');
  await touch(btn('Back')); await shot('path');
  await touch(btn(`Continue · ${first.title}`));
  for (const [i, item] of first.items.entries()) {
    await shot(`item${i}-${kind(item)}`);
    if (kind(item) === 'tap') for (const sq of answer(item)) await touch(square(sq));
    if (kind(item) === 'stars') for (const { from, to } of starPath(item)) {
      await page.locator(`.board g[data-piece][data-square="${from}"]`).waitFor();
      await touch(square(from)); await touch(square(to));
    }
    await touch(btn('Continue', { exact: true }));
  }
  await shot('summary');
  await touch(btn('Continue', { exact: true })); await shot('home-after');
};
