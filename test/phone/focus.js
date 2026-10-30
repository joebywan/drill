// Focus: a preset tap, the timer on the clock with Pause and "I'm done", and a buzz at the end.
// Wake Lock needs a secure page: over http://10.0.2.2 Chrome leaves navigator.wakeLock out, so the
// screen-on check only bites when run against an https --url.
export default async ({ page, seed, touch, btn, type, shot, run, check, vibrations }) => {
  const left = () => page.getByRole('timer').innerText();
  await seed();
  await touch(btn(/^Focus(,|$)/)); await shot('home');
  await touch(btn('Continue · Ten minutes, one thing')); await shot('teach');
  await touch(btn('Start')); await shot('ask');
  await touch(btn('Reading')); await page.waitForTimeout(1500); await shot('timer');
  const lock = await page.evaluate(async () => (!isSecureContext ? 'not a secure page'
    : !navigator.wakeLock ? 'no Wake Lock API' : 'ok'));
  check('the screen is kept on where Chrome offers Wake Lock', lock !== 'no Wake Lock API', lock);
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
