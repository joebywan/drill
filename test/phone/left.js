// A Calm practice closed part-way with the real ✕: kept in `left` with the step it reached, never logged.
export default async ({ page, seed, touch, btn, shot, run, check }) => {
  await seed();
  await touch(btn(/^Calm(,|$)/));
  await touch(btn('Continue · The long out-breath'));
  await touch(btn('Start')); await run(13000); await shot('breath-2');
  await touch(btn('Stop')); await shot('home-after');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')));
  check('nothing logged', saved.log.length === 0);
  const left = saved.left.at(-1);
  check('kept in left at step 2 of 6', left?.habit === 'calm' && left.step === 2 && left.of === 6, JSON.stringify(left));
  check('with its hour', Number.isInteger(left?.hour));
};
