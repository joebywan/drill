// Move: real-time waits so Clover's demo is caught mid-move, then the clock skips to the end.
// Then the first routine of each newer unit (Back and neck, Seated, Balance), on page.clock, with a shot of each move.
const BEFORE = ['wake1', 'wake2', 'wake3', 'strength1', 'strength2', 'strength3', 'stretch1', 'stretch2'];
const UNITS = [
  ['back', "Desk o'clock", ['back1', 'back2', 'back3']],
  ['seated', 'Chair day', ['seated1', 'seated2', 'seated3']],
  ['balance', 'Balance time', []],
];

export default async ({ page, seed, touch, btn, shot, run, check }) => {
  await seed();
  await touch(btn(/^Move(,|$)/)); await shot('home');
  await touch(btn(/^Continue/)); await shot('teach');
  await touch(btn('Start'));
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(1200); await shot(`exercise${i}`); await run(14000); }
  for (let i = 0; i < 40 && !(await btn('About the same').count()); i++) await run(10000);
  await shot('end');
  await touch(btn('About the same')); await touch(btn(/^Continue/)); await shot('home-after');

  let done = BEFORE;
  for (const [unit, hello, lessons] of UNITS) {
    await seed({ done: Object.fromEntries(done.map((id) => [`move:${id}`, true])) });
    await touch(btn(/^Move(,|$)/));
    await touch(btn(/^Continue/)); await shot(`${unit}-teach`);
    check(`${unit}: its teach card opens`, await page.getByText(hello, { exact: false }).first().isVisible());
    check(`${unit}: the safety line is on its first lesson`, await page.getByText('stop if anything hurts', { exact: false }).first().isVisible());
    await touch(btn('Start'));
    // Every move as it comes up, Clover demonstrating it (standing, seated or at the wall).
    const seen = new Set();
    for (let i = 0; i < 150 && !(await btn('About the same').count()); i++) {
      const now = (await page.locator('.steps li.now').textContent().catch(() => '')).replace(/\s*\d.*$/, ''); // the move, not its count
      if (now && now !== 'Rest' && !seen.has(now)) {
        seen.add(now);
        await page.waitForTimeout(1200); await shot(`${unit}-${now.toLowerCase().replace(/\W+/g, '-')}`);
      }
      await run(3000);
    }
    await shot(`${unit}-end`);
    check(`${unit}: the routine reaches its end screen`, Boolean(await btn('About the same').count()));
    await touch(btn('About the same')); await touch(btn(/^Continue/));
    done = [...done, ...lessons];
  }
};
