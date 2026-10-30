import { test, expect } from './fixtures.js';

const seed = (page) => page.addInitScript(() => {
  if (!localStorage.getItem('drill.progress')) localStorage.setItem('drill.progress', JSON.stringify({ version: 3, picked: [], done: {}, cards: {}, habits: {}, log: [] }));
});

test.describe('at 360x640', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("a new course's next lesson is on the first screen, with the garden in sight", async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await expect(page.locator('.offer')).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    const [node, cta, strip] = await Promise.all(['.node.here', '.cta', '.garden-link'].map((s) => page.locator(s).boundingBox()));
    expect(node.y + node.height).toBeLessThan(cta.y);
    expect(strip.height).toBeGreaterThan(60);
    // The course switcher stays on one row.
    const ys = await page.locator('.course').evaluateAll((all) => all.map((c) => c.getBoundingClientRect().y));
    expect(new Set(ys).size).toBe(1);
  });

  for (const habit of ['calm', 'winddown', 'break', 'move', 'focus']) {
    test(`${habit}: the round pause sits beside the coach, and nothing needs a scroll`, async ({ page }) => {
      await page.clock.install();
      await seed(page);
      await page.goto('/');
      await page.locator(`[data-path="${habit}"]`).click();
      await page.locator('.cta .next').click();
      await page.locator('.practice-go').click();
      if (habit === 'focus') await page.locator('[data-on]').first().click();
      const pause = page.getByRole('button', { name: 'Pause' });
      await expect(pause).toBeVisible();
      const [b, who] = await Promise.all([pause.boundingBox(), page.locator('.who').boundingBox()]);
      expect(b.width).toBe(44);
      expect(b.x).toBeGreaterThan(who.x + who.width);
      expect(b.y).toBeLessThan(who.y + who.height); // level with the coach, not at the bottom
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(640);
    });
  }
});
