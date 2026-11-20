// Turns the screen (`ROTATE=1` a quarter turn, 3 the other way; default 1) for the scenarios named after it in the
// same run: `ROTATE=1 npm run phone -- rotate home-states garden looks`. The emulator is read-only, so nothing lasts.
export default async ({ adb, calibrate, fresh }) => {
  const turn = process.env.ROTATE || '1';
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
  adb('shell', 'settings', 'put', 'system', 'user_rotation', turn);
  await new Promise((r) => setTimeout(r, 2500));
  await calibrate(); // Chrome's toolbar moves with the screen: measure where the page sits again
  await fresh();
  console.log(`  screen turned: user_rotation ${turn}; ${adb('shell', 'dumpsys', 'window', 'displays').match(/mCurrentRotation=\S+/)?.[0] ?? ''}`);
};
