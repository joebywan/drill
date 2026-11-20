import { test, expect } from './fixtures.js';
import { subjects } from '../../src/subjects.js';
import { startPuzzle, tryMove } from '../../src/chess/puzzle.js';
import { kind } from '../../src/chess/items.js';

// A short phone (412x533): the board is never under the verdict, and the coach's bubble never goes stale.
test.use({ viewport: { width: 412, height: 533 }, hasTouch: true });

const chess = subjects.find((s) => s.id === 'chess');
const unit = chess.units.find((u) => u.title === 'Mate in three');
const lesson = unit.lessons[1];
const before = chess.units.flatMap((u) => u.lessons);
const done = Object.fromEntries(before.slice(0, before.indexOf(lesson)).map((l) => [`chess:${l.id}`, true]));

/** Where a puzzle's line goes in: the stored moves, played through the puzzle's own rules. */
function line(item) {
  const state = startPuzzle(item);
  const out = [];
  for (;;) {
    const m = item.moves[state.ply];
    out.push([m.slice(0, 2), m.slice(2, 4), m[4]]);
    if (tryMove(state, m.slice(0, 2), m.slice(2, 4), m[4]) !== 'next') return out;
  }
}

test('Mate in three on a short phone: board and coach together while asked, board clear of the verdict once answered', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  await page.evaluate(async (done) => {
    const { emptyProgress } = await import('/src/progress.js');
    localStorage.setItem('wingbeat.progress', JSON.stringify({ ...emptyProgress(), done, start: 'x', met: { chess: true } }));
  }, done);
  await page.reload();
  await page.getByRole('button', { name: 'Skip', exact: true }).click({ timeout: 1000 }).catch(() => {});
  await page.locator('[data-course="chess"]').click();
  await page.getByRole('button', { name: `Continue · ${lesson.title}` }).click();
  const box = (sel) => page.locator(sel).first().boundingBox();
  for (const item of lesson.items) {
    expect(kind(item)).toBe('find');
    await expect(page.locator('.board svg')).toBeVisible();
    await page.waitForTimeout(700); // the board opens a moment after the setup move
    // Asked: the coach's words and the whole board are on screen together, nothing to scroll, squares thumb-sized.
    const asked = { board: await box('div.board'), bubble: await box('.bubble'), scrolls: await page.evaluate(() => document.documentElement.scrollHeight - innerHeight) };
    expect(asked.bubble.y, `${item.id}: the coach's words`).toBeGreaterThanOrEqual(0);
    expect(asked.board.y + asked.board.height, `${item.id}: the board's bottom`).toBeLessThanOrEqual(533);
    expect(asked.board.width / 8.7, `${item.id}: a square`).toBeGreaterThanOrEqual(39.5);
    expect(asked.scrolls, `${item.id}: nothing to scroll`).toBeLessThanOrEqual(0);
    for (const [from, to, promotion] of line(item)) {
      await page.locator(`.board rect[data-square="${from}"]`).click();
      await page.locator(`.board rect[data-square="${to}"]`).click();
      if (promotion) await page.locator('.promotion-dialog-button-group').first().click();
      await page.waitForTimeout(600);
    }
    await expect(page.locator('.foot.show')).toBeVisible();
    await page.waitForTimeout(400); // the banner's slide
    const foot = await box('.foot');
    const board = await box('div.board');
    expect(board.y + board.height, `${item.id}: the board is above the verdict`).toBeLessThanOrEqual(foot.y + 0.5);
    expect(board.y, `${item.id}: the board's top`).toBeGreaterThanOrEqual(0);
    expect(board.width, `${item.id}: the final position is readable`).toBeGreaterThanOrEqual(150);
    await expect(page.locator('#said'), `${item.id}: the coach after a solved puzzle`).not.toContainText('Keep going');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
});

test('a finished tap item no longer counts "Found 2 of 3"', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { mount } = await import('/src/chess/exercise.js');
    document.body.innerHTML = '<p id="said"></p><p id="ended"></p><div id="stage" style="width:360px"></div>';
    mount(document.getElementById('stage'), { id: 't', type: 'tap', fen: '7k/3q1r2/6p1/4N3/8/8/8/6K1 w - - 0 1', square: 'e5', prompt: 'Tap every black piece the knight attacks.', explain: 'Three.' },
      { say: (t) => { document.getElementById('said').textContent = t; }, done: (right) => { document.getElementById('ended').textContent = String(right); } });
  });
  for (const sq of ['d7', 'f7']) await page.locator(`.board rect[data-square="${sq}"]`).click();
  await expect(page.locator('#said')).toContainText('Found 2 of 3');
  await page.locator('.board rect[data-square="g6"]').click();
  await expect(page.locator('#ended')).toHaveText('true');
  await expect(page.locator('#said')).not.toContainText('Found');
});
