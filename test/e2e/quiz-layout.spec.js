import { test, expect, reach } from './fixtures.js';

// What a learner is working on stays in view and readable in the quiz items (src/quiz/, src/fit.js): every option of
// a pick is whole on the screen, a sentence build's slots sit clear of the tray and the verdict, and stacked bars
// clear the verdict, on a short phone too. Reached by playing the lesson up to the item, as a learner does.
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });

test.describe('at 412x786', () => {
  test.use({ viewport: { width: 412, height: 786 } });

  test('every option of a pick is whole on the screen, however long its label', async ({ page }) => {
    for (const [lesson, id] of [['hi', 'hi-pick-295'], ['ty', 'ty-pick-304']]) {
      await reach(page, 'japanese', lesson, id);
      const options = await page.locator('.quiz .choices .choice').evaluateAll((all) => all.map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent, left: r.left, right: r.right, clipped: e.scrollWidth > e.clientWidth + 1, h: r.height }; }));
      expect(options.length, id).toBe(3);
      for (const o of options) {
        expect(o.left, `${id} ${o.text}`).toBeGreaterThanOrEqual(0);
        expect(o.right, `${id} ${o.text}`).toBeLessThanOrEqual(412);
        expect(o.clipped, `${id} ${o.text} clipped`).toBe(false);
        expect(o.h, `${id} ${o.text} stays a full-size target`).toBeGreaterThanOrEqual(60);
      }
    }
  });
});

test.describe('at 412x533', () => {
  test.use({ viewport: { width: 412, height: 533 } });

  test('a sentence build keeps its slots above the tray, and above the verdict once answered', async ({ page }) => {
    const item = await reach(page, 'japanese', 'se3', 'se3-build-332');
    const slots = page.locator('.quiz .slots');
    expect((await rect(page, '.quiz .slots')).bottom, 'asked').toBeLessThanOrEqual((await rect(page, '.choices')).top);
    for (const t of item.answer) await page.locator('.quiz .choices .choice:not(:disabled)').filter({ hasText: new RegExp(`^${t}$`) }).first().click();
    await expect(page.locator('.foot.show')).toBeVisible();
    await expect(page.locator('.foot.show')).toHaveCSS('transform', 'none');
    expect((await rect(page, '.quiz .slots')).bottom, 'answered').toBeLessThanOrEqual((await rect(page, '.foot.show')).top);
    expect((await rect(page, '.quiz .slots')).top).toBeGreaterThanOrEqual(0);
    await expect(slots).toBeVisible();
  });

  // Twice: with the machine's own font, and with rows far taller than any font makes them, when the pairs must scroll.
  for (const [how, tall] of [['as it comes', 0], ['with every label wrapped', 96]]) {
    test(`a five-pair match sits clear of the coach's words, ${how}`, async ({ page }) => {
      if (tall) await page.addInitScript((h) => addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: `.quiz .quiz-pairs .choice { min-height: ${h}px !important; }` }))), tall);
      await reach(page, 'japanese', 'gn', 'gn-pairs-315');
      const [bubble, pairs] = [await rect(page, '.play .bubble'), await rect(page, '.quiz .choices')];
      expect(bubble.top, 'her words are on the screen').toBeGreaterThanOrEqual(0);
      expect(pairs.top, 'the pairs start below her words').toBeGreaterThanOrEqual(bubble.bottom - 1);
      expect(pairs.bottom, 'and end on the screen').toBeLessThanOrEqual(533);
      if (tall) { // she has given way, so her bubble is only as tall as her words
        await expect(page.locator('.quiz')).toHaveClass(/\btall\b/);
        await expect(page.locator('.play .bubble')).toHaveCSS('min-height', '0px');
      }
      // Every pair can still be reached and matched.
      for (const c of await page.locator('.quiz .choices .choice').all()) { await c.scrollIntoViewIfNeeded(); await expect(c).toBeInViewport(); }
    });
  }

  test('stacked fraction bars stay above the verdict', async ({ page }) => {
    const item = await reach(page, 'maths', 'frac-1', 'frac-1-biggest');
    await page.locator('.quiz .choices .choice').filter({ hasText: /^1\/3$/ }).click();
    await expect(page.locator('.foot.show')).toHaveCSS('transform', 'none');
    const bars = await page.locator('.quiz .pic').evaluateAll((all) => all.map((e) => e.getBoundingClientRect().bottom));
    expect(bars.length, item.id).toBe(3);
    expect(Math.max(...bars)).toBeLessThanOrEqual((await rect(page, '.foot.show')).top);
  });
});

test.describe('at 360x640', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  // What is under the slots (the tray) stays where it was as the slots fill: a filled word may not make a row of its own.
  for (const [lesson, id] of [['se1', 'se1-build-319'], ['se3', 'se3-build-332']]) {
    test(`a sentence's slots keep their height as they fill (${id})`, async ({ page }) => {
      const item = await reach(page, 'japanese', lesson, id);
      const slots = page.locator('.quiz .slots');
      const asked = (await slots.boundingBox()).height;
      const widths = await page.locator('.quiz .slot').evaluateAll((all) => all.map((e) => Math.round(e.getBoundingClientRect().width)));
      expect(new Set(widths).size, `empty slots are all one width: ${widths}`).toBe(1); // a slot's width never gives its word away
      for (const t of item.answer.slice(0, -1)) await page.locator('.quiz .choices .choice:not(:disabled)').filter({ hasText: new RegExp(`^${t}$`) }).first().click();
      expect((await slots.boundingBox()).height, 'one slot still empty').toBe(asked);
      await page.locator('.quiz .choices .choice:not(:disabled)').first().click();
      expect((await slots.boundingBox()).height, 'every slot filled').toBe(asked);
    });
  }
});
