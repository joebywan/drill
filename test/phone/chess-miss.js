// A missed real-game puzzle, as a learner meets it: one wrong move on purpose, then the line, and the verdict that says
// why the line works (src/chess/why.js), in whichever of its wordings leaves the board room. CHESS_MISS=<lesson id,...>
// picks the lessons (default: a skewer and a mate in two); CHESS_SMALL=1080x1700 plays it on a short phone. The first
// real-game puzzle of each is the one missed.
import { subjects } from '../../src/subjects.js';
import { explanation, kind } from '../../src/chess/items.js';
import { startPuzzle, tryMove } from '../../src/chess/puzzle.js';
import { movesOf, onShortPhone, promote, tapMove } from './lib/chess.js';

const lessons = subjects.find((s) => s.id === 'chess').units.flatMap((u) => u.lessons);

/** A legal move for the player that the puzzle counts as wrong. */
const wrongMove = (item) => startPuzzle(item).game.moves({ verbose: true }).find((m) => !m.promotion && tryMove(startPuzzle(item), m.from, m.to) === 'wrong');

async function miss(h, id) {
  const { page, touch, btn, shot, run, seed, check } = h;
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
  const wrong = wrongMove(item);
  await tapMove(touch, page, wrong.from, wrong.to); await run(600);
  await shot(`${id}-${item.id}-missed`);
  for (const m of movesOf(item)) {
    await tapMove(touch, page, m.from, m.to);
    if (m.promotion) await promote(h, m.promotion);
    await run(900);
  }
  await page.locator('.foot.show').waitFor({ timeout: 30000 });
  await run(900);
  await shot(`${id}-${item.id}-explained`);
  const said = (await page.locator('.foot.show p').textContent()).trim();
  const wordings = explanation(item);
  console.log(`  ${item.id} wording ${wordings.indexOf(said) + 1} of ${wordings.length}: ${said}`);
  check(`${item.id}: the verdict is one of its wordings`, wordings.includes(said));
  const [board, foot] = [await page.locator('div.board').boundingBox(), await page.locator('.foot.show').boundingBox()];
  check(`${item.id}: the board is above the verdict`, board.y + board.height <= foot.y + 1);
}

export default async (h) => {
  const ids = (process.env.CHESS_MISS ?? 'skewer-0,mateIn2-0').split(',');
  const all = async () => { for (const id of ids) await miss(h, id); };
  if (process.env.CHESS_SMALL) await onShortPhone(h, process.env.CHESS_SMALL, all);
  else await all();
};
