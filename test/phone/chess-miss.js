// A missed real-game puzzle, as a learner meets it: one wrong move on purpose, then the line, and the verdict that says
// why the line works (src/chess/why.js). CHESS_MISS=<lesson id,...> picks the lessons (default: a skewer and a mate in two);
// CHESS_SMALL=1080x1700 plays it on a short phone. The first real-game puzzle of each is the one missed.
import { subjects } from '../../src/subjects.js';
import { explanation, kind } from '../../src/chess/items.js';
import { startPuzzle, tryMove } from '../../src/chess/puzzle.js';

const lessons = subjects.find((s) => s.id === 'chess').units.flatMap((u) => u.lessons);
const uci = (m) => ({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });

/** A legal move for the player that the puzzle counts as wrong, and the stored line. */
function moves(item) {
  const wrong = startPuzzle(item).game.moves({ verbose: true }).find((m) => !m.promotion && tryMove(startPuzzle(item), m.from, m.to) === 'wrong');
  const state = startPuzzle(item);
  const line = [];
  for (;;) {
    const m = uci(item.moves[state.ply]);
    line.push(m);
    if (tryMove(state, m.from, m.to, m.promotion) !== 'next') return { wrong, line };
  }
}

export default async ({ page, adb, touch, btn, shot, run, seed, check, calibrate }) => {
  if (process.env.CHESS_SMALL) { adb('shell', 'wm', 'size', process.env.CHESS_SMALL); await run(1500); await calibrate(); }
  try {
    for (const id of (process.env.CHESS_MISS ?? 'skewer-0,mateIn2-0').split(',')) {
      const lesson = lessons.find((l) => l.id === id);
      await seed({ done: Object.fromEntries(lessons.slice(0, lessons.indexOf(lesson)).map((l) => [`chess:${l.id}`, true])) });
      const chess = page.locator('[data-course="chess"]');
      if (await chess.count()) await touch(chess);
      await touch(btn(`Continue · ${lesson.title}`));
      const item = lesson.items.find((i) => kind(i) === 'find');
      for (const card of lesson.items.slice(0, lesson.items.indexOf(item))) {
        await shot(`${id}-${card.id}`);
        await touch(btn('Continue', { exact: true }));
      }
      await run(900); // the setup move, then the board opens
      const { wrong, line } = moves(item);
      const square = (sq) => page.locator(`.board rect[data-square="${sq}"]`);
      await touch(square(wrong.from)); await touch(square(wrong.to)); await run(600);
      await shot(`${id}-${item.id}-missed`);
      for (const m of line) { await touch(square(m.from)); await touch(square(m.to)); await run(900); }
      await page.locator('.foot.show').waitFor({ timeout: 30000 });
      await run(900);
      await shot(`${id}-${item.id}-explained`);
      const said = (await page.locator('.foot.show p').textContent()).trim();
      console.log(`  ${item.id} verdict: ${said}`);
      check(`${item.id}: the verdict is the worked-out explanation`, said === explanation(item));
      const [board, foot] = [await page.locator('div.board').boundingBox(), await page.locator('.foot.show').boundingBox()];
      check(`${item.id}: the board is above the verdict`, board.y + board.height <= foot.y + 1);
    }
  } finally {
    if (process.env.CHESS_SMALL) { adb('shell', 'wm', 'size', 'reset'); await run(1500); await calibrate(); }
  }
};
