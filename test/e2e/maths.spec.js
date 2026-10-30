import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { answer, right, toQuiz } from '../../src/maths/items.js';
import { tick } from '../../src/quiz/items.js';
import { emptyProgress, finishSession } from '../../src/progress.js';

// Maths, played the way a learner does: taps on choices and tiles, a drag on the number line. The
// answers are worked out with the same item logic the app uses, so the test follows the course.
const course = JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url)));
const first = course.units[0].lessons[0];
const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });
const marked = (lesson) => lesson.items.filter((i) => i.type !== 'teach');

/** Answers one item right, then waits for the answer banner. */
async function solve(page, item) {
  const bottom = page.locator('.choices');
  switch (item.type) {
    case 'teach': break;
    case 'pick': await bottom.getByRole('button', { name: item.options.find((o) => right(item, o)), exact: true }).click(); break;
    case 'build':
      for (const c of answer(item)) await bottom.getByRole('button', { name: c, exact: true, disabled: false }).first().click(); // one character a tile
      break;
    case 'line': {
      const k = Array.from({ length: item.ticks + 1 }, (_, i) => i).find((i) => right(item, tick(item, i)));
      const box = await page.locator('.numline .track').boundingBox();
      // A drag from the far end to the answer: the marker follows and the drop is the answer.
      await page.mouse.move(box.x + box.width, box.y + 3);
      await page.mouse.down();
      await page.mouse.move(box.x + (box.width * k) / item.ticks, box.y + 3, { steps: 5 });
      await page.mouse.up();
      break;
    }
    case 'pairs': // one from each column, as worked out for the quiz item
      for (const pair of toQuiz(item).pairs) for (const x of pair) await bottom.getByRole('button', { name: x, exact: true, disabled: false }).first().click();
      break;
  }
  await expect(continueButton(page), item.id).toBeInViewport();
}

async function playLesson(page, lesson) {
  for (const item of lesson.items) {
    await solve(page, item);
    await continueButton(page).click();
  }
}

/** Into the intro, Learn something, Maths, and home. */
async function pickMaths(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Learn something' }).click();
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  await page.getByRole('button', { name: 'Show my home' }).click();
}

test('picking Maths in the intro opens its path on Learning; a whole lesson plays with Ada, right first time', async ({ page }) => {
  await pickMaths(page);
  await expect(page.locator('.path-tab[aria-pressed="true"]')).toHaveAttribute('data-path', 'learn');
  await expect(page.getByText('Maths is first. Start with the button below.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Maths', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  await expect(page.locator('.who svg.cast-ada')).toBeVisible();
  await playLesson(page, first);
  const n = marked(first).length;
  await expect(page.getByText(`${n} of ${n} right first try`)).toBeVisible();
  await expect(page.locator('.duo svg.cast-ada')).toBeVisible(); // Ada and Lumi share the end screen
  await continueButton(page).click();
  await expect(page.getByRole('button', { name: `${first.title}, done` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Learning, 1-day streak' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Maths', exact: true })).toHaveAttribute('aria-pressed', 'true'); // remembered
  await page.getByRole('button', { name: 'Chess', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The board' })).toBeVisible();
});

test('a wrong tile ends the item with the answer shown, and the item comes back once at the end', async ({ page }) => {
  await pickMaths(page);
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  const tiles = first.items.find((i) => i.type === 'build');
  for (const item of first.items.slice(0, first.items.indexOf(tiles))) { await solve(page, item); await continueButton(page).click(); }
  const wrong = page.locator('.choices .choice').filter({ hasNotText: answer(tiles)[0] }).first();
  await wrong.click();
  await expect(page.locator('.foot.wrong')).toBeVisible();
  await expect(page.locator('.slot.shown')).toHaveCount(answer(tiles).length);
  await continueButton(page).click();
  for (const item of first.items.slice(first.items.indexOf(tiles) + 1)) { await solve(page, item); await continueButton(page).click(); }
  await solve(page, tiles); // the retry
  await continueButton(page).click();
  const n = marked(first).length;
  await expect(page.getByText(`${n - 1} of ${n} right first try`)).toBeVisible();
});

test('maths cards come back in review, on the shared Learning review', async ({ page }) => {
  const then = new Date();
  then.setDate(then.getDate() - 30);
  const results = marked(first).map((i) => ({ key: `maths:${i.id}`, correct: true }));
  const p = finishSession({ ...emptyProgress(), picked: ['maths'] }, `maths:${first.id}`, results, then);
  await page.addInitScript((saved) => {
    if (!localStorage.getItem('drill.progress')) { localStorage.setItem('drill.progress', saved); localStorage.setItem('drill.course', 'maths'); }
  }, JSON.stringify(p));
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(`^${results.length} to review`) }).click();
  const byId = new Map(first.items.map((i) => [i.id, i]));
  for (let i = 0; i < results.length; i++) {
    // Review order is the scheduler's: find which item is up from what is on screen.
    const said = await page.locator('#said').textContent();
    const item = marked(first).find((x) => x.prompt === said);
    await solve(page, byId.get(item.id));
    await continueButton(page).click();
  }
  await expect(page.getByText('Review done', { exact: true })).toBeVisible();
  await expect(page.getByText(`${results.length} of ${results.length} recalled`)).toBeVisible();
});

test("maths' skip-ahead is an optional offer, and starts the path at the unit picked", async ({ page }) => {
  await pickMaths(page);
  const skip = page.getByRole('button', { name: 'Done some maths already? Skip ahead' });
  await skip.click();
  await expect(page.getByRole('heading', { name: 'How is your maths?' })).toBeFocused();
  await page.getByRole('button', { name: 'Adding in my head is fine' }).click();
  await page.getByRole('button', { name: 'Start at Percentages' }).click();
  await expect(page.locator('.street', { has: page.getByRole('heading', { name: 'Percentages' }) }).locator('.here')).toHaveCount(1);
  await expect(skip).toHaveCount(0);
  await page.getByRole('button', { name: 'Chess', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Know some chess already? Skip ahead' })).toBeVisible(); // each course its own
});

for (const colorScheme of ['light', 'dark']) {
  for (const width of [360, 412]) {
    test(`${width}px ${colorScheme}: every maths item type fits with no sideways scroll`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 800 });
      await pickMaths(page);
      await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
      for (const item of first.items) {
        await expect(page.locator('.stage .quiz')).toBeAttached();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), item.id).toBe(0);
        await solve(page, item);
        await continueButton(page).click();
      }
    });
  }
}
