// Coding's first lesson with real touches: the course row on Learning, tap-to-build tiles in the
// thumb zone, Fennel walking the grid, a predict tap on a grid square, then the end screen.
import { readFileSync } from 'node:fs';
import { answer, solve } from '../../src/coding/program.js';

const first = JSON.parse(readFileSync(new URL('../../src/data/coding.json', import.meta.url))).units[0].lessons[0];

export default async ({ page, seed, touch, btn, shot, check }) => {
  await seed();
  await touch(page.locator('[data-course="coding"]')); await shot('home');
  await touch(btn(`Continue · ${first.title}`));
  for (const [i, item] of first.items.entries()) {
    await shot(`item${i}-${item.type}`);
    if (item.type === 'build') {
      for (const t of solve(item)) await touch(page.locator('.tiles').getByRole('button', { name: `Step ${t}`, exact: true }));
    }
    if (item.type === 'predict') {
      const [x, y] = answer(item);
      await touch(btn(`Column ${x + 1}, row ${y + 1}`));
    }
    await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
    if (item.type !== 'teach') {
      await shot(`item${i}-done`);
      check(`${item.id}: right first time`, await page.locator('.foot.right').count() === 1);
      const moved = await page.locator('.walker').evaluate((el) => el.style.transform);
      check(`${item.id}: Fennel walked off the start`, moved !== 'translate(0%, 0%)', moved);
    }
    await touch(btn('Continue', { exact: true }));
  }
  await shot('summary');
  check('Fennel is on the end screen', await page.locator('.summary svg.cast-fennel').count() === 1);
  await touch(btn('Continue', { exact: true })); await shot('home-after');
};
