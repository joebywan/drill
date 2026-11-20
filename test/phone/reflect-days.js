// Reflect on three days running: the middle prompt changes with the date (its first and last stay), the line
// from a week ago on home, and on the third day "Read back your week" opened from the end screen.
import { emptyProgress, finishPractice, today } from '../../src/progress.js';
import { daysAgo } from './lib/seed.js';

export default async ({ page, seed, touch, btn, type, shot, check }) => {
  let p = { ...emptyProgress(), start: 'x', journal: {} };
  for (const [n, good] of [[9, 'Rain on the roof'], [7, 'A walk in the sun'], [5, 'Soup'], [4, 'A long bath']]) {
    p = finishPractice(p, 'reflect', null, daysAgo(n), { title: 'Reflect', mins: 1 });
    p.journal[today(daysAgo(n))] = { good };
  }
  const real = Date.now();
  const middles = [];
  try {
    for (const plus of [0, 1, 2]) {
      await page.clock.setSystemTime(real + plus * 864e5);
      await seed(plus ? JSON.parse(await page.evaluate(() => localStorage.getItem('wingbeat.progress'))) : p);
      await touch(btn(/^Reflect(,|$)/)); await shot(`day${plus}-home`);
      await touch(page.locator('.cta .next'));
      if (await btn('Start').count()) await touch(btn('Start'));
      const prompt = () => page.locator('main').innerText();
      check(`day ${plus}: the first prompt stays`, /One good thing/.test(await prompt()));
      await touch(page.getByRole('textbox')); await type(`Day ${plus} tea`);
      await touch(btn('Next'));
      const middle = (await prompt()).replace(/\s+/g, ' ');
      middles.push(middle);
      await shot(`day${plus}-middle`);
      await touch(btn('Skip'));
      check(`day ${plus}: the last prompt stays`, /One thing for tomorrow/.test(await prompt()));
      await touch(btn('Skip'));
      await shot(`day${plus}-end`);
      if (plus === 2) {
        await touch(btn('Read back your week')); await shot('read-back');
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('read-back-bottom');
      } else {
        await touch(btn('Clearer')); await touch(btn(/^Continue/));
      }
    }
    check('the middle prompt differs day to day', new Set(middles).size === 3, middles.map((m) => m.slice(0, 60)).join(' | '));
  } finally {
    await page.clock.setSystemTime(real);
  }
};
