// Move's path finished (calm.js does Calm's): home suggests the routine done least recently, "Something else"
// lists them all by unit, "I did it away from the app" counts today, and Undo takes it back.
import { subjects } from '../../src/subjects.js';
import { moveDone } from './lib/seed.js';

export default async ({ page, seed, touch, btn, shot, check }) => {
  const { p, first } = moveDone();
  await seed(p);
  await touch(btn(/^Move(,|$)/)); await shot('finished-home');
  const next = await page.locator('.cta .next').textContent();
  check('suggests the least recent routine', next.includes(first.title), next);
  await touch(btn('Something else')); await shot('list');
  check('every unit listed', await page.locator('main h2').count() === subjects.find((s) => s.id === 'move').units.length);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('list-bottom');
  await touch(btn('I did it away from the app')); await shot('counted');
  const last = () => page.evaluate(() => JSON.parse(localStorage.getItem('wingbeat.progress')).log.at(-1));
  check('counted as away', (await last()).title === 'Away from the app');
  check('the butterfly flies', await btn('Your butterfly, flying').count() === 1);
  await touch(btn('Undo')); await shot('undone');
  check('undone', (await last()).title !== 'Away from the app');
  check('back to basking', await btn('Your butterfly, basking').count() === 1);
};
