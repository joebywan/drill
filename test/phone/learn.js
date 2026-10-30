// The first Learning lesson from a first visit: the intro skipped, then home with no questions, a look at the optional
// skip-ahead offer, then every item played with real taps, with the feel cues heard and felt
// (the correct-answer pop, lesson complete, the next node unlocking).
import { readFileSync } from 'node:fs';
import { answer, kind, starPath } from '../../src/chess/items.js';

const first = JSON.parse(readFileSync(new URL('../../src/data/basics.json', import.meta.url))).units[0].lessons[0];

export default async ({ page, touch, btn, shot, run, check, checkSound, vibrations }) => {
  const square = (sq) => page.locator(`.board rect[data-square="${sq}"]`);
  await touch(btn('Skip')); // the first-visit intro (its own scenario is onboarding)
  await shot('home');
  await touch(btn('Know some chess already? Skip ahead')); await shot('placement');
  await touch(btn('Back')); await shot('path');
  await touch(btn(`Continue · ${first.title}`));
  let heard = false;
  const buzzed = vibrations();
  for (const [i, item] of first.items.entries()) {
    await shot(`item${i}-${kind(item)}`);
    if (kind(item) === 'tap') for (const sq of answer(item)) await touch(square(sq));
    if (kind(item) === 'stars') for (const { from, to } of starPath(item)) {
      await page.locator(`.board g[data-piece][data-square="${from}"]`).waitFor();
      await touch(square(from)); await touch(square(to));
    }
    if (!heard && kind(item) !== 'teach') { heard = true; await shot(`item${i}-answered`); checkSound(); } // the correct-answer pop
    await touch(btn('Continue', { exact: true }));
  }
  await shot('summary'); checkSound(); // lesson complete, under the petals
  check('haptics: new com.android.chrome vibrations (dumpsys vibrator_manager)', vibrations() > buzzed);
  await touch(btn('Continue', { exact: true })); await run(1800); await shot('home-after');
  checkSound(); // Lumi lands and the next node unlocks
};
