import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { answer, kind, starPath } from '../../src/chess/items.js';

const basics = JSON.parse(readFileSync(new URL('../../src/data/basics.json', import.meta.url)));
const first = basics.units[0].lessons[0];

/** cm-chessboard's keyboard cursor (and its picked-up square), drawn by the Accessibility extension. */
const cursor = (page) => page.locator('.keyboard-focus-indicator rect').filter({ visible: true });
const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });

/** A first visit lands on home; Learning's Continue goes straight into the first lesson. */
async function start(page) {
  await page.goto('/');
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
}

test.describe('on a touch phone', () => {
  test.use({ hasTouch: true, isMobile: true });

  async function touch(page, square) {
    const box = await page.locator(`.board rect[data-square="${square}"]`).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }

  test('"Squares and coordinates" never shows the keyboard cursor', async ({ page }) => {
    await start(page);
    for (const item of first.items) {
      await expect(page.locator('.board svg')).toBeVisible();
      await expect(cursor(page), `${item.id} on load`).toHaveCount(0);
      if (kind(item) === 'tap') for (const sq of answer(item)) await touch(page, sq);
      if (kind(item) === 'stars') {
        for (const { from, to } of starPath(item)) {
          await expect(page.locator(`.board g[data-piece][data-square="${from}"]`)).toBeVisible();
          await touch(page, from);
          await expect(cursor(page), `${item.id} after a tap`).toHaveCount(0);
          await touch(page, to);
        }
      }
      await expect(continueButton(page), item.id).toBeInViewport();
      await expect(cursor(page), `${item.id} answered`).toHaveCount(0);
      await continueButton(page).tap();
    }
  });
});

test('a keyboard player tabs to the board and walks the cursor with the arrows', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: `Continue · ${first.title}` }).focus();
  await page.keyboard.press('Enter');
  await continueButton(page).focus(); // the teach card: on to "Tap the square e4."
  await page.keyboard.press('Enter');
  const board = page.locator('.board svg');
  await expect(board).toBeFocused();
  await expect(cursor(page)).toHaveCount(1);
  await expect(cursor(page)).toHaveAttribute('x', await page.locator('.board rect[data-square="a1"]').getAttribute('x'));
  await page.keyboard.press('Shift+Tab'); // off the board and back: Tab lands on it, cursor still on a1
  await expect(cursor(page)).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(board).toBeFocused();
  await expect(cursor(page)).toHaveCount(1);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await expect(cursor(page)).toHaveAttribute('y', await page.locator('.board rect[data-square="b2"]').getAttribute('y'));
  await expect(cursor(page)).toHaveAttribute('x', await page.locator('.board rect[data-square="b2"]').getAttribute('x'));
  await page.keyboard.press('ArrowRight'); // c2
  await page.keyboard.press('ArrowRight'); // d2
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp'); // d4
  await page.keyboard.press('ArrowRight'); // e4
  await page.keyboard.press('Enter');
  await expect(continueButton(page)).toBeFocused();
});

test('a click on the board hides the cursor, and an arrow key brings it back', async ({ page }) => {
  await start(page);
  await continueButton(page).click(); // the teach card: on to "Tap the square e4."
  const board = page.locator('.board svg');
  const box = await board.boundingBox();
  await page.mouse.click(box.x + 4, box.y + 4); // the frame, not a square: focuses without answering
  await expect(board).toBeFocused();
  await expect(cursor(page)).toHaveCount(0);
  await page.keyboard.press('ArrowUp');
  await expect(cursor(page)).toHaveCount(1);
});
