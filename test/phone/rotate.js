// Turns the screen (`ROTATE=1` a quarter turn, 3 the other way) for the scenarios named after it in the same run:
// `ROTATE=1 npm run phone -- rotate home-states garden looks`. The emulator is read-only, so nothing lasts. With no
// ROTATE (a plain `npm run phone`) it does nothing.
import { turn } from './lib/device.js';

export default async (h) => {
  const to = process.env.ROTATE;
  if (!to) { console.log('  rotate: set ROTATE=1 (or 3) to turn the screen for the scenarios after it; skipped'); return; }
  await turn(h, to); // Chrome's toolbar moves with the screen: turn() measures where the page sits again
  await h.fresh();
  console.log(`  screen turned: user_rotation ${to}; ${h.adb('shell', 'dumpsys', 'window', 'displays').match(/mCurrentRotation=\S+/)?.[0] ?? ''}`);
};
