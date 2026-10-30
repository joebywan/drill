// Screen break: taught once, six steps on the clock, then how do you feel.
// The step's guidance is on screen with the round pause beside the coach, and nothing needs a scroll.
export default async ({ page, seed, touch, btn, shot, run, check }) => {
  const left = () => page.locator('.count').first().innerText();
  await seed();
  await touch(btn(/^Screen break(,|$)/)); await shot('home');
  await touch(btn('Continue · Why breaks help')); await shot('teach');
  await touch(btn('Start')); await run(5000); await shot('step1');
  check('nothing needs a scroll', await page.evaluate(() => document.querySelector('.next-step').getBoundingClientRect().bottom <= innerHeight));
  const held = await left(); await touch(btn('Pause')); await run(5000);
  check('the countdown holds while paused', (await left()) === held, `${held} s`);
  await touch(btn('Carry on')); await run(3000);
  check('Carry on carries on', (await left()) !== held, `${held} → ${await left()} s`);
  // Each later step: the clock runs to it, then a real wait catches Mira mid-pose (ms into the demo).
  const now = page.locator('.steps li[aria-current="step"]');
  for (const [name, ms] of [['Slow blinks', 1500], ['Shoulder rolls', 1700], ['Neck tilts', 3300], ['Stand and stretch', 4000], ['Sit tall', 4000]]) {
    for (let i = 0; i < 60 && !(await now.innerText()).startsWith(name); i++) await run(1000);
    await page.waitForTimeout(ms); await shot(`step-${name.split(' ')[0].toLowerCase()}`);
  }
  for (let i = 0; i < 30 && !(await btn('About the same').count()); i++) await run(2000);
  await shot('end');
  await touch(btn('About the same')); await shot('felt');
  await touch(btn(/^Continue/)); await shot('home-after');
};
