// Your timings with real taps: Breaths starts at the first lesson's 3 and + gives 4; set Calm's breath in to 6, see the orb hold the in-breath for 6 s, then reset.
export default async ({ page, seed, touch, btn, shot, run, check }) => {
  await seed();
  await touch(btn(/^Calm(,|$)/));
  await touch(btn('Your timings')); await shot('timings');
  const breaths = page.locator('.steppers li[data-k="breaths"]');
  check('Breaths shows the first lesson\'s count', (await breaths.locator('output').textContent()) === '3 (grows as you go)');
  await touch(breaths.getByRole('button', { name: 'More' }));
  check('+ steps from it', (await breaths.locator('output').textContent()) === '4 (default grows as you go)');
  await touch(breaths.getByRole('button', { name: 'Less' }));
  check('− back to 3 grows again', (await breaths.locator('output').textContent()) === '3 (grows as you go)');
  const inhale = page.locator('.steppers li[data-k="inhale"]');
  await touch(inhale.getByRole('button', { name: 'More' }));
  await touch(inhale.getByRole('button', { name: 'More' })); await shot('inhale-6');
  check('two taps on + set Breathe in to 6 s', (await inhale.locator('output').textContent()) === '6 s (default 4)');
  check('saved at once', JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')).timings)) === '{"calm":{"inhale":6}}');
  await touch(btn('Back').and(page.locator('.back')));
  await touch(btn('Continue · The long out-breath'));
  await touch(btn('Start')); await shot('inhale');
  // Real taps let a little real time pass too, so the count is read rather than a precise moment:
  // the in-breath shows 5 or 6 seconds left, where the default would show 4 at most.
  const left = Number(await page.locator('.orb .count').textContent());
  check('the in-breath counts down from 6 s', (await page.locator('.orb').getAttribute('data-phase')) === 'in' && left >= 5, `count ${left}`);
  await run(6000); await shot('out');
  check('then the out-breath', (await page.locator('.orb').getAttribute('data-phase')) === 'out');
  await run(40000);
  await touch(btn(/^Continue/));
  await touch(btn(/See your week$/));
  await touch(btn('Your timings'));
  await touch(btn('Back to defaults')); await shot('reset');
  check('Back to defaults puts 4 s back', (await inhale.locator('output').textContent()) === '4 s (default 4)');
};
