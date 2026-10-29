import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { answer, kind, starPath } from '../../src/chess/items.js';

// The first lesson on the path. Its answers are worked out from the course data with the same
// item logic the app uses, so the test follows the content when it changes.
const basics = JSON.parse(readFileSync(new URL('../../src/data/basics.json', import.meta.url)));
const first = basics.units[0].lessons[0];

// Board squares are SVG with no accessible name, so they're found by cm-chessboard's data-square.
async function tap(page, square) {
  const box = await page.locator(`.board rect[data-square="${square}"]`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Plays a move by tapping the piece, then where it goes; waits for the last move to land first. */
async function play(page, { from, to }) {
  await expect(page.locator(`.board g[data-piece][data-square="${from}"]`)).toBeVisible();
  await tap(page, from);
  await tap(page, to);
}

const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });

/** Answers one item correctly, then waits for the answer banner. */
async function solve(page, item) {
  switch (kind(item)) {
    case 'teach': break;
    case 'tap': for (const sq of answer(item)) await tap(page, sq); break;
    case 'stars': for (const m of starPath(item)) await play(page, m); break;
    default: throw new Error(`the e2e test can't play a ${kind(item)} item yet`);
  }
  await expect(continueButton(page), item.id).toBeInViewport();
}

async function placeAtStart(page) {
  await page.goto('/');
  await page.getByRole('button', { name: "I've never played" }).click();
}

test('first visit asks where to start, then shows the path', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Have you played chess before?' })).toBeVisible();
  await page.getByRole('button', { name: "I've never played" }).click();
  await expect(page.getByRole('heading', { name: basics.units[0].title })).toBeVisible();
  await expect(page.getByRole('button', { name: `Continue · ${first.title}` })).toBeVisible();
});

test('finishing the first lesson shows the summary, starts the streak, and survives a reload', async ({ page }) => {
  await placeAtStart(page);
  await expect(page.getByTitle('Day streak')).toHaveText('🔥 0');
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();

  for (const item of first.items) {
    await solve(page, item);
    await continueButton(page).click();
  }

  const marked = first.items.filter((i) => kind(i) !== 'teach').length;
  await expect(page.getByText(`${marked} of ${marked} right first try`)).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await continueButton(page).click();

  const streak = page.getByTitle('Day streak');
  await expect(streak).toHaveText('🔥 1');
  await expect(page.getByRole('button', { name: `${first.title}, done` })).toBeVisible();

  await page.reload();
  await expect(streak).toHaveText('🔥 1');
  await expect(page.getByRole('button', { name: `${first.title}, done` })).toBeVisible();
});

test('mute stays muted after a reload', async ({ page }) => {
  await placeAtStart(page);
  const sound = page.getByRole('button', { name: 'Sound' });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
});

// Path rows are as wide as the trail and shifted sideways by --x, so the shifted ones poke past
// the screen edge and home scrolls sideways (41px at 360, 15px at 412). Marked as a known
// failure: once styles.css clips it, Playwright reports these as unexpectedly passing, so delete
// the test.fail line then.
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const colorScheme of ['light', 'dark']) {
  for (const width of [360, 412]) {
    test.describe(`${width}px, ${colorScheme}`, () => {
      test.use({ colorScheme, viewport: { width, height: 800 } });

      test('home has no sideways scroll', async ({ page }) => {
        test.fail(true, 'path rows overflow the screen: see the comment above');
        await placeAtStart(page);
        await expect(page.getByTitle('Day streak')).toBeVisible();
        expect(await overflow(page)).toBe(0);
      });

      test('a lesson has no sideways scroll', async ({ page }) => {
        await placeAtStart(page);
        await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
        await expect(page.locator('.board svg')).toBeVisible();
        expect(await overflow(page)).toBe(0);
      });
    });
  }
}
