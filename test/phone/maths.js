// Maths from a first visit with real touches: the intro's Learn something → Maths, home on the Maths
// path, the skip-ahead offer looked at and left, then the first lesson played: choices, tiles, pairs
// and a finger drag on the number line. Then a first lesson from two later units, started where the
// placement would put them: arrays of dots (Times tables) and a line below zero (Below zero).
import { readFileSync } from 'node:fs';
import { answer, right, toQuiz } from '../../src/maths/items.js';
import { tick } from '../../src/quiz/items.js';

const { units } = JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url)));
const unit = (title) => units.find((u) => u.title === title);

export default async ({ page, seed, touch, btn, swipe, shot, check }) => {
  const pick = (name) => page.getByRole('button', { name, exact: true });
  const bottom = page.locator('.choices');
  /** Plays a lesson right first time, every answer a real tap or drag, checking each one fits. */
  const play = async (lesson, tag) => {
    await touch(btn(`Continue · ${lesson.title}`));
    for (const [i, item] of lesson.items.entries()) {
      await shot(`${tag}-item${i}-${item.type}`);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`${item.id}: no sideways overflow`, wide === 0, `${wide}px`);
      if (item.type === 'pick') await touch(bottom.getByRole('button', { name: item.options.find((o) => right(item, o)), exact: true }));
      if (item.type === 'build') for (const c of answer(item)) await touch(bottom.getByRole('button', { name: c, exact: true, disabled: false }));
      if (item.type === 'pairs') // one from each column, as worked out for the quiz item
        for (const pair of toQuiz(item).pairs) for (const x of pair) await touch(bottom.getByRole('button', { name: x, exact: true, disabled: false }));
      if (item.type === 'line') {
        const k = Array.from({ length: item.ticks + 1 }, (_, j) => j).find((j) => right(item, tick(item, j)));
        const track = page.locator('.numline .track');
        const box = await track.boundingBox();
        await swipe(track, 2 * ((box.width * k) / item.ticks - box.width / 2)); // a drag that ends on the answer
      }
      if (item.type !== 'teach') {
        await page.locator('.foot.show').waitFor();
        await shot(`${tag}-item${i}-answered`);
        check(`${item.id} right`, await page.locator('.foot.right').isVisible());
      }
      await touch(btn('Continue'));
    }
    await shot(`${tag}-summary`);
    check(`${tag}: right first try, all of them`, await page.getByText(/(\d+) of \1 right first try/).isVisible());
    await touch(btn('Continue'));
  };

  await touch(btn('Next'));
  await touch(pick('Learn something'));
  await touch(pick('Maths')); await shot('intro');
  await touch(btn('Show my home')); await shot('home');
  check('Maths is the course shown', (await pick('Maths').getAttribute('aria-pressed')) === 'true');
  await touch(btn('Done some maths already? Skip ahead')); await shot('placement');
  await touch(btn('Back'));
  await play(units[0].lessons[0], 'first');
  await shot('home-after');

  for (const [title, tag] of [['Times tables you can see', 'times'], ['Below zero', 'below']]) {
    await seed({ start: { maths: title } });
    await touch(page.locator('[data-course="maths"]')); await shot(`${tag}-home`);
    await play(unit(title).lessons[0], tag);
  }
};
