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

test('every Chess item fits a 412x533 phone while asked, a teach card clear of Continue, and a puzzle board clear of its verdict', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/');
  const items = chess.units.flatMap((u) => u.lessons).filter((l) => !l.mix).flatMap((l) => l.items.map((item) => ({ item, topic: l.title })));
  const bad = await page.evaluate(async (items) => {
    const { mount } = await import('/src/chess/exercise.js');
    const { kind, explanation } = await import('/src/chess/items.js');
    const app = document.getElementById('app');
    const out = [];
    for (const { item } of items) {
      app.innerHTML = `<header class="bar"><button class="close" aria-label="Quit lesson">✕</button><div class="meter"><div class="fill"></div></div></header>
        <main class="play"><p class="topic">Topic</p><div class="coach"><button class="who" aria-label="Rosa"></button><p class="bubble" id="said"></p></div><div class="stage"></div></main>
        <footer class="foot"><div class="verdict"><strong></strong><p></p></div><button class="next">Continue</button></footer>`;
      document.body.style.minHeight = '2000px'; scrollTo(0, 300); // as the last question left the page, scrolled
      const foot = app.querySelector('.foot');
      const stop = mount(app.querySelector('.stage'), item, {
        say: (t) => { app.querySelector('.bubble').textContent = t; },
        done: (right, text) => { foot.className = 'foot show'; foot.querySelector('p').textContent = text; },
      });
      document.body.style.minHeight = '';
      await new Promise((r) => setTimeout(r, 50));
      if (!app.querySelector('div.board')) { stop(); continue; } // a card with no board
      const board = app.querySelector('div.board').getBoundingClientRect();
      const bubble = app.querySelector('.bubble').getBoundingClientRect();
      const tray = app.querySelector('.choices');
      const low = foot.classList.contains('show') ? innerHeight - foot.offsetHeight : tray?.children.length ? tray.getBoundingClientRect().top : innerHeight;
      const why = [];
      if (bubble.top < 0) why.push('the coach is off the top');
      if (board.bottom > low + 1) why.push(`the board runs ${Math.round(board.bottom - low)}px under the ${foot.classList.contains('show') ? 'Continue bar' : 'answers'}`);
      if (['tap', 'move', 'stars', 'find'].includes(kind(item)) && board.width / 8.7 < 39.5) why.push(`squares of ${Math.round(board.width / 8.7)}px`);
      if (document.documentElement.scrollHeight > innerHeight + 1 && foot.classList.contains('show') === false && ['tap', 'move', 'stars', 'find', 'truefalse'].includes(kind(item))) why.push(`the page scrolls ${document.documentElement.scrollHeight - innerHeight}px, bubble ${Math.round(bubble.height)}, board top ${Math.round(board.top)}`);
      // Answered, a real-game puzzle's verdict carries its line and why it works: the board still sits above it.
      if (kind(item) === 'find') {
        foot.className = 'foot show';
        foot.querySelector('p').textContent = explanation(item);
        dispatchEvent(new Event('resize'));
        await new Promise((r) => setTimeout(r, 30));
        const after = app.querySelector('div.board').getBoundingClientRect();
        if (after.bottom > foot.getBoundingClientRect().top + 0.5) why.push(`answered, the board runs ${Math.round(after.bottom - foot.getBoundingClientRect().top)}px under the verdict`);
        if (after.width < 150) why.push(`answered, a board of ${Math.round(after.width)}px`);
      }
      if (why.length) out.push(`${item.id}: ${why.join(', ')}`);
      stop();
    }
    document.body.style.minHeight = '';
    return out;
  }, items);
  expect(bad).toEqual([]);
});
