// The installed app on its side: it turns (no screenOrientation in the manifest, configChanges handles it), then the same tour
// as landscape-all. Build the debug APK first (CLAUDE.md, Android); with none, it says so and does nothing.
import { existsSync, readFileSync } from 'node:fs';
import tour from './lib/landscape.js';

const PKG = 'com.joebywan.wingbeat';
const APK = process.env.APP_APK || new URL('../../android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url).pathname;
const MANIFEST = new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url);

export default async (h) => {
  if (!existsSync(APK)) { console.log(`  no APK at ${APK}: build it first (CLAUDE.md, Android)`); return; }
  const { adb, attach, check } = h;
  console.log(`  manifest screenOrientation: ${/screenOrientation="([^"]+)"/.exec(readFileSync(MANIFEST, 'utf8'))?.[1] ?? '(not set: the activity follows the sensor)'}`);
  adb('install', '-r', APK);
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
  await new Promise((r) => setTimeout(r, 2500));
  const app = await attach(PKG);
  await tour({ ...app, adb, check });
};
