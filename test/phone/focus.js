// Focus: a preset tap, the timer on the clock with Pause and "I'm done", and a buzz at the end. The
// page is on localhost (adb reverse), a secure context, so Chrome's real Wake Lock holds the screen:
// stayAwake() marks <html data-awake> while a lock is held.
export default async ({ page, seed, touch, btn, type, shot, run, check, vibrations }) => {
  const left = () => page.getByRole('timer').innerText();
  await seed();
  await touch(btn(/^Focus(,|$)/)); await shot('home');
  await touch(btn('Continue · Ten minutes, one thing')); await shot('teach');
  await touch(btn('Start')); await shot('ask');
  check('no wake lock before the timer', !(await page.evaluate(() => 'awake' in document.documentElement.dataset)));
  await touch(btn('Reading')); await page.waitForTimeout(1500); await shot('timer');
  const awake = () => page.evaluate(() => 'awake' in document.documentElement.dataset);
  check('Chrome has the Wake Lock API (a secure page)', await page.evaluate(() => isSecureContext && 'wakeLock' in navigator), page.url());
  check('a screen wake lock is held while the timer runs', await awake());
  await run(120_000); await page.waitForTimeout(3000); await shot('timer-2min');
  check('the ring fills as time passes', await page.evaluate(() => (document.querySelector('.focus-dial').getAnimations()[0]?.currentTime ?? 1) > 0));
  // Real seconds pass beside the fake clock, so two minutes in reads 8:00 or a few seconds under.
  check('the timer reads about 8:00 after two minutes', /^(8:00|7:[45]\d)$/.test(await left()), await left());
  await touch(btn('Pause')); const at = await left(); await run(60_000); await shot('paused');
  check('Pause holds the timer', (await left()) === at, `${at} → ${await left()}`);
  await touch(btn('Carry on'));
  const buzzed = vibrations();
  await run(480_000); await page.waitForTimeout(1000); await shot('end');
  check('the end screen asks how it went', await page.getByRole('heading', { name: 'How did it go?' }).isVisible());
  check('the end buzzes (dumpsys vibrator_manager)', vibrations() > buzzed);
  check('the wake lock is let go at the end', !(await awake()));
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
