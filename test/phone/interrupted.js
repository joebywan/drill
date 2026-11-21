// A phone that rings and is pulled at: an incoming call (answered and ended, then declined) and the notification shade
// pulled down and put back, during a Maths answer and during a Calm routine with its bell and rain on. After each: is
// the app where it was, did its sound give way while the call was up, and come back as it should (the routine's own
// pause, the rain's suspend and resume)? The emulator's own phone (adb emu gsm) makes the calls.
import { readFileSync } from 'node:fs';
import { right } from '../../src/maths/items.js';
import { awake, sleep, stateOf, within } from './lib/device.js';
import { playMaths } from './lib/seed.js';

const maths = JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url))).units[0].lessons[0];
const NUMBER = '5551234';

export default async (h) => {
  const { page, adb, seed, touch, btn, shot, run, check, playing } = h;
  const notes = process.env.INTERRUPT_NOTES ?? new URL('../../test-results/phone/interrupted/', import.meta.url).pathname;
  const say = (m) => console.log(`  ${m}`);
  const sh = (...a) => adb('shell', ...a);
  const callState = () => (sh('dumpsys', 'telephony.registry').match(/mCallState=(\d)/) || [])[1]; // 0 idle, 1 ringing, 2 off hook
  const front = () => (sh('dumpsys', 'window').match(/mCurrentFocus=.*?\{[^ ]+ [^ ]+ ([^ }]+)/) || [])[1];
  const count = () => within(page.locator('.count').first().textContent(), 3000, '(no answer)');
  const pause = () => within(page.locator('.practice-pause').getAttribute('aria-pressed'), 3000, '(no answer)');
  const hidden = () => within(page.evaluate(() => document.hidden), 3000, 'frozen');
  const back = async () => { sh('monkey', '-p', h.pkg, '-c', 'android.intent.category.LAUNCHER', '1'); await sleep(2500); };

  // The call: rings, is answered (or declined), talks a while, ends.
  const call = async (label, how, during = async () => {}) => {
    adb('emu', 'gsm', 'call', NUMBER); await sleep(3500);
    const ringing = callState();
    const rang = { front: front(), hidden: await hidden(), sound: playing() };
    await shot(`${label}-ringing`);
    say(`${label}: ringing (call state ${ringing}), in front: ${rang.front}, page hidden: ${rang.hidden}, sound: ${JSON.stringify(rang.sound)}`);
    if (how === 'answer') {
      sh('input', 'keyevent', 'KEYCODE_CALL'); await sleep(3000);
      const talk = { state: callState(), front: front(), hidden: await hidden(), sound: playing() };
      await shot(`${label}-in-call`);
      say(`${label}: in the call (state ${talk.state}), in front: ${talk.front}, page hidden: ${talk.hidden}, sound: ${JSON.stringify(talk.sound)}`);
      await during(talk);
      await sleep(4000);
      adb('emu', 'gsm', 'cancel', NUMBER); await sleep(2500);
    } else {
      sh('input', 'keyevent', 'KEYCODE_ENDCALL'); await sleep(2500);
    }
    say(`${label}: after it, call state ${callState()}, in front: ${front()}`);
    await shot(`${label}-after`);
    if (!/chrome/.test(front() ?? '')) await back();
    return { rang, ringing };
  };

  // 1. A lesson: an answer given, the verdict up.
  await seed();
  await touch(page.locator('[data-course="maths"]'));
  await touch(btn(`Continue · ${maths.title}`));
  await playMaths(maths, h, 1);
  const pick = maths.items[1];
  await touch(page.locator('.choices').getByRole('button', { name: pick.options.find((o) => right(pick, o)), exact: true }));
  await page.locator('.foot.show').waitFor();
  await sleep(2000); // the answer's little pop of stars is over
  for (const [label, how] of [['lesson-answered', 'answer'], ['lesson-declined', 'decline']]) {
    const before = await stateOf(page);
    await call(label, how);
    const after = await stateOf(page);
    check(`${label}: the lesson is where it was`, before.text === after.text);
    check(`${label}: the saved progress is untouched`, before.saved === after.saved);
  }
  {
    const before = await stateOf(page);
    sh('cmd', 'statusbar', 'expand-notifications'); await sleep(1500); await shot('lesson-shade-down');
    const open = { hidden: await hidden() };
    sh('cmd', 'statusbar', 'collapse'); await sleep(1500); await shot('lesson-shade-up');
    const after = await stateOf(page);
    say(`lesson, shade down: page hidden ${open.hidden}`);
    check('lesson: after the shade is pulled down and put back, the screen is as it was', before.text === after.text);
    check('lesson: Continue still works', await btn('Continue').isVisible());
    await touch(btn('Continue'));
  }

  // 2. A Calm routine with the bell and rain on.
  await seed();
  await page.evaluate(() => { localStorage.setItem('wingbeat.bell', 'on'); localStorage.setItem('wingbeat.rain', 'on'); });
  await page.reload({ waitUntil: 'networkidle' }); await run(800);
  const start = async () => { await touch(btn(/^Calm(,|$)/)); await touch(btn(/^Continue · /)); await touch(btn('Start')); await run(2500); };
  await start();
  const running = async (label) => {
    // Each interruption meets a routine with time left: real time runs on page.clock too, and a slower browser (Firefox, through
    // the bridge) can reach the routine's end during the calls before. On its last breath or ended, it starts afresh from home.
    const last = /Breath (\d+) of \1\b/.test(await page.evaluate(() => document.getElementById('app').innerText));
    if (last || await page.locator('.summary').count()) { await page.reload({ waitUntil: 'networkidle' }); await run(800); await start(); say(`${label}: the routine was on its last breath or ended: started again`); }
    if (await pause() === 'true') { await touch(page.locator('.practice-pause')); await run(2500); }
    const s = { count: await count(), sound: playing(), hidden: await hidden() };
    say(`${label}: routine running: count ${s.count}, sound ${JSON.stringify(s.sound)}`);
    check(`${label}: the routine's rain is a started stream before the interruption`, s.sound.started && s.sound.track, JSON.stringify(s.sound));
    return s;
  };
  for (const [label, how] of [['calm-answered', 'answer'], ['calm-declined', 'decline']]) {
    const s0 = await running(label);
    const { rang } = await call(label, how, async (talk) => { await sleep(0); });
    const [c1, p1, hid] = [await count(), await pause(), await hidden()];
    const snd = playing();
    say(`${label}: afterwards count ${c1} (was ${s0.count}), paused ${p1}, page hidden ${hid}, sound ${JSON.stringify(snd)}`);
    await shot(`${label}-routine-after`);
    check(`${label}: the routine did not run on through the call`, p1 === 'true' || c1 === s0.count || rang.hidden === false, `count ${s0.count} -> ${c1}, paused ${p1}, hidden during ${rang.hidden}`);
    if (p1 === 'true') { await touch(page.locator('.practice-pause')); await run(2500); }
    const after = playing();
    check(`${label}: carrying on, the rain is a started stream again`, after.started && after.track, JSON.stringify(after));
  }
  {
    const s0 = await running('calm-shade');
    sh('cmd', 'statusbar', 'expand-notifications'); await sleep(2000);
    const down = { hidden: await hidden(), sound: playing(), count: await count(), paused: await pause() };
    await shot('calm-shade-down');
    say(`calm, shade down: page hidden ${down.hidden}, sound ${JSON.stringify(down.sound)}, count ${down.count}, paused ${down.paused}`);
    sh('cmd', 'statusbar', 'collapse'); await sleep(2000);
    const up = { hidden: await hidden(), sound: playing(), count: await count(), paused: await pause() };
    await shot('calm-shade-up');
    say(`calm, shade up: page hidden ${up.hidden}, sound ${JSON.stringify(up.sound)}, count ${up.count} (was ${s0.count}), paused ${up.paused}`);
    check('calm: with the shade back up the routine is running or paused, never lost', up.count !== '(no answer)');
    check('calm: the rain is heard again once the shade is up (unless the routine is paused)', up.paused === 'true' || (up.sound.started && up.sound.track), JSON.stringify(up));
  }
  say(`wake lock at the end: ${JSON.stringify(await awake(h, notes, 'end'))}`);
};
