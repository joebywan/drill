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
    const ys = await page.locator('.courses:not(.games) .course').evaluateAll((all) => all.map((c) => c.getBoundingClientRect().y));
    expect(new Set(ys).size).toBe(1);
  });

  test('a course pill and the ✕ answer a thumb that lands just outside them', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    const at = (sel, x, y) => page.locator(sel).first().evaluate((el, [x, y]) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width * x, r.top + y)?.closest('button') === el;
    }, [x, y]);
    const pill = await page.locator('.courses .course').first().boundingBox();
    expect(pill.height).toBe(36); // the row keeps its height; only the target grows
    expect(await at('.courses .course', 0.5, -3)).toBe(true);
    expect(await at('.courses .course', 0.5, pill.height + 3)).toBe(true);
    await page.getByRole('button', { name: /^Continue/ }).click();
    expect(await at('.close', 0.5, -3)).toBe(true);
  });

  test('in the wrapper, where WebView has no speechSynthesis, speech goes through the bridge', async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => {
      window.said = [];
      window.DrillBridge = { summary() {}, art() {}, remindersOn: () => false, reminders() {}, notes: () => '[]', hasVoice: (l) => l === 'ja-JP', speak: (t, l) => window.said.push([t, l]) };
    });
    await page.goto('/');
    await page.locator('[data-course="japanese"]').click();
    await page.getByRole('button', { name: /^Continue/ }).click();
    await page.getByRole('button', { name: 'Hear it again' }).click();
    expect((await page.evaluate(() => window.said)).at(-1)).toEqual(['あ', 'ja-JP']);
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
