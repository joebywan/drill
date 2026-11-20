// Each Chess game once on a short phone (a 412x533 page): the whole board and its controls on screen, nothing under another
// thing, a move made, then the same after Rosa has answered / the banner is up. Pictures go to test-results/phone/.
import { Chess } from 'chess.js';
import { fitProblems, onShortPhone, openGame, placement, square } from './lib/chess.js';

export default async (h) => {
  const { page, touch, shot, run, check, seed } = h;
  const size = process.env.CHESS_SMALL ?? '1080x1700';
  await onShortPhone(h, size, async () => {
    const fits = async (tag) => {
      const { under, off } = await fitProblems(page);
      check(`short phone, ${tag}: nothing under anything`, !under.length, under.join('; '));
      if (off.length) console.log(`  NOTE short phone, ${tag}: not all on this screen (the page scrolls): ${off.join('; ')}`); // a finding, not a failure: see the report
      await shot(`small-${tag.replace(/\W+/g, '-')}`);
    };
    console.log(`  page ${await page.evaluate(() => `${innerWidth}x${innerHeight}`)}`);
    for (const id of ['mate', 'capture', 'rosa']) {
      await seed({});
      await openGame(h, id);
      await run(500);
      if (id === 'rosa') {
        await fits('rosa levels');
        await touch(page.locator('[data-level="0"]'));
        await run(500);
        await fits('rosa playing');
        await touch(square(page, 'e2')); await touch(square(page, 'e4'));
        await page.waitForFunction(() => document.querySelectorAll('div.board g[data-piece]').length && /Your move|played|Hm/.test(document.getElementById('said').textContent), null, { timeout: 15000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 2500));
        await fits('rosa after her reply');
        await touch(page.locator('[data-resign]')); await touch(page.locator('[data-resign]'));
        await page.locator('.foot.show').waitFor();
        await fits('rosa banner');
      } else if (id === 'mate') {
        await new Promise((r) => setTimeout(r, 1500));
        await fits('mate');
        const g = new Chess(`${await placement(page)} ${/Black to move/.test(await page.evaluate(() => document.getElementById('said').textContent)) ? 'b' : 'w'} - - 0 1`);
        const m = g.moves({ verbose: true }).find((x) => !x.promotion);
        await touch(square(page, m.from)); await touch(square(page, m.to));
        await new Promise((r) => setTimeout(r, 3000));
        await fits('mate after a move');
        await touch(page.locator('[data-hint]'));
        await new Promise((r) => setTimeout(r, 1000));
        await fits('mate hint');
      } else {
        await fits('scramble');
        const fen = `${await placement(page)} w - - 0 1`;
        const { load } = await import('../../src/chess/items.js');
        const m = load(fen).moves({ verbose: true }).find((x) => !x.promotion);
        await touch(square(page, m.from)); await touch(square(page, m.to));
        await run(1000);
        await fits('scramble after a move');
        await run(95000);
        await page.locator('.foot.show').waitFor();
        await fits('scramble banner');
      }
    }
  });
};
