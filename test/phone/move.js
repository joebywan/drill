// Move: real-time waits so Clover's demo is caught mid-move, then the clock skips to the end.
export default async ({ page, seed, touch, btn, shot, run }) => {
  await seed();
  await touch(btn(/^Move(,|$)/)); await shot('home');
  await touch(btn(/^Continue/)); await shot('teach');
  await touch(btn('Start'));
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(1200); await shot(`exercise${i}`); await run(14000); }
  for (let i = 0; i < 40 && !(await btn('About the same').count()); i++) await run(10000);
  await shot('end');
  await touch(btn('About the same')); await touch(btn(/^Continue/)); await shot('home-after');
};
