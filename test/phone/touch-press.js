// A finger held down, and a finger tapping twice: on a path node, a Coding tile and the chess board. A long press must
// not select text, open a menu (the system's text toolbar or link menu, seen in the UI tree) or hand the page a context
// menu it did not ask for; a double tap must not zoom the page nor press anything twice that one press should do once.
export default async ({ page, seed, touch, press, doubleTap, btn, shot, check, adb, screenXml, run }) => {
  const arm = () => page.evaluate(() => {
    window.__t = { clicks: [], menus: 0, down: 0 };
    if (window.__armed) return; // listeners go on once a page; they write to the current window.__t
    window.__armed = true;
    document.addEventListener('click', () => window.__t.clicks.push(Math.round(performance.now())), true);
    document.addEventListener('contextmenu', () => window.__t.menus++, true);
    document.addEventListener('pointerdown', () => window.__t.down++, true);
  });
  const centre = async (loc) => { const b = await loc.first().boundingBox(); return b; };
  const MENU = /text="(Copy|Share|Select all|Search|Open in new tab|Open link|Copy link address|Download image|Web search)"/;
  /** What a hold or a double tap left behind, with the checks that apply to either. */
  const after = async (what) => {
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => ({ sel: String(getSelection()), clicks: window.__t.clicks, menus: window.__t.menus, down: window.__t.down, scale: visualViewport.scale }));
    const ui = await screenXml();
    const menu = ui.match(MENU)?.[1];
    await shot(what.replace(/\W+/g, '-'));
    check(`${what}: nothing selected`, s.sel === '', JSON.stringify(s.sel));
    check(`${what}: no system menu or toolbar`, !menu, `${menu ?? 'none in the UI tree'}; contextmenu events: ${s.menus}`);
    check(`${what}: page not zoomed`, s.scale === 1, String(s.scale));
    console.log(`  ${what}: ${s.down} touches, ${s.clicks.length} click(s)${s.clicks.length > 1 ? `, ${s.clicks[1] - s.clicks[0]} ms apart` : ''}`);
    return s;
  };
  // A path node: held (it should do what a tap does, once), then home again and pressed twice.
  await seed();
  await touch(page.locator('[data-course="chess"]'));
  const node = page.locator('.node.here');
  await arm(); await press(node, 900);
  let s = await after('long press on a path node');
  check('long press on a node: at most one press (Chrome sends none for a hold)', s.clicks.length <= 1, `${s.clicks.length} clicks, home ${await page.locator('.home').count() ? 'still showing' : 'gone'}`);
  await touch(btn(/Back|Close|Leave|✕|×/)).catch(() => {});
  await page.waitForTimeout(800);
  await seed(); await touch(page.locator('[data-course="chess"]'));
  await arm(); await doubleTap(page.locator('.node.here'));
  s = await after('double tap on a path node');
  const mains = await page.locator('main').count();
  check('double tap on a node: one lesson opened, one item showing', mains === 1 && await page.locator('.quiz, .stage, .lesson').count() >= 1, `${mains} main elements`);

  // The chess board: go on past teach cards until one shows it.
  await seed(); await touch(page.locator('[data-course="chess"]'));
  await touch(btn(/^Continue ·/));
  for (let i = 0; i < 14 && !(await page.locator('.board:visible').count()); i++) { await touch(btn('Continue', { exact: true })); }
  if (await page.locator('.board:visible').count()) {
    await arm(); const square = page.locator('.board').first();
    await press(square, 900); await after('long press on the board');
    const fen0 = await page.locator('.board').first().innerHTML().then((h) => h.length);
    await arm(); await doubleTap(square); await after('double tap on the board');
    check('the board is still drawn after both', fen0 > 0 && await page.locator('.board:visible').count() >= 1);
  } else check('a board was reached', false, 'no .board in the first 14 screens');

  // A Coding tile.
  await seed(); await touch(page.locator('[data-course="coding"]'));
  await touch(btn(/^Continue ·/));
  for (let i = 0; i < 14 && !(await page.locator('.tiles [data-tile]:visible').count()); i++) await touch(btn('Continue', { exact: true }));
  const tiles = page.locator('.tiles [data-tile]');
  if (await tiles.count()) {
    const placed = () => page.evaluate(() => document.querySelectorAll('.program .token, .program .block, .program [data-tile]').length);
    const p0 = await placed();
    await arm(); await press(tiles.first(), 900); await after('long press on a tile');
    const p1 = await placed();
    check('long press on a tile: placed once, like a tap', p1 - p0 <= 1, `${p0} -> ${p1}`);
    await arm(); await doubleTap(tiles.nth(1)); await after('double tap on a tile');
    const p2 = await placed();
    check('double tap on a tile: placed once, not twice', p2 - p1 <= 1, `${p1} -> ${p2}`);
  } else check('a tile was reached', false, 'no .tiles [data-tile] in the first 14 screens');
};
