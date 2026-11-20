// Calm breathing on the phone, with the sound and haptics checks a desktop browser can't do.
export default async ({ page, seed, touch, btn, shot, run, checkSound, vibrations, check }) => {
  await seed();
  // The bell is off until turned on; turning it on rings it once. Nothing else has played since
  // the reload, so Chrome's stream starting here is the bell.
  await touch(btn('Settings'));
  await touch(btn(/^A soft bell/)); await run(800); await shot('bell-on');
  checkSound();
  await touch(btn('Back'));
  await touch(btn(/^Calm(,|$)/)); await shot('calm-home');
  await touch(btn('Continue · The long out-breath')); await shot('teach');
  const buzzed = vibrations();
  await touch(btn('Start')); await run(1500); await shot('inhale');
  checkSound();
  await run(4000); await shot('exhale');
  check('haptics: new vibrations (dumpsys vibrator_manager)', vibrations() > buzzed);
  await run(40000); await shot('end');
  checkSound(); // the closing bell, still ringing out on the end screen
  await touch(btn('Calmer')); await shot('felt');
  await touch(btn(/^Continue/)); await shot('home-after');

  // A finished path: home suggests the routine done least recently, the list opens, and a day away from the app counts and undoes.
  const ids = ['breathe1', 'breathe2', 'breathe3', 'ground1', 'ground2', 'scan1', 'scan2', 'sigh1', 'sigh2', 'hug1', 'hug2'];
  const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const last = ['scan2', 'breathe3', 'ground2', 'sigh2', 'hug2']; // scan2 is the least recent
  await seed({ version: 10, done: Object.fromEntries(ids.map((id) => [`calm:${id}`, true])), habits: { calm: { count: 5, last: ago(3), forgiven: [], days: 5 } },
    log: last.map((id, i) => ({ date: ago(8 - i), hour: 19, habit: 'calm', title: id, mins: 1, lesson: `calm:${id}` })) });
  await touch(btn(/^Calm(,|$)/)); await shot('finished-home');
  check('suggests the least recent routine', await page.getByRole('button', { name: 'Breathe · A slower scan' }).count() === 1);
  await touch(btn('Something else')); await shot('list');
  await touch(btn('I did it away from the app')); await shot('counted');
  const logged = () => page.evaluate(() => JSON.parse(localStorage.getItem('wingbeat.progress')).log.at(-1));
  check('counted as away', (await logged()).title === 'Away from the app');
  await touch(btn('Undo')); await shot('undone');
  check('undone', (await logged()).title !== 'Away from the app');
};
