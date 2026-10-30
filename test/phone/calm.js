// Calm breathing on the phone, with the sound and haptics checks a desktop browser can't do.
export default async ({ seed, touch, btn, shot, run, checkSound, vibrations, check }) => {
  await seed();
  await touch(btn(/^Calm(,|$)/)); await shot('calm-home');
  await touch(btn('Continue · The long out-breath')); await shot('teach');
  const buzzed = vibrations();
  await touch(btn('Start')); await run(1500); await shot('inhale');
  checkSound();
  await run(4000); await shot('exhale');
  check('haptics: new com.android.chrome vibrations (dumpsys vibrator_manager)', vibrations() > buzzed);
  await run(40000); await shot('end');
  await touch(btn('Calmer')); await shot('felt');
  await touch(btn(/^Continue/)); await shot('home-after');
};
