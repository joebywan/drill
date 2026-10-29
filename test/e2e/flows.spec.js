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

async function finishFirstLesson(page) {
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  for (const item of first.items) {
    await solve(page, item);
    await continueButton(page).click();
  }
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
  await finishFirstLesson(page);

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

test("a habit's chip opens its view, with today's session listed", async ({ page }) => {
  await placeAtStart(page);
  await finishFirstLesson(page);
  await continueButton(page).click();

  await page.getByRole('button', { name: 'Learning: 1-day streak' }).click();
  await expect(page.getByRole('heading', { name: 'Learning' })).toBeFocused();
  await expect(page.locator('.day').first()).toContainText('Today');
  await expect(page.locator('.day').first().getByRole('listitem')).toContainText(`${first.title} · `);
  await expect(page.getByText('1 of the last 14 days')).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Learning: 1-day streak' })).toBeFocused();
});

/** Switches home to Calm and does the first breathing lesson, on a fake clock: 3 breaths, 36 s. */
async function firstBreathing(page) {
  await page.clock.install();
  await placeAtStart(page);
  await page.getByRole('button', { name: '🌿 Calm', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Breathing' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue · The long out-breath' }).click();
  await expect(page.getByText('Lifeline is 13 11 14')).toBeVisible(); // real help, on the first Calm lesson
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Breath 1 of 3')).toBeVisible();
  // Pausing holds the clock: a long pause moves nothing on.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.clock.runFor(60_000);
  await expect(page.getByText('Breath 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Carry on' }).click();
  await page.clock.runFor(30_000);
  await expect(page.getByText('Breath 3 of 3')).toBeVisible();
  await page.clock.runFor(7_000);
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
}

test('a Calm breathing session keeps its own streak, and asks how you feel', async ({ page }) => {
  await firstBreathing(page);
  await expect(page.getByText(/^3 breaths · \d+ min$/)).toBeVisible();
  await expect(page.locator('.chip.calm')).toContainText('🌿 1');
  await page.getByRole('button', { name: 'Calmer' }).click();
  await expect(page.getByRole('button', { name: 'Calmer' })).toHaveCount(0);
  await continueButton(page).click();

  // Home remembers Calm, the next breathing lesson is open, and Learning's streak is untouched.
  await expect(page.getByRole('button', { name: '🌿 Calm', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'The long out-breath, done' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue · Five slow breaths' })).toBeVisible();
  await expect(page.getByTitle('Day streak')).toHaveText('🔥 0');

  await page.getByRole('button', { name: 'Calm: 1-day streak' }).click();
  await expect(page.locator('.day').first().getByRole('listitem')).toHaveText(/^Breathing · \d+ min · felt calmer$/);
  await page.getByRole('button', { name: 'Back' }).click();

  await page.reload();
  await expect(page.getByRole('button', { name: '🌿 Calm', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '🔥 Learning', exact: true }).click();
  await expect(page.getByRole('button', { name: `Continue · ${first.title}` })).toBeVisible();
});

test('"Not really" gets a kind line and the help line', async ({ page }) => {
  await firstBreathing(page);
  await page.getByRole('button', { name: 'Not really' }).click();
  await expect(page.getByRole('status')).not.toBeEmpty();
  await expect(page.getByText("If you're struggling, talk to someone. In Australia, Lifeline is 13 11 14, any time.")).toBeVisible();
});

test('grounding is tap-to-count, and stopping is one tap with no questions', async ({ page }) => {
  await firstBreathing(page); // grounding opens once breathing has been started
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Five senses' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: '5 things you can see' })).toBeVisible();
  for (let i = 1; i <= 5; i++) await page.getByRole('button', { name: `Noticed ${i} of 5` }).click();
  await expect(page.getByRole('heading', { name: '4 things you can hear' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click(); // moving on with none tapped is fine
  await expect(page.getByRole('heading', { name: '3 things you can touch' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: '🌿 Calm', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Stopping logs nothing: today still shows just the breathing.
  await page.getByRole('button', { name: 'Calm: 1-day streak' }).click();
  await expect(page.locator('.day').first().getByRole('listitem')).toHaveCount(1);
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

test('progress saved to a file loads back', async ({ page }) => {
  await placeAtStart(page);
  await finishFirstLesson(page);
  await continueButton(page).click();

  await page.getByRole('button', { name: 'Your progress' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save to a file' }).click();
  const file = await (await download).path();

  // A browser that lost everything: start over, then load the file back.
  await page.evaluate(() => localStorage.clear());
  await placeAtStart(page);
  await expect(page.getByTitle('Day streak')).toHaveText('🔥 0');
  await page.getByRole('button', { name: 'Your progress' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load from a file' }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByText('The file has 1 lesson done, a 1-day streak')).toBeVisible();
  await page.getByRole('button', { name: 'Use this file' }).click();

  await expect(page.getByTitle('Day streak')).toHaveText('🔥 1');
  await expect(page.getByRole('button', { name: `${first.title}, done` })).toBeVisible();
});

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const colorScheme of ['light', 'dark']) {
  for (const width of [360, 412]) {
    test.describe(`${width}px, ${colorScheme}`, () => {
      test.use({ colorScheme, viewport: { width, height: 800 } });

      test('home has no sideways scroll', async ({ page }) => {
        await placeAtStart(page);
        await expect(page.getByTitle('Day streak')).toBeVisible();
        expect(await overflow(page)).toBe(0);
      });

      test('the habit view has no sideways scroll', async ({ page }) => {
        await placeAtStart(page);
        await page.getByTitle('Day streak').click();
        await expect(page.getByRole('heading', { name: 'Learning' })).toBeVisible();
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
