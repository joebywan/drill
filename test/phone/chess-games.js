// Chess's Mate and Scramble games (src/chess/games.js) by real touch. Mate: a mate in 2, 3 and 4 solved with the lines
// src/chess/prover.js finds (a drag for the first move), the Hint, then a wrong first move and Undo. The opponent's reply is
// read off the page's board and must be a legal move. Scramble: a round played to the end of its clock (page.clock runs the
// 90 s), the score on the banner, the best kept in storage and shown on the next round. Play Rosa is chess-rosa-all.
import { Chess } from 'chess.js';
import { forcedMate } from '../../src/chess/prover.js';
import { VALUE } from '../../src/chess/capture.js';
import { load } from '../../src/chess/items.js';
import { follow, openGame, placement, promote, square } from './lib/chess.js';

export default async (h) => {
  const { page, touch, dragTo, shot, run, check, seed } = h;
  const wait = async (pred, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await pred()) return Date.now() - t; await new Promise((r) => setTimeout(r, 150)); } return null; };
  const said = () => page.evaluate(() => document.getElementById('said')?.textContent ?? '');
  const hasSaid = (re) => wait(async () => re.test(await said()), 25000);
  let dragged = false;

  /** The game on the page as chess.js has it: its placement, whose move the bubble says it is. */
  const mirror = async () => {
    const side = /Black to move/.test(await said()) ? 'b' : 'w';
    return new Chess(`${await placement(page)} ${side} - - 0 1`);
  };
  const play = async (tag, g, m) => {
    const was = await placement(page);
    if (!dragged) { dragged = true; await dragTo(square(page, m.from), square(page, m.to)); check(`${tag}: drag ${m.from}-${m.to} moved the piece`, await wait(async () => (await placement(page)) !== was, 3000) !== null); }
    else { await touch(square(page, m.from)); await touch(square(page, m.to)); }
    if (m.promotion) await promote(h, m.promotion);
  };

  await seed({});
  await openGame(h, 'mate');
  for (const tier of [2, 3, 4]) {
    const tag = `mate in ${tier}`;
    console.log(`-- ${tag}`);
    if (tier !== 2) await touch(page.locator(`[data-tier="${tier}"]`));
    check(`${tag}: the bubble says what to find`, await hasSaid(new RegExp(`checkmate in ${tier}`)) !== null);
    await run(300);
    const g = await mirror();
    await shot(`mate${tier}-start`);
    if (tier === 2) { // Hint, then Explain: the board does not move
      const box = await page.locator('div.board').boundingBox();
      await touch(page.locator('[data-hint]'));
      await touch(page.locator('[data-hint]'));
      const note = await wait(async () => (await page.locator('.game-note').textContent()).length > 10, 15000);
      check(`mate in 2: Hint then Explain gives a note`, note !== null, await page.locator('.game-note').textContent());
      check(`mate in 2: the board stays where it was`, JSON.stringify(await page.locator('div.board').boundingBox()) === JSON.stringify(box));
      await shot('mate2-hint');
    }
    for (let left = tier; left > 0; left--) {
      const res = forcedMate(g.fen(), left);
      if (!res) { check(`${tag}: the prover finds a mate in ${left} from the page's position`, false, g.fen()); break; }
      const key = res.keys[0];
      const m = g.move({ from: key.slice(0, 2), to: key.slice(2, 4), promotion: key[4] });
      await play(tag, g, m);
      if (left > 1) {
        const mine = g.fen().split(' ')[0];
        if (await wait(async () => (await placement(page)) !== mine, 20000) === null) { check(`${tag}: the reply after ${m.san}`, false, 'none in 20 s'); break; }
        const reply = await follow(page, g);
        check(`${tag}: the reply (${reply?.san}) is a legal move`, !!reply);
        if (!reply) break;
        if (left === 2 || tier === 4) await shot(`mate${tier}-move${tier - left + 1}`);
      }
    }
    const banner = await wait(() => page.locator('.foot.show').count(), 15000);
    check(`${tag}: solved, banner shown`, banner !== null);
    await shot(`mate${tier}-solved`);
    if (banner !== null) check(`${tag}: the banner's button is Another board`, (await page.locator('.foot .next').textContent()) === 'Another board', await said());
    if (tier === 4) await touch(page.locator('.foot .next')); // a fresh board, for the wrong move below
  }

  // A wrong first move, on a fresh mate in 4: what it says, then Undo
  console.log('-- a wrong first move');
  await hasSaid(/Another board/);
  await run(300);
  await page.waitForFunction(() => !document.querySelector('[data-hint]').disabled, null, { timeout: 25000 }).catch(() => {}); // the prover has looked
  await run(500);
  const g = await mirror();
  const start = g.fen().split(' ')[0];
  const keys = forcedMate(g.fen(), 4).keys.map((k) => k.slice(0, 4));
  const wrong = g.moves({ verbose: true }).find((m) => !keys.includes(m.from + m.to) && !m.promotion && !g.isCheckmate());
  await touch(square(page, wrong.from)); await touch(square(page, wrong.to));
  const slipped = await hasSaid(/Undo and look again|no forced mate|stalemate/);
  check(`wrong move ${wrong.san}: called out, with Undo offered`, slipped !== null, await said());
  await shot('mate-wrong');
  console.log(`  it said: ${await said()}`);
  check(`wrong move: Hint is off until it is taken back`, await page.locator('[data-hint]').isDisabled());
  await touch(page.locator('[data-undo]'));
  check(`wrong move: Undo puts the board back`, await wait(async () => (await placement(page)) === start, 5000) !== null);
  check(`wrong move: Rosa says it is taken back`, await hasSaid(/Taken back/) !== null, await said());
  await shot('mate-undone');

  // Scramble
  console.log('-- Scramble');
  await seed({});
  await openGame(h, 'capture');
  dragged = false;
  const hud = (q) => page.locator(q).textContent();
  const before = Number(await page.evaluate(() => JSON.parse(localStorage.getItem('wingbeat.capture.best') ?? '0')));
  let score = 0, hits = 0;
  await shot('scramble-start');
  for (let i = 0; i < 16; i++) {
    const fen = `${await placement(page)} w - - 0 1`;
    const moves = load(fen).moves({ verbose: true }).filter((m) => !m.promotion);
    if (!moves.length) break;
    moves.sort((a, b) => (VALUE[b.captured] ?? 0) - (VALUE[a.captured] ?? 0));
    const m = moves[0];
    await play('scramble', null, m);
    await run(900);
    const now = Number(await hud('.hud-score'));
    if (now < score) check('scramble: the score never goes down', false, `${score} -> ${now}`);
    score = now;
    if (i === 5) await shot('scramble-mid');
  }
  const clockMid = await hud('.hud-clock');
  console.log(`  after 16 moves: score ${score}, clock ${clockMid}`);
  check('scramble: the clock started on the first move', clockMid !== '1:30');
  await run(95000); // the rest of the 90 s
  const over = await wait(() => page.locator('.foot.show').count(), 10000);
  check('scramble: the round ends on its banner', over !== null);
  await shot('scramble-end');
  const head = over !== null ? await page.locator('.foot strong').textContent() : '';
  check(`scramble: the banner says the score (${head})`, head === `Score ${score}`);
  const kept = Number(await page.evaluate(() => JSON.parse(localStorage.getItem('wingbeat.capture.best') ?? '0')));
  check(`scramble: the best is kept (was ${before}, score ${score}, kept ${kept})`, kept === Math.max(before, score));
  await touch(page.locator('.foot .next'));
  check('scramble: Again starts a round that shows the best', await wait(async () => (await page.locator('.hud-best').textContent()) === `Best ${kept}`, 5000) !== null, await hud('.hud-best'));
  await shot('scramble-again');
};
