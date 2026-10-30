import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { forcedMate } from '../../src/chess/prover.js';
import { entry } from '../../src/chess/mate.js';

const tap = (page, sq) => page.locator(`.board rect[data-square="${sq}"]`).click();
const hop = async (page, from, to) => { await tap(page, from); await tap(page, to); };
// The newest piece on a square: while a capture animates, the old one is still there beside it, so poll this.
const pieceAt = (page, sq) => page.locator(`div.board g[data-piece][data-square="${sq}"]`).evaluateAll((all) => all.at(-1)?.getAttribute('data-piece'));
const picker = (page) => page.locator('.promotion-dialog-button-group');
const choose = (page, piece) => page.locator(`.promotion-dialog-button-group[data-piece="${piece}"]`).click();

// An item on the real mount, with what it says and how it ended written where the test can read them.
async function mounted(page, item) {
  await page.goto('/');
  await page.evaluate(async (it) => {
    const { mount } = await import('/src/chess/exercise.js');
    document.body.innerHTML = '<p id="said"></p><p id="ended"></p><div id="stage" style="width:360px"></div>';
    mount(document.getElementById('stage'), it, {
      say: (t) => { document.getElementById('said').textContent = t; },
      done: (right) => { document.getElementById('ended').textContent = String(right); },
    });
  }, item);
}

test('a puzzle whose line needs a rook: the picker asks, a queen is explained and costs nothing, the rook solves it', async ({ page }) => {
  await mounted(page, { id: 'under', fen: '7k/2P5/8/1K6/8/8/8/8 b - - 0 1', moves: ['h8h7', 'c7c8r'] });
  await expect(page.locator('div.board g[data-piece][data-square="h7"]')).toBeVisible();
  await hop(page, 'c7', 'c8');
  await expect(picker(page)).toHaveCount(4);
  await choose(page, 'wq');
  await expect(page.locator('#said')).toContainText('needs a rook, not a queen');
  await expect.poll(() => pieceAt(page, 'c7')).toBe('wp');
  await hop(page, 'c7', 'c8');
  await choose(page, 'wr');
  await expect(page.locator('#ended')).toHaveText('true');
});

test('a move item: the piece chosen is the one played, and dismissing the picker gives the move back', async ({ page }) => {
  await mounted(page, { id: 'p', type: 'move', side: 'w', goal: 'mate', fen: '6k1/4P3/6K1/8/8/8/8/8 w - - 0 1', prompt: 'Mate.', explain: 'Top row.' });
  await hop(page, 'e7', 'e8');
  await expect(picker(page)).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => pieceAt(page, 'e7')).toBe('wp');
  await expect(page.locator('#ended')).toHaveText('');
  await hop(page, 'e7', 'e8');
  await choose(page, 'wr');
  await expect(page.locator('#ended')).toHaveText('true');
  await expect.poll(() => pieceAt(page, 'e8')).toBe('wr');
});

test('a stars board keeps going after the picker, with the piece chosen', async ({ page }) => {
  await mounted(page, { id: 's', type: 'stars', side: 'w', fen: '8/8/1P6/8/8/8/8/8 w - - 0 1', stars: ['b8', 'h2'], moves: 3, prompt: 'Go.', explain: 'Done.' });
  await hop(page, 'b6', 'b7');
  await hop(page, 'b7', 'b8');
  await choose(page, 'wq');
  await expect(page.locator('#said')).toContainText('1 star to go');
  await expect.poll(() => pieceAt(page, 'b8')).toBe('wq');
  await hop(page, 'b8', 'h2');
  await expect(page.locator('#ended')).toHaveText('true');
});

test('Mate uses the same picker: the piece chosen is played, and dismissing it reopens the board', async ({ page }) => {
  const positions = JSON.parse(readFileSync(new URL('../../src/data/mate.json', import.meta.url)));
  const line = positions[2].find((l) => forcedMate(entry(l).fen, 2)?.keys.some((k) => k.length === 5))
    ?? positions[3].find((l) => forcedMate(entry(l).fen, 3)?.keys.some((k) => k.length === 5));
  test.skip(!line, 'no shipped board opens with a promotion');
  const { fen } = entry(line);
  const key = forcedMate(fen, Number(positions[2].includes(line) ? 2 : 3)).keys.find((k) => k.length === 5);
  await page.route('**/src/data/mate.json', (r) => r.fulfill({ json: { 2: [line], 3: [line], 4: [line], notice: '' } }));
  await page.addInitScript((tier) => localStorage.setItem('drill.mate.tier', tier), positions[2].includes(line) ? '2' : '3');
  await page.goto('/');
  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await skip.click();
  await page.getByRole('button', { name: 'Mate', exact: true }).click();
  const [from, to] = [key.slice(0, 2), key.slice(2, 4)];
  await expect(page.locator(`div.board g[data-piece][data-square="${from}"]`)).toBeVisible();
  await hop(page, from, to);
  await expect(picker(page)).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect.poll(() => pieceAt(page, from)).toMatch(/p$/);
  await hop(page, from, to);
  const colour = new Chess(fen).turn();
  await choose(page, `${colour}${key[4]}`);
  await expect.poll(() => pieceAt(page, to)).toBe(`${colour}${key[4]}`);
  await expect(page.locator('#said')).not.toContainText("can't move");
});

