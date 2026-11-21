import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { defence, forcedMate } from '../../src/chess/prover.js';
import { dailyIndex, entry } from '../../src/chess/mate.js';

// With the device's date fixed, today's board is known: the same day always plays the same board.
const positions = JSON.parse(readFileSync(new URL('../../src/data/mate.json', import.meta.url)));
const DAY = '2026-03-15';
const todays = (tier) => entry(positions[tier][dailyIndex(DAY, tier, positions[tier].length)]);
const onDay = async (page) => {
  await page.clock.setFixedTime(new Date(`${DAY}T12:00:00`));
  await page.addInitScript(() => localStorage.setItem('wingbeat.mate.tier', '2'));
};

// Taps a square by the board's own rects, twice for a move: pick up, put down.
const tap = async (page, square) => { await page.locator(`.board rect[data-square="${square}"]`).click(); };
const move = async (page, from, to) => {
  await expect(page.locator(`.board g[data-piece][data-square="${from}"]`)).toBeVisible();
  await tap(page, from);
  await tap(page, to);
};
const fenOf = (page) => page.evaluate(() => {
  const at = {};
  for (const g of document.querySelectorAll('div.board g[data-piece]')) at[g.dataset.square] = g.dataset.piece;
  const rows = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    for (const f of 'abcdefgh') {
      const p = at[`${f}${r}`];
      row += p ? (p[0] === 'w' ? p[1].toUpperCase() : p[1]) : '1';
    }
    rows.push(row.replace(/1+/g, (m) => m.length));
  }
  return rows.join('/');
});

async function openGame(page, name) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('navigation', { name: 'Games' }).getByRole('button', { name, exact: true }).click();
  await expect(page.locator('.board svg')).toBeVisible();
}

test('the Games row sits on chess only, and is three small buttons', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Games' }).getByRole('button')).toHaveCount(3);
  await page.locator('[data-course="maths"]').click();
  await expect(page.getByRole('navigation', { name: 'Games' })).toHaveCount(0);
});

test("Mate: today's board is played to checkmate against the best defence, and nothing is logged", async ({ page }) => {
  await onDay(page);
  await openGame(page, 'Mate');
  await expect(page.locator('#said')).toContainText("Today's board");
  await expect(page.locator('[data-tier="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-undo]')).toBeDisabled();

  // Hint: a nudge, then an explanation, and the player still moves.
  const hint = page.locator('[data-hint]');
  const before = await page.locator('div.board').boundingBox();
  await hint.click();
  await expect(hint).toHaveText('Explain');
  await hint.click();
  await expect(page.locator('#said')).toContainText(/checkmate|repl/);
  expect(await page.locator('div.board').boundingBox()).toEqual(before);

  const g = new Chess(todays(2).fen);
  for (let left = 2; left > 0; left--) {
    const key = forcedMate(g.fen(), left).keys[0];
    await move(page, key.slice(0, 2), key.slice(2, 4));
    g.move({ from: key.slice(0, 2), to: key.slice(2, 4), promotion: key[4] });
    if (left > 1) {
      await expect(page.locator('#said')).toContainText('Still mate', { timeout: 10000 });
      const reply = defence(g.fen(), left - 1);
      g.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
      await expect.poll(() => fenOf(page)).toBe(g.fen().split(' ')[0]);
    }
  }
  await expect(page.locator('.foot.show')).toBeVisible();
  await expect(page.locator('.foot .next')).toHaveText('Another board');
  await page.locator('.foot .next').click();
  await expect(page.locator('#said')).toContainText('Another board');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wingbeat.progress') || '{}').log?.length ?? 0)).toBe(0);
});

test('Mate: a move that gives the mate up gets the best reply, is called out, and Undo takes it back', async ({ page }) => {
  await onDay(page);
  await openGame(page, 'Mate');
  const { fen } = todays(2);
  const key = forcedMate(fen, 2).keys[0];
  const wrong = new Chess(fen).moves({ verbose: true }).find((m) => m.from + m.to !== key.slice(0, 4) && !m.promotion);
  await move(page, wrong.from, wrong.to);
  await expect(page.locator('#said')).toContainText('Undo and look again', { timeout: 10000 });
  await page.locator('[data-undo]').click();
  await expect(page.locator('#said')).toContainText('Mate in 2 from here');
  await expect.poll(() => fenOf(page)).toBe(fen.split(' ')[0]);
});

test('Scramble: moves, captures and a personal best when the clock runs out', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => { Math.random = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); });
  await openGame(page, 'Scramble');
  await expect(page.locator('.hud-clock')).toHaveText('1:30');
  await expect(page.locator('.hud-best')).toHaveText('Best 0');
  const before = await page.locator('div.board').boundingBox();
  // The clock waits for the first move.
  await page.clock.runFor(5000);
  await expect(page.locator('.hud-clock')).toHaveText('1:30');

  // Greedily play captures the rules allow until something is taken.
  let score = 0;
  for (let i = 0; i < 25 && !score; i++) {
    const rows = await fenOf(page);
    const fen = `${rows} w - - 0 1`;
    const { moves } = await page.evaluate(async (f) => {
      const { Chess } = await import('chess.js');
      const g = new Chess(f, { skipValidation: true });
      const all = g.moves({ verbose: true });
      return { moves: all.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0)).slice(0, 1) };
    }, fen);
    await move(page, moves[0].from, moves[0].to);
    await page.clock.runFor(300);
    score = Number(await page.locator('.hud-score').textContent());
  }
  expect(score).toBeGreaterThan(0);
  expect(await page.locator('div.board').boundingBox()).toEqual(before);
  await page.clock.runFor(95000);
  await expect(page.locator('.foot.show')).toBeVisible();
  await expect(page.locator('.foot strong')).toContainText(`Score`);
  const best = await page.evaluate(() => Number(localStorage.getItem('wingbeat.capture.best')));
  expect(best).toBeGreaterThan(0);
  await page.locator('.foot .next').click();
  await expect(page.locator('.hud-best')).toHaveText(`Best ${best}`);
  await expect(page.locator('.foot.show')).toHaveCount(0);
});

test('Play Rosa: pick a level, she answers, take back and hint work, resign ends it in her voice', async ({ page }) => {
  await openGame(page, 'Play Rosa');
  await expect(page.locator('[data-level]')).toHaveCount(4);
  await page.getByRole('button', { name: 'Warm-up' }).click();
  await expect(page.locator('#said')).toHaveText('Your move.');
  await move(page, 'e2', 'e4');
  // Black has answered: the board differs from just White's move, and she says it in words.
  await expect.poll(() => fenOf(page), { timeout: 10000 }).not.toMatch(/^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR$/);
  await expect(page.locator('#said')).toContainText('Your move.');
  await expect(page.locator('#said')).not.toContainText(/\b[KQRBN]x?[a-h][1-8]/);
  await page.locator('[data-back]').click();
  await expect(page.locator('.board g[data-piece][data-square="e2"]')).toBeVisible();
  await page.locator('[data-hint]').click();
  await expect(page.locator('#said')).toContainText('I would try this', { timeout: 10000 });
  await page.locator('[data-resign]').click();
  await expect(page.locator('[data-resign]')).toHaveText('Sure?');
  await page.locator('[data-resign]').click();
  await expect(page.locator('.foot.show strong')).toHaveText('We can stop there.');
  await page.locator('.foot .next').click();
  await expect(page.locator('[data-level]')).toHaveCount(4);
  // ✕ goes home with nothing logged.
  await page.locator('.close').click();
  await expect(page.locator('.home')).toBeVisible();
});

test('Play Rosa: at her top level she answers without freezing the page', async ({ page }) => {
  await openGame(page, 'Play Rosa');
  await page.getByRole('button', { name: 'Cardigan off' }).click();
  await expect(page.locator('[data-hint]')).toHaveCount(0); // help is for the low levels
  await page.evaluate(() => { window.longest = 0; let last = performance.now(); setInterval(() => { const n = performance.now(); window.longest = Math.max(window.longest, n - last); last = n; }, 5); });
  await move(page, 'e2', 'e4');
  await expect(page.locator('#said')).toContainText('Hm');
  await expect(page.locator('#said')).toContainText('Your move.', { timeout: 15000 });
  expect(await page.evaluate(() => window.longest)).toBeLessThan(250);
});

// Each game fits the screen as a lesson does (fitBoard in exercise.js): played, the coach's line, the counters, the whole
// board with thumb-sized squares and the buttons that work, nothing to scroll; over, the whole board above the banner.
// The widest font a phone is likely to fall back to (what CI has), pinned as chess-short.spec.js does.
const WIDE_FONT = 'body, button { font-family: "DejaVu Sans", Verdana, sans-serif; }';
const COUNTERS = { mate: ['.game-tabs', '[data-tier][aria-pressed="true"]'], capture: ['.hud-clock', '.hud-score', '.hud-best'], rosa: ['.game-bar'] };

/** What is wrong with the screen now: `played` (squares must stay thumb-sized) and the game's `counters` (selectors). */
const misfits = (page, played, counters) => page.evaluate(({ played, counters }) => {
  const bad = [];
  const on = (el, what) => {
    const r = el.getBoundingClientRect();
    if (r.top < -0.5 || r.bottom > innerHeight + 0.5 || r.left < -0.5 || r.right > innerWidth + 0.5) return bad.push(`${what} is off the screen (${Math.round(r.top)}..${Math.round(r.bottom)})`);
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (t && !el.contains(t) && !t.contains(el)) bad.push(`${what} is under ${t.tagName.toLowerCase()}.${t.className}`);
  };
  if (document.documentElement.scrollHeight > innerHeight) bad.push(`the page scrolls ${document.documentElement.scrollHeight - innerHeight}px`);
  const board = document.querySelector('div.board');
  const r = board.getBoundingClientRect();
  if (r.top < 0 || r.left < 0 || r.right > innerWidth) bad.push(`the board is off the screen (${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(r.right)})`);
  const foot = document.querySelector('.foot.show');
  const tray = document.querySelector('.stage .choices');
  const low = foot ? foot.getBoundingClientRect().top : tray?.children.length ? tray.getBoundingClientRect().top : innerHeight;
  if (r.bottom > low + 0.5) bad.push(`the board runs ${Math.round(r.bottom - low)}px under the ${foot ? 'banner' : 'buttons'}`);
  if (played && r.width / 8.7 < 39.5) bad.push(`squares of ${(r.width / 8.7).toFixed(1)}px`);
  if (!played && r.width < 150) bad.push(`a board of ${Math.round(r.width)}px`);
  on(document.querySelector('.bubble'), "the coach's line");
  for (const q of counters) document.querySelectorAll(`.bar ${q}`).length ? document.querySelectorAll(`.bar ${q}`).forEach((el) => on(el, q)) : bad.push(`no ${q}`);
  for (const b of document.querySelectorAll('#app button:not(:disabled), .foot.show .next')) if (b.getClientRects().length && !b.closest('.foot:not(.show)')) on(b, `"${b.textContent.trim() || b.getAttribute('aria-label')}"`);
  return bad;
}, { played, counters });

for (const [width, height] of [[412, 533], [360, 640], [412, 786]]) {
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((css) => document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: css }))), WIDE_FONT);
    });
    const fits = async (page, what, played, counters) => {
      await page.waitForTimeout(450); // a banner's slide, a refit after her line
      expect(await misfits(page, played, counters), what).toEqual([]);
    };

    test('Mate fits: asked, after a hint explains, and at checkmate', async ({ page }) => {
      await onDay(page);
      await openGame(page, 'Mate');
      await expect(page.locator('#said')).toContainText("Today's board");
      await fits(page, 'asked', true, COUNTERS.mate);
      await page.locator('[data-hint]').click();
      await expect(page.locator('[data-hint]')).toHaveText('Explain');
      await page.locator('[data-hint]').click();
      await expect(page.locator('#said')).toContainText(/checkmate|repl/);
      await fits(page, 'explained', true, COUNTERS.mate);
      const g = new Chess(todays(2).fen);
      for (let left = 2; left > 0; left--) {
        const key = forcedMate(g.fen(), left).keys[0];
        await move(page, key.slice(0, 2), key.slice(2, 4));
        g.move({ from: key.slice(0, 2), to: key.slice(2, 4), promotion: key[4] });
        if (left > 1) {
          await expect(page.locator('#said')).toContainText('Still mate', { timeout: 10000 });
          await fits(page, 'after a move', true, COUNTERS.mate);
          const reply = defence(g.fen(), left - 1);
          g.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
          await expect.poll(() => fenOf(page)).toBe(g.fen().split(' ')[0]);
          // Mate in one explained is her longest line: "… is checkmate: check, the king has no safe square, and …"
          await page.locator('[data-hint]').click();
          await expect(page.locator('[data-hint]')).toHaveText('Explain');
          await page.locator('[data-hint]').click();
          await expect(page.locator('#said')).toContainText('is checkmate: check');
          await fits(page, 'mate in one explained', true, COUNTERS.mate);
        }
      }
      await expect(page.locator('.foot.show')).toBeVisible();
      await fits(page, 'checkmate', false, COUNTERS.mate);
    });

    test('Scramble fits: the clock and score in sight while playing, and at time', async ({ page }) => {
      await page.clock.install();
      await openGame(page, 'Scramble');
      await fits(page, 'ready', true, COUNTERS.capture);
      const fen = `${await fenOf(page)} w - - 0 1`;
      const m = await page.evaluate(async (f) => (await import('/src/chess/items.js')).load(f).moves({ verbose: true }).find((x) => !x.promotion), fen);
      await move(page, m.from, m.to);
      await page.clock.runFor(1000);
      await expect(page.locator('.hud-clock')).not.toHaveText('1:30');
      await fits(page, 'playing', true, COUNTERS.capture);
      await page.clock.runFor(95000);
      await expect(page.locator('.foot.show')).toBeVisible();
      await fits(page, 'time', false, COUNTERS.capture);
    });

    test('Play Rosa fits: picking a level, playing her, and when it is over', async ({ page }) => {
      await openGame(page, 'Play Rosa');
      await fits(page, 'levels', false, []);
      await page.getByRole('button', { name: 'Warm-up' }).click();
      await expect(page.locator('.bar .game-bar')).toHaveText('Warm-up');
      await fits(page, 'her level picked', true, COUNTERS.rosa);
      await move(page, 'e2', 'e4');
      await expect(page.locator('#said')).toContainText('Your move.', { timeout: 15000 });
      await expect.poll(() => fenOf(page), { timeout: 10000 }).not.toMatch(/^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR$/);
      await fits(page, 'after her reply', true, COUNTERS.rosa);
      await page.locator('[data-resign]').click();
      await page.locator('[data-resign]').click();
      await expect(page.locator('.foot.show')).toBeVisible();
      await expect(page.locator('.stage .game-actions button')).toHaveCount(0); // nothing peeks round the banner
      await fits(page, 'resigned', false, COUNTERS.rosa);
    });
  });
}
