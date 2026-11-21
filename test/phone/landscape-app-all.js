// The installed app turned on its side. Made for an upright phone (docs/WINGBEAT.md): on a phone the app stays upright
// (MainActivity, by the screen's smallest width), so this checks it did and that a lesson plays; on a tablet
// (`--avd daybook_tablet`, 600dp and wider) it turns, and plays the same tour as landscape-all.
// Build the debug APK first (CLAUDE.md, Android); with none, it says so and does nothing.
import { existsSync } from 'node:fs';
import tour from './lib/landscape.js';
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
  const smallest = Math.round(Math.min(w, hgt) / (dpi / 160));
  console.log(`  smallest width ${smallest}dp: ${smallest < 600 ? 'a phone, the app stays upright' : 'a tablet, the app turns'}`);
  if (smallest >= 600) return tour({ ...app, adb, check });
  await app.seed();
  try {
    await turn({ ...app, adb }, 'landscape');
    const size = () => app.page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    const home = await size();
    console.log(`  turned: ${adb('shell', 'dumpsys', 'window', 'displays').match(/mCurrentRotation=\S+/)?.[0] ?? ''}; page ${home.w}x${home.h}`);
    await app.shot('turned-home');
    check(`turned on its side, the app stays upright (page ${home.w}x${home.h})`, home.h > home.w);
    await app.touch(app.btn(/^Continue · /)); await app.run(1500);
    const lesson = await size();
    await app.shot('turned-lesson');
    check('a lesson opened with the phone on its side is upright and plays', lesson.h > lesson.w && !(await app.page.locator('.upright').isVisible()) && await app.page.locator('.stage').isVisible());
  } finally {
    await turn({ adb }, 'portrait');
  }
};
