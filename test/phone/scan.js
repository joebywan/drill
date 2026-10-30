// The body scan, which opens after the first two Calm lessons.
export default async ({ seed, touch, btn, shot, run }) => {
  await seed({ done: { 'calm:breathe1': true, 'calm:ground1': true } });
  await touch(btn('🌿 Calm')); await shot('calm-home');
  await touch(btn(/^Feet to head/)); await shot('teach');
  await touch(btn('Start')); await run(20000); await shot('zone2');
  await run(60000); await shot('later');
};
