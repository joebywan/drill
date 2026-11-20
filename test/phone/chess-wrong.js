// Plays Chess's lessons by real touch with a WRONG answer first, and checks the app does what the rules promise
// (src/chess/puzzle.js tryMove, items.js): a puzzle's wrong move snaps back and is said so, a hint after two; the right
// square with the wrong promotion is explained and free; any other mate counts; a move item, stars, tap and true/false
// item miss at once, with the right answer shown. Nothing wrong may be accepted as right. One lesson from each of
// eleven units; `WRONG_LESSONS=pin-0,mateIn2-0` plays only those.
import { Chess } from 'chess.js';
import { subjects } from '../../src/subjects.js';
import { answer, hop, kind, load, solutions, targets } from '../../src/chess/items.js';
import { startPuzzle, tryMove } from '../../src/chess/puzzle.js';
import { playCourse } from '../../tools/play.js';
import { movesOf, placement, promote, square, tapMove, uci } from './lib/chess.js';

const course = subjects.find((s) => s.id === 'chess');
const LESSONS = ['board-0', 'moves-0', 'check-0', 'forks-0', 'mateIn1-0', 'hangingPiece-0', 'discoveredAttack-0', 'pin-0', 'skewer-0', 'backRankMate-0', 'mateIn2-0', 'promotion-0'];
const unitOf = (id) => course.units.findIndex((u) => u.lessons.some((l) => l.id === id)) + 1;
let seen = {}; // how many of each kind this lesson has had a wrong answer first
let illegalTried = false;
let specials = {}; // the 'another piece' and 'a different mate' checks, once a lesson

const said = (page) => page.evaluate(() => document.getElementById('said')?.textContent ?? '');
const waitSaid = (page, re) => page.waitForFunction((src) => new RegExp(src).test(document.getElementById('said')?.textContent ?? ''), re.source, { timeout: 8000 }).then(() => true, () => false);
const foot = (page) => page.evaluate(() => (document.querySelector('.foot.right') ? 'right' : document.querySelector('.foot.wrong') ? 'wrong' : document.querySelector('.foot.show') ? 'shown' : null));
const waitFoot = (page) => page.locator('.foot.show').waitFor({ timeout: 15000 }).then(() => true, () => false);

async function answerWrong(h, item) {
  const { page, tap, btn, shot, check } = h;
  const k = kind(item);
  if (k === 'teach') return;
  const n = (seen[k] = (seen[k] ?? 0) + 1);
  const at = (sq) => square(page, sq);
  const name = `${item.id}`;
  if (k !== 'find' && n > 1) return right(h, item, k); // one wrong first per kind (two puzzles) per lesson; the rest are played right, but for the special cases below

  if (k === 'tap') {
    const no = new Set([...answer(item), item.square, ...(item.rule === 'ends' ? answer({ ...item, rule: 'moves' }) : [])]);
    const sq = [...'abcdefgh'].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).find((s) => !no.has(s));
    await tap(at(sq));
    check(`${name}: tap on ${sq} is a miss`, await waitFoot(page) && (await foot(page)) === 'wrong');
    await shot(`wrong-${name}-tap`);
    return;
  }
  if (k === 'truefalse') {
    await tap(btn(answer(item) ? 'False' : 'True', { exact: true }));
    check(`${name}: the wrong true/false is a miss`, await waitFoot(page) && (await foot(page)) === 'wrong');
    await shot(`wrong-${name}-truefalse`);
    return;
  }
  if (k === 'stars') {
    if (item.demo) await h.run(600 + item.demo.length * 900 + 800);
    let fen = item.fen;
    for (let i = 0; i < item.moves; i++) { // moves that land on no star, until the budget is gone
      const legal = load(fen).moves({ verbose: true }).filter((m) => !m.promotion);
      const m = legal.find((x) => !item.stars.includes(x.to)) ?? legal[0];
      if (!m) break;
      await tapMove(tap, page, m.from, m.to);
      fen = hop(fen, m).fen;
      await h.run(300);
    }
    check(`${name}: stars run out of moves is a miss`, await waitFoot(page) && (await foot(page)) === 'wrong');
    await shot(`wrong-${name}-stars`);
    return;
  }
  if (k === 'move') {
    const g = new Chess(item.fen);
    const right = new Set(solutions(item).map((m) => m.san));
    const m = g.moves({ verbose: true }).find((x) => !right.has(x.san) && !x.promotion);
    if (!m) return rightMoves(h, item);
    await tapMove(tap, page, m.from, m.to);
    check(`${name}: ${m.san} (not a ${item.goal}) is a miss`, await waitFoot(page) && (await foot(page)) === 'wrong');
    await h.run(700);
    await shot(`wrong-${name}-move`);
    return;
  }
  // find: a puzzle
  const state = startPuzzle(item);
  const g = new Chess(state.game.fen());
  const expected = item.moves[1];
  const legal = g.moves({ verbose: true });
  const mates = (m) => { g.move(m); const x = g.isCheckmate(); g.undo(); return x; };
  const wrongs = legal.filter((m) => !mates(m) && m.from + m.to + (m.promotion ?? '') !== expected && !m.promotion);
  const before = await placement(page);
  await h.run(900);
  if (!illegalTried) { // a piece sent where it cannot go
    illegalTried = true;
    const from = legal[0].from;
    const to = [...'abcdefgh'].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).find((s) => s !== from && !targets(state.game.fen(), from).includes(s) && !state.game.get(s));
    await tapMove(tap, page, from, to);
    check(`${name}: ${from}-${to} (not a legal move) is turned down with "can't move like that", not counted as a miss`, await waitSaid(page, /can't move like that/) && await placement(page) === before);
  }
  if (n <= 2) {
    const w = wrongs[0];
    await tapMove(tap, page, w.from, w.to);
    await h.run(700);
    const first = await waitSaid(page, /Not that one/);
    check(`${name}: ${w.san} (not the line, not mate) is a miss, said so`, first && await placement(page) === before && !(await foot(page)));
    await shot(`wrong-${name}-find1`);
    if (n === 2) { // a second miss: the piece to move is marked
      const w2 = wrongs[1] ?? w;
      await tapMove(tap, page, w2.from, w2.to);
      await h.run(700);
      check(`${name}: a second miss marks the piece to move`, await waitSaid(page, /marked piece/) && await placement(page) === before);
      await shot(`wrong-${name}-find2`);
    }
  }
  const promo = expected[4] && legal.find((m) => m.from + m.to === expected.slice(0, 4) && m.promotion && m.promotion !== expected[4] && !mates(m));
  if (promo && !specials.piece) { // the right square with a piece the line does not need: explained and free
    specials.piece = true;
    await tapMove(tap, page, promo.from, promo.to);
    await promote(h, promo.promotion);
    check(`${name}: =${promo.promotion} on the right square is "another piece", free`, await waitSaid(page, /another piece/) && await placement(page) === before);
    await shot(`wrong-${name}-piece`);
  }
  return rightMoves(h, item);
}

/** A different mate than the line's, at the line's last move: null if there is none. */
function altFinal(item) {
  const st = startPuzzle(item);
  for (;;) {
    const e = item.moves[st.ply];
    if (st.ply === item.moves.length - 1) {
      const g = st.game;
      return g.moves({ verbose: true }).find((m) => { g.move(m); const x = g.isCheckmate(); g.undo(); return x && m.from + m.to + (m.promotion ?? '') !== e; }) ?? null;
    }
    if (tryMove(st, e.slice(0, 2), e.slice(2, 4), e[4]) !== 'next') return null;
  }
}

async function rightMoves(h, item) {
  const { page, tap, check, shot } = h;
  const k = kind(item);
  if (k !== 'move' && k !== 'stars' && k !== 'find') return;
  if (k === 'find') await h.run(700);
  if (await page.locator('.foot.show').count()) return;
  const moves = movesOf(item);
  const alt = k === 'find' && !specials.alt ? altFinal(item) : null;
  for (const [i, m] of moves.entries()) {
    const use = alt && i === moves.length - 1 ? alt : m; // any mate counts: the last move is a different mate
    await tapMove(tap, page, use.from, use.to);
    if (use.promotion) await promote(h, use.promotion);
    await h.run(500);
    if (use === alt) {
      specials.alt = true;
      check(`${item.id}: a different mate (${alt.san}) than the line's solves it`, await page.locator('.foot.show').waitFor({ timeout: 15000 }).then(() => true, () => false));
      await shot(`wrong-${item.id}-altmate`);
    }
  }
}

async function right(h, item, k) {
  const { page, tap, btn } = h;
  if (k === 'tap') for (const sq of answer(item)) await tap(square(page, sq));
  else if (k === 'truefalse') await tap(btn(answer(item) ? 'True' : 'False', { exact: true }));
  else { if (item.demo) await h.run(600 + item.demo.length * 900 + 800); if (k === 'find') await h.run(700); await rightMoves(h, item); }
}

export default async (h) => {
  const only = process.env.WRONG_LESSONS?.split(',') ?? LESSONS;
  for (const id of only) {
    seen = {}; illegalTried = false; specials = {};
    console.log(`-- ${id}`);
    await playCourse(h, { course, unit: unitOf(id), only: [id], answer: answerWrong, parts: ['.bubble', '.board', '.choices'], tray: ['.choices'], wrongOk: true });
  }
};
