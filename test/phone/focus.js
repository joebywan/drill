// Focus: a preset tap, the timer on the clock with Pause and "I'm done", the screen kept on
// (Chrome's window holds KEEP_SCREEN_ON while the timer runs), a bell and a buzz at the end.
export default async ({ page, adb, seed, touch, btn, type, shot, run, check, vibrations }) => {
  const keepOn = () => /KEEP_SCREEN_ON/.test(adb('shell', 'dumpsys', 'window', 'windows').split('\n').filter((l) => /chrome|KEEP_SCREEN_ON/i.test(l)).join('\n'));
  const left = () => page.getByRole('timer').innerText();
  await seed();
  await touch(btn(/^Focus(,|$)/)); await shot('home');
  await touch(btn('Continue · Ten minutes, one thing')); await shot('teach');
  await touch(btn('Start')); await shot('ask');
  check('the screen is not held before the timer', !keepOn());
  await touch(btn('Reading')); await page.waitForTimeout(1500); await shot('timer');
  check('Wake Lock API present in Chrome', await page.evaluate(() => 'wakeLock' in navigator));
  check('the screen is kept on while the timer runs (dumpsys window)', keepOn());
  await run(120_000); await page.waitForTimeout(3000); await shot('timer-2min');
  check('the ring fills as time passes', await page.evaluate(() => (document.querySelector('.focus-dial').getAnimations()[0]?.currentTime ?? 1) > 0));
  check('the timer reads 8:00 after two minutes', (await left()) === '8:00', await left());
  await touch(btn('Pause')); await run(60_000); await shot('paused');
  check('Pause holds the timer', (await left()) === '8:00', await left());
  await touch(btn('Carry on'));
  const buzzed = vibrations();
  await run(480_000); await page.waitForTimeout(1000); await shot('end');
  check('the end screen asks how it went', await page.getByRole('heading', { name: 'How did it go?' }).isVisible());
  check('the end buzzes (dumpsys vibrator_manager)', vibrations() > buzzed);
  check('the screen is let go after the timer', !keepOn());
  await touch(btn('Focused')); await touch(btn(/^Continue/)); await shot('home-after');
  // Your own words, then done early.
  await touch(btn('Continue · Fifteen minutes'));
  await touch(page.getByRole('textbox')); await type('Tax forms'); await shot('typed');
  await touch(btn('Start · 15 min')); await run(60_000); await shot('own-timer');
  await touch(btn("I'm done")); await page.waitForTimeout(800); await shot('early-end');
  check("I'm done goes to the same end screen", await page.getByRole('heading', { name: 'How did it go?' }).isVisible());
  await touch(btn(/^Continue/));
  await touch(btn(/See your week$/)); await shot('habitview');
};
