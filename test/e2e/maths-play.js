import { expect } from '@playwright/test';
import { answer, right, toQuiz } from '../../src/maths/items.js';
import { tick } from '../../src/quiz/items.js';

// Playing Maths the way a learner does, shared by test/e2e/maths.spec.js and test/live/smoke.spec.js.
export const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });

/** Answers one item right, then waits for the answer banner. */
export async function solve(page, item) {
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

export async function playLesson(page, lesson) {
  for (const item of lesson.items) {
    await solve(page, item);
    await continueButton(page).click();
  }
}

/** Into the intro, Learn something, Maths, and home. */
export async function pickMaths(page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Learn something' }).click();
  await page.getByRole('button', { name: 'Maths', exact: true }).click();
  await page.getByRole('button', { name: 'Show my home' }).click();
}

