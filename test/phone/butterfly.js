// Your butterfly from a first visit: the intro (Lumi with the butterfly on her head, the tagline and the
// wing line), a first lesson played with real taps, the wingbeat on its end screen (the new panel, Lumi's
// flipper-flap, the flutter heard), then home with the butterfly flying beside the streak line, and its screen.
import { readFileSync } from 'node:fs';
import { answer, kind, starPath } from '../../src/chess/items.js';

const first = JSON.parse(readFileSync(new URL('../../src/data/basics.json', import.meta.url))).units[0].lessons[0];

export default async ({ page, touch, btn, shot, run, check, checkSound }) => {
  check('the intro: the tagline and the wing line', await page.getByText('Small beats go a long way.').isVisible()
    && await page.getByText("colours a panel on your butterfly's wings").isVisible());
  check('the intro: Lumi with the butterfly on her head', await page.locator('.hero [data-part="butterfly"]').count() === 1);
  check('the intro: Next is on screen', await btn('Next').isVisible());
  await shot('intro');
  await touch(btn('Skip'));
  await touch(btn(`Continue · ${first.title}`));
  const square = (sq) => page.locator(`.board rect[data-square="${sq}"]`);
  for (const item of first.items) {
    if (kind(item) === 'tap') for (const sq of answer(item)) await touch(square(sq));
    if (kind(item) === 'stars') for (const { from, to } of starPath(item)) {
      await page.locator(`.board g[data-piece][data-square="${from}"]`).waitFor();
      await touch(square(from)); await touch(square(to));
    }
    await touch(btn('Continue', { exact: true }));
  }
  await run(900); await shot('wingbeat-pop');
  await run(500); await shot('wingbeat-flap');
  check("the end screen: today's wingbeat with a new panel", await page.getByText("Today's wingbeat. One more panel on your butterfly.").isVisible()
    && await page.locator('.wingbeat-moment [data-new]').count() === 1);
  check('the streak chip has the butterfly, no 🔥', await page.locator('.chip.fire svg').count() === 1 && !(await page.locator('main').innerText()).includes('🔥'));
  checkSound(); // the flutter
  await touch(btn('Continue', { exact: true })); await run(1800);
  check('home: the butterfly is flying beside the streak line', await btn('Your butterfly, flying').isVisible());
  await shot('home');
  await touch(btn('Your butterfly, flying'));
  check('its screen: one panel coloured', await page.getByText('1 of 14 panels coloured').isVisible());
  await shot('your-butterfly');
};
