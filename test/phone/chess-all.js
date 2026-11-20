// Plays Chess's lessons by real touch, as a learner would, and records what it finds (tools/play.js).
// A long scenario, so `npm run phone` with no name skips it. One unit at a time:
//   CHESS_UNIT=3 npm run phone -- chess-all          (unit n continues the progress unit n-1 saved)
//   CHESS_UNIT=1 CHESS_LESSONS=board-0,... ...        only those lessons
//   CHESS_SMALL=1080x1700 ...                         a short phone (under 700 px of page)
// Each unit's first move is made by dragging the piece; every other move by tapping the piece, then the square.
import { subjects } from '../../src/subjects.js';
import { kind } from '../../src/chess/items.js';
import { movesOf, promote, square } from './lib/chess.js';
import { playCourse } from '../../tools/play.js';

const course = subjects.find((s) => s.id === 'chess');
let dragged = false;
const looked = new Set(); // what has been photographed this run: the first item of each kind, every demo, every long puzzle, every card with a board

async function answerChess(h, item) {
  const { page, shot } = h;
  const k = kind(item);
  const long = k === 'find' && item.moves.length > 4;
  const want = looked.size < 14 && (!looked.has(k) || item.demo || long || (k === 'teach' && item.fen));
  if (want) { looked.add(k); await shot(`look-${item.id}-asked`).catch(() => {}); }
  await play(h, item, k);
  if (want) { await page.locator('.foot.show').waitFor({ timeout: 30000 }).catch(() => {}); await new Promise((r) => setTimeout(r, 900)); await shot(`look-${item.id}-answered`).catch(() => {}); }
}

async function play(h, item, k) {
  const { page, tap, btn, run, dragTo, check } = h;
  if (k === 'teach') return;
    const at = async (sq) => square(page, sq);
  if (k === 'tap') {
    const { answer } = await import('../../src/chess/items.js');
    for (const sq of answer(item)) await tap(await at(sq));
    return;
  }
  if (k === 'truefalse') {
    const { answer } = await import('../../src/chess/items.js');
    return tap(btn(answer(item) ? 'True' : 'False', { exact: true }));
  }
  if (item.demo) await run(600 + item.demo.length * 900 + 800); // the piece shows how it moves first
  if (k === 'find') await run(700); // the board opens a moment after the setup move
  for (const m of movesOf(item)) {
    if (!dragged) {
      dragged = true;
      await dragTo(await at(m.from), await at(m.to));
      const moved = await page.locator(`.board g[data-piece][data-square="${m.from}"]`).count() === 0
        || await page.locator('.foot.show').count() > 0;
      check(`drag: ${item.id} ${m.from}-${m.to} moved the piece`, moved);
      if (moved) { await run(700); if (m.promotion) await promote(h, m.promotion); continue; }
    }
    await tap(await at(m.from));
    await tap(await at(m.to));
    if (m.promotion) await promote(h, m.promotion);
  }
}

export default async (h) => {
  const only = process.env.CHESS_LESSONS?.split(',');
  dragged = false; looked.clear();
  await playCourse(h, { course, unit: +(process.env.CHESS_UNIT ?? 1), only, answer: answerChess, parts: ['.bubble', '.board', '.choices'], tray: ['.choices'], small: process.env.CHESS_SMALL });
};
