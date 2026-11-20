// Play Rosa on the phone, at each of her four levels (LEVELS in src/chess/engine.js), by real touch. Our side is chosen by a
// plain rule on chess.js (legal, prefer captures and safe squares, never hang the queen if it can be helped); a mirror game
// follows what the page's board shows, so every reply of hers must be a legal move from where the game was. Checks: she answers
// inside her budget, the page keeps drawing while she thinks (the real requestAnimationFrame gap), Hint shows a legal move,
// Take back takes back, a promotion asks, Resign ends it in her words; at Warm-up the game is played to its end (or 60 moves)
// and the banner's button starts a new game. `ROSA_MOVES=10` moves each side at levels 1 to 3; `ROSA_LEVELS=0,2` only those.
import { Chess } from 'chess.js';
import { LEVELS, bestMove } from '../../src/chess/engine.js';
import { words } from '../../src/chess/items.js';
import { follow, openGame, placement, promote, square } from './lib/chess.js';

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START = new Chess().fen().split(' ')[0];

/** A simple rule, not a good player: take what is free, push pawns, keep every piece off a square it can be taken on. */
function choose(g) {
  const me = g.turn(), them = me === 'w' ? 'b' : 'w';
  let best = null;
  for (const m of g.moves({ verbose: true })) {
    let s = Math.random() * 0.5;
    s += (VALUE[m.captured] ?? 0) * 10 + (m.promotion ? 80 : 0);
    g.move(m);
    if (g.isCheckmate()) s += 10000;
    if (g.isAttacked(m.to, them)) { // taken there: lose the piece unless it is covered and worth no more than what it took
      const covered = g.isAttacked(m.to, me);
      s -= VALUE[m.piece] * (m.piece === 'q' ? 100 : covered && VALUE[m.piece] <= (VALUE[m.captured] ?? 0) ? 0 : 10);
    }
    if (m.piece === 'p') s += 1;
    g.undo();
    if (!best || s > best.s) best = { s, m };
  }
  return best.m;
}

export default async (h) => {
  const { page, touch, dragTo, shot, run, check, seed, btn } = h;
  const wait = async (pred, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await pred()) return Date.now() - t; await new Promise((r) => setTimeout(r, 120)); } return null; };
  let dragged = false;
  const levels = (process.env.ROSA_LEVELS ?? '0,1,2,3').split(',').map(Number);
  const many = Number(process.env.ROSA_MOVES ?? 10);

  for (const lv of levels) {
    const L = LEVELS[lv], tag = `level ${lv} (${L.depth} ply, ${L.ms} ms)`;
    console.log(`-- ${tag}`);
    await seed({});
    await openGame(h, 'rosa');
    await touch(page.locator(`[data-level="${lv}"]`));
    await page.evaluate(() => {
      window.__maxGap = 0; // the longest the page went without drawing: a real frame loop, timed on the page's clock
      (function f() { const t = performance.now(); window.__maxGap = Math.max(window.__maxGap, t - (window.__last ?? t)); window.__last = t; window.__frame(f); })();
    });
    await page.evaluate(() => { // how long she thinks (bubble "Hm. Let me see." until it says her move), and the longest frame gap meanwhile
      const el = document.getElementById('said');
      window.__think = [];
      let t = null;
      new MutationObserver(() => {
        const x = el.textContent;
        if (x === 'Hm. Let me see.' && t === null) { t = performance.now(); window.__maxGap = 0; }
        else if (t !== null && x !== 'Hm. Let me see.') { window.__think.push([Math.round(performance.now() - t), Math.round(window.__maxGap)]); t = null; }
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    const g = new Chess();
    const longGame = lv === 0 && !process.env.ROSA_MOVES;
    const max = longGame ? 60 : many;
    // Whose move is it? Rosa's if the board moves by itself.
    const opened = await wait(async () => (await placement(page)) !== START, L.ms + 4000);
    if (opened !== null) { check(`${tag}: she opened (I am Black) within her budget`, !!(await follow(page, g)), `${opened} ms`); }
    const me = g.turn();
    let ended = false, promoted = false, tookBack = false, hinted = false;
    for (let i = 0; i < max && !g.isGameOver(); i++) {
      // Hint and Take back, once each, at the levels that have them
      if (L.helps && i === 4 && !hinted) {
        hinted = true;
        await touch(page.locator('[data-hint]'));
        const ok = await wait(() => page.evaluate(() => /I would try/.test(document.getElementById('said').textContent)), 8000);
        const text = await page.evaluate(() => document.getElementById('said').textContent);
        const legal = g.moves().map((s) => `I would try this: ${words(s).replace(/, check(mate)?$/, '')}.`);
        check(`${tag}: Hint shows a legal move`, ok !== null && legal.includes(text), text);
        await shot(`l${lv}-hint`);
      }
      if (L.helps && i === 6 && !tookBack) {
        tookBack = true;
        const keep = g.fen().split(' ')[0];
        g.undo(); g.undo(); // mine as played, and hers
        const back = g.fen().split(' ')[0];
        await touch(page.locator('[data-back]'));
        await run(500);
        check(`${tag}: Take back takes both moves back`, await placement(page) === back && back !== keep);
        await shot(`l${lv}-takeback`);
      }
      // The long game at Warm-up is for seeing its end: my side plays the engine's own depth 3 to mate her; her replies are still read off the page.
      const san = longGame && i >= 6 ? bestMove(g, { ...LEVELS[2], ms: 700 }) : null;
      const m = san ? g.moves({ verbose: true }).find((x) => x.san === san) : choose(g);
      const was = await placement(page);
      if (!dragged) { dragged = true; await dragTo(square(page, m.from), square(page, m.to)); check(`${tag}: drag ${m.from}-${m.to} moved the piece`, await wait(async () => (await placement(page)) !== was, 3000) !== null); }
      else { await touch(square(page, m.from)); await touch(square(page, m.to)); }
      if (m.promotion) {
        promoted = true;
        const asked = await page.locator('.promotion-dialog-button-group').count();
        check(`${tag}: ${m.san} asks what to promote to`, asked > 0);
        await shot(`l${lv}-promotion`);
        await promote(h, m.promotion);
      }
      g.move(m);
      if (g.isGameOver()) break;
      const mine = g.fen().split(' ')[0];
      const took = await wait(async () => (await placement(page)) !== mine, L.ms + 6000);
      if (took === null) { check(`${tag}: she answered move ${i + 1}`, false, 'no move within budget + 6 s'); await shot(`l${lv}-silent`); break; }
      const reply = await follow(page, g);
      if (!reply) { check(`${tag}: her reply after move ${i + 1} is a legal move`, false, await placement(page)); await shot(`l${lv}-illegal`); break; }
      if (i === Math.min(5, max - 2)) await shot(`l${lv}-midgame`);
    }
    const think = await page.evaluate(() => window.__think);
    const worst = Math.max(0, ...think.map((t) => t[0])), gap = Math.max(0, ...think.map((t) => t[1]));
    check(`${tag}: ${think.length} replies, each inside her budget (${L.ms} ms, plus the 400 ms floor and the slices)`, think.length > 0 && worst < L.ms + 1500, `slowest ${worst} ms`);
    check(`${tag}: the page kept drawing while she thought (longest gap between frames)`, gap < 1000, `${gap} ms`);
    console.log(`  ${tag}: ${g.history().length} plies, her thinking ${think.map((t) => t[0]).join(' ')} ms, longest frame gap ${gap} ms, promoted ${promoted}, game over ${g.isGameOver()}`);
    if (g.isGameOver()) {
      ended = await wait(() => page.locator('.foot.show').count(), 6000) !== null;
      await shot(`l${lv}-end`);
      if (ended) {
        const [head, label] = await page.evaluate(() => [document.querySelector('.foot strong').textContent, document.querySelector('.foot .next').textContent]);
        console.log(`  end: "${head}" / button "${label}", game over ${g.isGameOver()}, mate ${g.isCheckmate()}, I am ${me}`);
        check(`${tag}: the banner's button is Play again`, label === 'Play again');
        await touch(page.locator('.foot .next'));
        const fresh = await wait(() => page.locator('[data-level]').count(), 5000);
        check(`${tag}: Play again offers the levels again`, fresh !== null);
        await shot(`l${lv}-again`);
      } else check(`${tag}: a finished game shows its banner`, false);
    }
    if (lv === 1 || !ended) { // Resign: Sure? then her words
      await touch(page.locator('[data-resign]'));
      check(`${tag}: Resign asks "Sure?"`, (await page.locator('[data-resign]').textContent()) === 'Sure?');
      await touch(page.locator('[data-resign]'));
      const ok = await wait(() => page.locator('.foot.show').count(), 5000);
      const text = await page.evaluate(() => document.querySelector('.foot')?.textContent ?? '');
      check(`${tag}: resigning ends it in her words`, ok !== null && /We can stop there/.test(text), text.slice(0, 60));
      await shot(`l${lv}-resigned`);
    }
  }
};
