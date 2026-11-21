// The installed app turned on its side. Made for an upright phone (docs/WINGBEAT.md): on a phone the app stays upright
// (MainActivity, by the screen's smallest width); on a tablet (`--avd daybook_tablet`, 600dp and wider) it turns, and a
// tablet on its side is tall enough to play as it is. Either way a lesson opened with the device turned plays, with no
// "turn upright" line. Build the debug APK first (CLAUDE.md, Android); with none, it says so and does nothing.
import { existsSync } from 'node:fs';
import { turn } from './lib/device.js';

const PKG = 'com.joebywan.wingbeat';
const APK = process.env.APP_APK || new URL('../../android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url).pathname;

export default async (h) => {
  if (!existsSync(APK)) { console.log(`  no APK at ${APK}: build it first (CLAUDE.md, Android)`); return; }
  const { adb, attach, check } = h;
  adb('install', '-r', APK);
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
  await new Promise((r) => setTimeout(r, 2500));
  const app = await attach(PKG);
  const [w, hgt] = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)\s*$/).slice(1).map(Number);
  const dpi = Number(adb('shell', 'wm', 'density').match(/(\d+)\s*$/)[1]);
  const phone = Math.round(Math.min(w, hgt) / (dpi / 160)) < 600;
  console.log(`  smallest width ${Math.round(Math.min(w, hgt) / (dpi / 160))}dp: ${phone ? 'a phone, the app stays upright' : 'a tablet, the app turns'}`);
  await app.seed();
  try {
    // A phone's app doesn't move, so no calibrate() (it blanks the page); a tablet's does, so measure it again there.
    await turn(phone ? { adb, run: app.run } : { ...app, adb }, 'landscape');
    if (!phone) await app.seed();
    const size = () => app.page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    const home = await size();
    console.log(`  turned: ${adb('shell', 'dumpsys', 'window', 'displays').match(/mCurrentRotation=\S+/)?.[0] ?? ''}; page ${home.w}x${home.h}`);
    await app.shot('turned-home');
    check(phone ? `on a phone turned on its side, the app stays upright (page ${home.w}x${home.h})` : `a tablet turned on its side turns the app (page ${home.w}x${home.h})`, phone ? home.h > home.w : home.w > home.h);
    await app.touch(app.btn(/^Continue · /)); await app.run(1500);
    await app.shot('turned-lesson');
    check('a lesson opened with the device on its side plays, with no "turn upright" line', !(await app.page.locator('.upright').isVisible()) && await app.page.locator('.stage').isVisible());
  } finally {
    await turn({ adb }, 'portrait');
  }
};
