// Reflect: typing with the on-screen keyboard, and the buttons that must sit above it. Seeded with
// lines from a week ago (the look back on home) and from two recent days (so today's makes three,
// and the end screen offers the week).
import { emptyProgress, finishPractice, today } from '../../src/progress.js';
import { daysAgo } from './lib/seed.js';


export default async ({ page, seed, touch, btn, type, shot, check }) => {
  let p = emptyProgress();
  p.journal = {};
  for (const [n, good] of [[7, 'A walk in the sun'], [3, 'Soup'], [2, 'A long bath']]) {
    p = finishPractice(p, 'reflect', null, daysAgo(n), { title: 'Reflect', mins: 1 });
    p.journal[today(daysAgo(n))] = { good };
  }
  await seed(p);
  await touch(btn(/^Reflect(,|$)/)); await shot('home');
  const back = page.locator('.look-back');
  check('the line from a week ago is on home', (await back.textContent()).includes('A walk in the sun'));
  await touch(back); await shot('habitview-from-home');
  check('it opens the habit view', await page.getByRole('heading', { name: 'This week' }).isVisible());
  await touch(page.getByRole('button', { name: 'Back' }));
  await touch(btn(/^Reflect(,|$)/));
  await touch(btn('Continue · Three small lines')); await shot('teach');
  await touch(btn('Start')); await shot('prompt1');
  const box = page.getByRole('textbox');
  await touch(box); await page.waitForTimeout(1200); await shot('keyboard');
  await type('Coffee with a friend'); await shot('typed');
  await touch(btn('Next')); await shot('prompt2');
  await touch(btn('Skip')); await shot('prompt3');
  await touch(box); await type('Go for a walk');
  await touch(btn(/Next|Finish|Done/)); await shot('end');
  check('the end screen offers the week', await btn('Read back your week').isVisible());
  await touch(btn('Clearer')); await touch(btn(/^Continue/)); await shot('home-after');
  await touch(btn(/See your week$/)); await shot('habitview');
};
