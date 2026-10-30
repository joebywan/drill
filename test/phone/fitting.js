// Fitting the person, from seeded progress: six weeks of evening Breathing then a quiet week (a
// comeback card on home), and the five-breath lesson left at the same step three times (a shorter
// one offered). The shorter session answers the comeback, so a ladybird arrives; the habit view
// names the usual hour, and the Android bridge reads and records.
import { emptyProgress, finishPractice, leavePractice } from '../../src/progress.js';

const daysAgo = (n, h = 19) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d; };

export default async ({ page, seed, touch, btn, shot, run, check }) => {
  let p = emptyProgress();
  for (let n = 49; n >= 9; n--) if (n % 7 !== 3) p = finishPractice(p, 'calm', null, daysAgo(n), { title: 'Breathing', mins: 2 });
  for (const [n, step] of [[4, 6], [3, 7], [2, 6]]) p = leavePractice(p, 'calm', 'calm:breathe2', step, 10, daysAgo(n), { title: 'Breathing' });
  await seed({ ...p, done: { 'calm:breathe1': true } });
  await shot('home-comeback');
  check('comeback card on home', await page.locator('.comeback').isVisible());
  check('it names their practice and hour', (await page.locator('.comeback').textContent()).includes('Some Breathing around 7 pm'));
  check('Calm comes first: finished most', (await page.locator('.path-tab[data-path]').first().getAttribute('data-path')) === 'calm');
  await touch(btn(/^Calm(,|$)/));
  const short = btn('Try a shorter one: 3 breaths');
  check('shorter one offered', await short.isVisible());
  await shot('calm-shorter');
  await touch(short);
  const start = btn('Start');
  if (await start.count()) await touch(start);
  check('three breaths this time', await page.getByText('Breath 1 of 3').isVisible());
  await run(40000); await shot('end');
  check('a ladybird came', await page.getByText('A ladybird came to visit').isVisible());
  check('timings not saved', JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')).timings)) === '{}');
  await touch(btn(/^Continue$/)); await shot('home-after');
  check('comeback card gone', (await page.locator('.comeback').count()) === 0);
  check('no shorter offer once finished', (await page.getByRole('button', { name: /^Try a shorter one/ }).count()) === 0);
  await touch(btn(/See your week$/)); await shot('habit-view');
  check('usual hour shown', await page.getByText('You usually practise around 7 pm').isVisible());
  check('bridge: reminderHour', (await page.evaluate(() => window.drill.reminderHour())) === 19);
  check('bridge: no reminder after a session today', (await page.evaluate(() => window.drill.shouldRemind())) === false);
  check('bridge: noteReminder records', (await page.evaluate(() => window.drill.noteReminder('opened'))) === true);
};
