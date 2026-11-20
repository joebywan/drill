import { test, expect, calmFinished } from './fixtures.js';
import { daysIn } from '../phone/lib/seed.js';

const seed = (page) => page.addInitScript(() => {
  if (!localStorage.getItem('wingbeat.progress')) localStorage.setItem('wingbeat.progress', JSON.stringify({ version: 3, picked: [], done: {}, cards: {}, habits: {}, log: [] }));
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

  test('the + Habit sheet fits all nine presets and Make your own, and "When will you do it?" fits too', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Add a habit' }).click();
    await expect(page.locator('[data-track]')).toHaveCount(9);
    await expect(page.getByRole('button', { name: 'Make your own' })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.locator('[data-track="call"]').click();
    await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'At lunch' }).click();
    await expect(page.locator('.log-habit .when')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'I called someone today' })).toBeInViewport({ ratio: 1 });
  });

  // Before a finished lesson there is nothing being raised, so the test above holds the first screen; after
  // one, the next node already sat below the fold (home scrolls it into view), with or without the line.
  test('a started course shows what it is raising, and its next lesson is still in view', async ({ page }) => {
    await page.addInitScript(() => {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!localStorage.getItem('wingbeat.progress')) localStorage.setItem('wingbeat.progress', JSON.stringify({ version: 10, picked: [], done: { 'chess:board-0': true }, cards: {},
        habits: { learn: { count: 1, last: date, forgiven: [], days: 1 } }, log: [{ date, habit: 'learn', lesson: 'chess:board-0', title: 'Squares and coordinates', mins: 1 }] }));
    });
    await page.goto('/');
    await expect(page.locator('.streak-row .raising')).toHaveAccessibleName('Chess is raising a Chequered Swallowtail');
    const [node, cta] = await Promise.all(['.node.here', '.cta'].map((s) => page.locator(s).boundingBox()));
    expect(node.y).toBeGreaterThan(0);
    expect(node.y + node.height).toBeLessThan(cta.y);
  });

  test("after a session, your butterfly sits on the streak line's row and the next lesson stays on the first screen", async ({ page }) => {
    await page.addInitScript(() => {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      localStorage.setItem('wingbeat.progress', JSON.stringify({ version: 10, picked: [], done: {}, cards: {}, wings: ['learn'],
        habits: { learn: { count: 1, last: date, forgiven: [], days: 1 } }, log: [{ date, habit: 'learn', title: 'Review', mins: 1 }] }));
    });
    await page.goto('/');
    await expect(page.locator('.offer')).toBeVisible();
    const [node, cta, yours, line] = await Promise.all(['.node.here', '.cta', '.yours-link', '.streak-line'].map((s) => page.locator(s).boundingBox()));
    expect(node.y + node.height).toBeLessThan(cta.y);
    expect(Math.abs(yours.y + yours.height / 2 - (line.y + line.height / 2))).toBeLessThan(2); // one row
  });

  test("Reflect's look back, even a long one, leaves the next step in sight", async ({ page }) => {
    const day = new Date();
    day.setDate(day.getDate() - 7);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    await page.addInitScript(([d, text]) => localStorage.setItem('wingbeat.progress', JSON.stringify({ version: 3, picked: [], done: {}, cards: {}, habits: {}, log: [], journal: { [d]: { good: text } } })),
      [date, 'A very long line about a walk by the river with a friend, and the sun came out just as we reached the old bridge. '.repeat(3)]);
    await page.goto('/');
    await page.locator('[data-path="reflect"]').click();
    const [line, node, cta] = await Promise.all(['.look-back', '.node.here', '.cta'].map((s) => page.locator(s).boundingBox()));
    expect(line.height).toBeLessThan(100);
    expect(node.y + node.height).toBeLessThan(cta.y);
  });

  test("on Reflect, your butterfly's row and the look back together still leave the next step in sight", async ({ page }) => {
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = new Date(), before = new Date();
    before.setDate(before.getDate() - 7);
    const [today, weekAgo] = [ymd(now), ymd(before)];
    await page.addInitScript(([t, w, text]) => localStorage.setItem('wingbeat.progress', JSON.stringify({ version: 10, picked: [], done: {}, cards: {}, wings: ['reflect', 'reflect'],
      habits: { reflect: { count: 1, last: t, forgiven: [], days: 2 } }, log: [{ date: w, habit: 'reflect', title: 'Reflect', mins: 1 }, { date: t, habit: 'reflect', title: 'Reflect', mins: 1 }],
      journal: { [w]: { good: text } } })), [today, weekAgo, 'A very long line about a walk by the river with a friend, and the sun came out just as we reached the old bridge. '.repeat(3)]);
    await page.goto('/');
    await page.locator('[data-path="reflect"]').click();
    await expect(page.locator('.yours-link')).toBeVisible();
    await expect(page.locator('.look-back')).toBeVisible();
    const [node, cta] = await Promise.all(['.node.here', '.cta'].map((s) => page.locator(s).boundingBox()));
    expect(node.y + node.height).toBeLessThan(cta.y);
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
      window.WingbeatBridge = { summary() {}, art() {}, remindersOn: () => false, reminders() {}, notes: () => '[]', hasVoice: (l) => l === 'ja-JP', speak: (t, l) => window.said.push([t, l]) };
    });
    await page.goto('/');
    await page.locator('[data-course="japanese"]').click();
    await page.getByRole('button', { name: /^Continue/ }).click();
    await page.getByRole('button', { name: 'Hear it again' }).click();
    expect((await page.evaluate(() => window.said)).at(-1)).toEqual(['あ', 'ja-JP']);
  });

  test('in the wrapper with no Japanese voice, a teach card offers to get one, once; a browser never sees it', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.locator('[data-course="japanese"]').click();
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expect(page.locator('.reading')).toBeVisible();
    await expect(page.locator('.get-voice')).toHaveCount(0);
    await page.addInitScript(() => {
      window.installs = 0;
      window.WingbeatBridge = { summary() {}, art() {}, remindersOn: () => false, reminders() {}, notes: () => '[]', hasVoice: () => false, speak() {}, installVoice: () => window.installs++ };
    });
    await page.goto('/');
    await page.locator('[data-course="japanese"]').click();
    await page.getByRole('button', { name: /^Continue/ }).click();
    await page.getByRole('button', { name: 'Get a Japanese voice' }).click();
    expect(await page.evaluate(() => window.installs)).toBe(1);
    await page.goto('/');
    await page.locator('[data-course="japanese"]').click();
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expect(page.locator('.reading')).toBeVisible();
    await expect(page.locator('.get-voice')).toHaveCount(0);
  });

  test('the bars follow the page: Wind down is dark even in light mode', async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => {
      window.bars = [];
      window.WingbeatBridge = { summary() {}, art() {}, remindersOn: () => false, reminders() {}, notes: () => '[]', bars: (c, light) => window.bars.push([c, light]) };
    });
    await page.goto('/');
    expect((await page.evaluate(() => window.bars)).at(-1)).toEqual(['#f6f7f9', true]);
    await page.locator('[data-path="winddown"]').click();
    await page.locator('.cta .next').click();
    await expect.poll(async () => (await page.evaluate(() => window.bars)).at(-1)).toEqual(['#18140f', false]);
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#18140f');
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

test.describe('a finished practice path at 360x640', () => {
  test.use({ viewport: { width: 360, height: 640 } });
  test('the big button and the Something else link fit, and the path still shows', async ({ page }) => {
    await page.addInitScript((s) => { localStorage.setItem('wingbeat.progress', s); }, calmFinished());
    await page.goto('/');
    await page.locator('[data-path="calm"]').click();
    const [cta, link, strip] = await Promise.all(['.cta', '.choose', '.garden-link'].map((s) => page.locator(s).boundingBox()));
    expect(link.y + link.height).toBeLessThanOrEqual(640);
    expect(cta.height).toBeLessThan(150);
    expect(strip.y + strip.height).toBeLessThan(cta.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});

// A month in (and 131 days in, a three-digit streak), home's rows above the path stay few: the first unit's title starts in
// the top half of the page on every path tab, and your butterfly, the streak line and what the path is raising share one
// row. The font is pinned (as in code-courses.spec.js) so this machine and CI measure the same text: with it the streak
// line is one line at 412 wide and at most two, between the pictures, at 360.
for (const [width, height] of [[412, 786], [360, 640]]) {
  test.describe(`a month in at ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });
    for (const days of [30, 131]) {
      test(`${days} days in: every path tab starts its path in the top half, and the streak row is one row`, async ({ page }) => {
        await page.addInitScript((saved) => { if (!localStorage.getItem('wingbeat.progress')) localStorage.setItem('wingbeat.progress', saved); }, JSON.stringify(daysIn(days)));
        await page.goto('/');
        for (const [path, course] of [['learn', 'chess'], ['learn', 'maths'], ['calm'], ['move'], ['reflect']]) {
          const what = `${days} days, ${course ?? path}`;
          await page.locator(`[data-path="${path}"]`).click();
          if (course) await page.locator(`[data-course="${course}"]`).click();
          await page.addStyleTag({ content: 'body, button { font-family: "DejaVu Sans", Verdana, sans-serif; }' });
          await page.evaluate(() => scrollTo(0, 0));
          const top = await page.locator('.street h2').first().evaluate((h) => h.getBoundingClientRect().top);
          // ponytail: Chess at 360x640 is the one miss: its Games row (44px) puts the title at about 55% of 640. Accepted
          // by the owner; held below 60% so it can't creep further.
          expect(top, what).toBeLessThan(course === 'chess' && height < 700 ? height * 0.6 : height / 2);
          const { lines, apart, out, cut } = await page.locator('.streak-row').evaluate((row) => {
            const r = document.createRange();
            const line = row.querySelector('.streak-line');
            r.selectNodeContents(line);
            const box = row.getBoundingClientRect(), mid = box.top + box.height / 2;
            const kids = [...row.children].map((c) => c.getBoundingClientRect());
            return {
              lines: new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size,
              // Level: each item (the pictures and the text) overlaps the row's middle.
              apart: kids.filter((b) => b.top > mid || b.bottom < mid).length,
              out: kids.filter((b) => b.left < 0 || b.right > innerWidth).length,
              cut: line.scrollWidth > line.clientWidth + 1 || line.scrollHeight > line.clientHeight + 1,
            };
          });
          expect(lines, what).toBeLessThanOrEqual(width >= 412 ? 1 : 2);
          expect(apart, what).toBe(0);
          expect(out, what).toBe(0);
          expect(cut, what).toBe(false);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      });
    }
  });
}
