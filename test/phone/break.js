// Screen break: taught once, six steps on the clock, then how do you feel.
// "How?" (a real tap) opens the step's guidance and holds the countdown; Got it carries on.
export default async ({ page, seed, touch, btn, shot, run, check }) => {
  const left = () => page.locator('.count').first().innerText();
  await seed();
  await touch(btn(/^Screen break(,|$)/)); await shot('home');
  await touch(btn('Continue · Why breaks help')); await shot('teach');
  await touch(btn('Start')); await run(5000); await shot('step1');
  const clear = await page.evaluate(() => {
    const c = document.querySelector('.count').parentElement.getBoundingClientRect();
    const bar = document.querySelector('.practice-pause').getBoundingClientRect();
    return c.bottom <= bar.top && c.bottom <= innerHeight;
  });
  check('the countdown sits clear of the How?/Pause buttons', clear);
  await touch(btn('How?')); await shot('how');
  check('How? opens the guidance dialog', await page.locator('dialog.how[open]').isVisible());
  const held = await left(); await run(5000);
  check('the countdown holds while How? is open', (await left()) === held, `${held} s`);
  await touch(btn('Got it')); await run(3000);
  check('Got it closes the dialog and the countdown carries on', !(await page.locator('dialog.how[open]').count()) && (await left()) !== held, `${held} → ${await left()} s`);
  await run(37000); await shot('step3');
  await run(80000); await shot('end');
  await touch(btn('About the same')); await shot('felt');
  await touch(btn(/^Continue/)); await shot('home-after');
};
