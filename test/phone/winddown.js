// Wind down on the phone: the night palette in the light theme, the bell at both ends, Calm's
// breathing and sigh chained after settling in, then goodnight and the one end screen.
export default async ({ page, seed, touch, btn, shot, run, checkSound, vibrations, check }) => {
  await seed({ picked: [] });
  await touch(btn('Your progress'));
  await touch(btn(/^A soft bell/)); await run(800);
  await touch(btn('Back'));
  await touch(btn(/^Wind down(,|$)/)); await shot('home');
  await touch(btn('Continue · Lights low')); await shot('teach');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('the night palette, whatever the theme', bg === 'rgb(24, 20, 15)', bg);
  const buzzed = vibrations();
  await touch(btn('Start')); await run(1500); await shot('settle');
  checkSound(); // the opening bell
  await run(19000); await shot('breathe');
  check('Calm breathing follows settling in', await page.getByText('Breath 1 of 3').isVisible());
  await run(36000); await shot('sigh');
  check('then the sigh', await page.getByText('Sigh 1 of 1').isVisible());
  check('haptics: new com.android.chrome vibrations (dumpsys vibrator_manager)', vibrations() > buzzed);
  await run(10000); await shot('goodnight');
  await touch(btn('Goodnight')); await run(500); await shot('end');
  checkSound(); // the closing bell, once, after the whole sequence
  await touch(btn('Settled')); await shot('felt');
  await touch(btn(/^Continue/)); await shot('home-after');
};
