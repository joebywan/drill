import { test, expect } from './fixtures.js';
import { subjects } from '../../src/subjects.js';
import { kind } from '../../src/chess/items.js';
import { mountChess, plays, playSteps, settles } from './chess-plays.js';

// "Feedback must not move the board": from the moment a chess item is asked until Continue, the board's top stays
// where it was, through a right answer, a wrong one, every move of a stars item and every word the coach says.

const chess = subjects.find((s) => s.id === 'chess');
const lessons = chess.units.flatMap((u) => u.lessons).filter((l) => !l.mix);
// Every item but the real-game puzzles, and the first puzzle of every sixth lesson that has them (they all say the same lines).
const puzzles = lessons.filter((l) => l.items.some((i) => kind(i) === 'find')).filter((_, n) => n % 6 === 0).map((l) => l.items.find((i) => kind(i) === 'find'));
const items = [...lessons.flatMap((l) => l.items).filter((i) => !['teach', 'find'].includes(kind(i))), ...puzzles];

for (const [width, height] of [[412, 786], [360, 640], [412, 533]]) {
  test(`a chess board never moves from asked to Continue, right or wrong, at ${width}x${height}`, async ({ page }) => {
    test.setTimeout(600000);
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const bad = [];
    for (const item of items) {
      for (const right of [true, false]) {
        const steps = plays(item, right);
        if (!steps) continue;
        await page.evaluate(mountChess, item);
        // Asked: a piece's demo plays first, a puzzle's setup move comes a moment after.
        await page.waitForTimeout(settles(item));
        const top = () => page.locator('div.board').evaluate((b) => b.getBoundingClientRect().top + scrollY); // on the page: a click Playwright scrolls to is not the board moving
        const asked = await top();
        const where = [];
        await playSteps(page, item, steps, async () => { where.push(await top()); });
        await expect(page.locator('.foot.show'), `${item.id} ${right ? 'right' : 'wrong'} ends`).toBeAttached();
        where.push(await top());
        const moved = where.filter((t) => Math.abs(t - asked) > 0.5);
        if (moved.length) bad.push(`${item.id} (${right ? 'right' : 'wrong'}): asked at ${asked}, then ${where.map(Math.round).join(', ')}`);
      }
    }
    await page.evaluate(() => window.stopItem?.());
    expect(bad).toEqual([]);
  });
}

// Tapping Rosa mid-item says one of her `tapped` lines (app.js): the room her bubble keeps covers the tallest of them.
test('a tap on Rosa mid-item never moves the board', async ({ page }) => {
  test.setTimeout(300000);
  const { LINES } = await import('../../src/cast/lines.js');
  const kinds = new Map();
  for (const i of items) if (!kinds.has(kind(i))) kinds.set(kind(i), i);
  for (const [width, height] of [[360, 640], [412, 533]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    for (const item of kinds.values()) {
      await page.evaluate(mountChess, item);
      await page.waitForTimeout(settles(item));
      const top = () => page.locator('div.board').evaluate((b) => b.getBoundingClientRect().top + scrollY);
      const asked = await top();
      for (const text of LINES.tapped) {
        await page.locator('.bubble').evaluate((el, t) => { el.textContent = t; }, text);
        expect(await top(), `${item.id} at ${width}x${height}: "${text}"`).toBeCloseTo(asked, 0);
      }
    }
  }
  await page.evaluate(() => window.stopItem?.());
});
