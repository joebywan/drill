// Your timings with real taps: Breaths starts at the first lesson's 3 and + gives 4; set Calm's breath in to 6, see the orb hold the in-breath for 6 s (counting up), then reset.
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
  check('saved at once', JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('wingbeat.progress')).timings)) === '{"calm":{"inhale":6}}');
  await touch(btn('Back').and(page.locator('.back')));
  await touch(btn('Continue · The long out-breath'));
  await shot('card-6');
  check("the teach card states the learner's 6 seconds, not the default 4", /in for 6 seconds, then out slowly for 8/.test(await page.locator('main').innerText()));
  await touch(btn('Start'));
  // A breath's seconds count up, from 1. Real time passes between taps too, so rather than reading one moment the page
  // keeps the highest count the in-breath showed: 6 with the learner's 6 s, where the default would stop at 4.
  await page.evaluate(() => {
    window.__most = 0;
    const orb = document.querySelector('.orb');
    new MutationObserver(() => { if (orb.dataset.phase === 'in') window.__most = Math.max(window.__most, Number(orb.textContent)); })
      .observe(orb, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  const first = Number(await page.locator('.orb .count').textContent());
  check('the in-breath counts up from 1', first <= 2, `count ${first}`);
  await shot('inhale');
  await run(7000); await shot('out');
  const most = await page.evaluate(() => window.__most);
  check('the in-breath counts up to 6 s', most === 6, `highest count ${most}`);
  check('then the out-breath', (await page.locator('.orb').getAttribute('data-phase')) === 'out');
  await run(40000);
  await touch(btn(/^Continue/));
  await touch(btn(/See your week$/));
  await touch(btn('Your timings'));
  await touch(btn('Back to defaults')); await shot('reset');
  check('Back to defaults puts 4 s back', (await inhale.locator('output').textContent()) === '4 s (default 4)');
};
