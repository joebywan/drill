// The installed app put down with no debugger on it (see lib/bare.js). Build the debug APK first (CLAUDE.md, Android).
import { existsSync } from 'node:fs';
import { bareTour } from './lib/bare.js';

const PKG = 'com.joebywan.wingbeat';
const APK = process.env.APP_APK || new URL('../../android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url).pathname;

export default async (h) => {
  if (!existsSync(APK)) { console.log(`  no APK at ${APK}: build it first (CLAUDE.md, Android)`); return; }
  h.adb('install', '-r', APK);
  h.adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
  await new Promise((r) => setTimeout(r, 2500));
  const app = await h.attach(PKG);
  await bareTour({ ...app, adb: h.adb, check: h.check, declinePrompts: h.declinePrompts }, PKG, 'away-bare-app');
};
