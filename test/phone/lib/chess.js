// Shared by the Chess phone scenarios (chess-all, chess-wrong, chess-rosa, chess-games): the moves an item is won by,
// the board as the page shows it, and a mirror game kept in step with it. Not a scenario itself.
import { Chess } from 'chess.js';
import { kind, solutions, starPath } from '../../../src/chess/items.js';
import { startPuzzle, tryMove } from '../../../src/chess/puzzle.js';

export const uci = (m) => ({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
export const NAMES = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };

/** The moves a move, stars or find item is won by, worked out with the course's own functions. */
export function movesOf(item) {
  const k = kind(item);
  if (k === 'stars') return starPath(item).map(({ from, to, promotion }) => ({ from, to, promotion }));
  if (k === 'move') {
    const all = solutions(item);
    const m = all.find((x) => !x.promotion) ?? all[0];
    return [{ from: m.from, to: m.to, promotion: m.promotion }];
  }
  const state = startPuzzle(item); // find: the stored line, played through the puzzle's own rules
  const out = [];
  for (;;) {
    const m = uci(item.moves[state.ply]);
    out.push(m);
    if (tryMove(state, m.from, m.to, m.promotion) !== 'next') return out;
  }
}

/** The board's own overlay square: what a finger meets, even where a piece stands. */
export const square = (page, sq) => page.locator(`.board rect[data-square="${sq}"]`);

/** Taps the piece, then the square. */
export async function tapMove(tap, page, from, to) {
  await tap(square(page, from));
  await tap(square(page, to));
}

/** Chooses `p` ('q', 'r', 'b', 'n') in the promotion picker, if it is open. */
export async function promote({ page, tap, touch }, p) {
  const choice = page.locator(`.promotion-dialog-button-group[aria-label="${NAMES[p]}"]`);
  if (await choice.count()) await (tap ?? touch)(choice);
}

/** The piece placement the page's board shows, as the first field of a FEN. */
export const placement = (page) => page.evaluate(() => {
  const at = {};
  for (const g of document.querySelectorAll('div.board g[data-piece]')) at[g.dataset.square] = g.dataset.piece;
  const rows = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    for (const f of 'abcdefgh') { const p = at[`${f}${r}`]; row += p ? (p[0] === 'w' ? p[1].toUpperCase() : p[1]) : '1'; }
    rows.push(row.replace(/1+/g, (m) => m.length));
  }
  return rows.join('/');
});

/**
 * Plays on `game` (a chess.js game) the legal move that makes its placement the page's, and returns it, or null if no
 * legal move does: what the page's board shows must be a legal move from where the game was.
 */
export async function follow(page, game) {
  const now = await placement(page);
  for (const m of game.moves({ verbose: true })) {
    game.move(m);
    if (game.fen().split(' ')[0] === now) return m;
    game.undo();
  }
  return null;
}

/** Opens a Chess game from home by its id ('mate', 'capture', 'rosa'). */
export async function openGame({ page, touch }, id) {
  await touch(page.locator('[data-course="chess"]'));
  await touch(page.locator(`[data-game="${id}"]`));
  await page.locator('.board svg').waitFor();
}

/** Runs `fn` on a short phone (`size`, e.g. '1080x1700'), then puts the screen back. The page is seeded again after each change. */
export async function onShortPhone({ adb, run, calibrate }, size, fn) {
  adb('shell', 'wm', 'size', size); await run(1500); await calibrate();
  try { return await fn(); } finally { adb('shell', 'wm', 'size', 'reset'); await run(1500); await calibrate(); }
}

/**
 * What is wrong with a game's screen right now: `under` is what is covered by something else (an enabled button under a bar,
 * the board under the banner), `off` what is not wholly inside the page as it is scrolled (the coach, clock, board or controls).
 */
export const fitProblems = (page) => page.evaluate(() => {
  const under = [], off = [];
  for (const q of ['.board', '.game-actions', '.choices', '.game-tabs', '.hud', '.bubble']) for (const el of document.querySelectorAll(`#app ${q}`)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1) off.push(`${q} ${Math.round(r.top)}..${Math.round(r.bottom)} of ${innerHeight}`);
  }
  const foot = document.querySelector('.foot.show')?.getBoundingClientRect();
  for (const b of document.querySelectorAll('#app button:not(:disabled), #app .board')) {
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom > innerHeight || r.top < 0) continue;
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (t && !b.contains(t) && !t.contains(b)) under.push(`${b.className.split(/\s+/)[0] || 'button'} "${b.textContent.trim().slice(0, 20)}" is under ${t.tagName.toLowerCase()}.${String(t.className).split(/\s+/)[0]}`);
    if (foot && b.matches('.board') && r.bottom > foot.top + 2) under.push(`the board's lower edge is ${Math.round(r.bottom - foot.top)} px under the banner`);
  }
  return { under, off };
});
