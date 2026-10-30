// Screen break: taught once, six steps on the clock, then how do you feel.
export default async ({ seed, touch, btn, shot, run }) => {
  await seed();
  await touch(btn(/^Screen break(,|$)/)); await shot('home');
  await touch(btn('Continue · Why breaks help')); await shot('teach');
  await touch(btn('Start')); await run(5000); await shot('step1');
  await touch(btn('How?')); await shot('how'); await touch(btn('Got it'));
  await run(40000); await shot('step3');
  await run(80000); await shot('end');
  await touch(btn('About the same')); await shot('felt');
  await touch(btn(/^Continue/)); await shot('home-after');
};
