import { test as base, expect, reach, solve } from './fixtures.js';
import { CHESS, CODE, CODING, QUIZ, inView, misfits, reachable, verdictRule } from '../phone/lib/fits.js';
import { daysIn } from '../phone/lib/seed.js';
import { scan } from '../../tools/play.js';
import { subjects } from '../../src/subjects.js';

// Larger text in a browser. A browser's font size setting (Chrome's Settings › Appearance › Font size, Firefox's Fonts
// › Size) changes what 1rem is, and --text-scale follows it (src/app.js, TEXT); Chrome for Android's Default zoom and a
// desktop browser's zoom lay the page out narrower instead (412 CSS px at 200 % is 206: test/phone/zoom.js). Each look:
// home on every tab, new and a month in, one item of each kind asked and answered, an end screen, the garden, the field
// guide and a species, the wardrobe, Settings and the "+ Habit" sheet. Nothing scrolls sideways or is cut off, no path
// label runs into the next node, every button can be scrolled clear of the fixed bars, and in a lesson nothing the
// learner is working on sits under the tray or the verdict (tools/play.js `scan`). The font is pinned as in
// code-courses.spec.js. Chromium sets the size through CDP, Firefox (`npm run e2e:firefox`) through its prefs.
const LOOKS = [
  { name: 'text at 125%', font: 20, viewport: { width: 412, height: 786 } },
  { name: 'text at 200%', font: 32, viewport: { width: 412, height: 786 } },
  { name: '320 wide', font: 16, viewport: { width: 320, height: 568 } },
  { name: '206 wide (200% zoom)', font: 16, viewport: { width: 206, height: 393 } },
];
// What doesn't fit at 206 x 393 (a 412px phone at 200% zoom), by kind and when. That page is beyond what the app promises:
// there the bar is nothing lost and everything reachable (`reachable`), not everything in view.
const LESSON = ['a Chess board (true or false)', 'a quiz pick', 'a match of pairs', 'a sentence build', 'a number line', 'a Coding program', 'a code build with its tray', 'a code quiz card'];
const OPEN = {
  '206 wide (200% zoom)': { asked: ['a quiz pick', 'a code build with its tray'], answered: ['a Chess board (true or false)', 'a quiz pick', 'a Coding program', 'a code build with its tray'] },
};
const PIN = 'body, button { font-family: "DejaVu Sans", Verdana, sans-serif; } :root { --mono: "DejaVu Sans Mono", monospace; }';

const test = base.extend({
  font: [16, { option: true }],
  minimum: [0, { option: true }], // Firefox's minimum font size, px
  page: async ({ page, font, minimum, browserName, playwright, launchOptions, contextOptions, viewport, baseURL }, use) => {
    const fixed = Math.round((font * 13) / 16);
    let own = null;
    if (browserName === 'chromium') await (await page.context().newCDPSession(page)).send('Page.setFontSizes', { fontSizes: { standard: font, fixed } });
    else if (font !== 16 || minimum) { // Firefox reads its default font size from prefs at launch: its own browser, still silent (playwright.firefox.config.js)
      own = await playwright.firefox.launch({ ...launchOptions, firefoxUserPrefs: { ...launchOptions.firefoxUserPrefs, 'font.size.variable.x-western': font, 'font.size.monospace.x-western': fixed, ...(minimum && { 'font.minimum-size.x-western': minimum }) } });
      page = await (await own.newContext({ ...contextOptions, viewport, baseURL, reducedMotion: 'reduce' })).newPage();
      await page.addInitScript(() => { window.WINGBEAT_PLAIN = true; }); // as fixtures.js does
    }
    // The verdict says the longest line its coach has (the one fit.js makes room for), not one picked at random.
    await page.addInitScript(() => { window.WINGBEAT_LONGEST = true; });
    await page.addInitScript((css) => addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: css }))), PIN);
    await use(page);
    await own?.close();
  },
});

test.describe.configure({ mode: 'parallel' });

const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });

/**
 * Everything wrong with the screen as it is, `what` naming it: `misfits` (lib/fits.js), and in a lesson `scan` of its
 * `parts` (tools/play.js). Once answered the verdict is the bar at the bottom, so `scan` judges what it covers.
 */
async function wrong(page, what, parts, answered = false) {
  await page.waitForTimeout(100);
  const found = answered ? await page.evaluate(() => (document.documentElement.scrollWidth > innerWidth ? ['the page scrolls sideways'] : [])) : await page.evaluate(misfits);
  if (parts) found.push(...await page.evaluate(scan, parts));
  if (parts) found.push(...await page.evaluate(inView, parts));
  return found.map((f) => `${what}: ${f}`);
}

/** Answers whatever is asked, right or not, so the verdict comes: a tap at a time, each given time to bring it. */
async function answerAnyhow(page) {
  const foot = page.locator('.foot.show');
  for (let i = 0; i < 12 && !(await foot.count()); i++) {
    const line = page.locator('.numline');
    const run = page.getByRole('button', { name: 'Run', exact: true });
    if (await line.count()) { await line.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); }
    else if (await run.count() && await run.isEnabled() && await page.locator('.program [data-take]').count()) await run.click({ timeout: 5000 });
    else await page.locator('.stage :is(.choices, .tiles) button:not(:disabled):not(.run)').first().click({ timeout: 5000 });
    await foot.waitFor({ timeout: 3000 }).catch(() => {});
  }
  await expect(foot).toBeVisible();
  await expect(foot).toHaveCSS('transform', 'none');
}

for (const look of LOOKS) test.describe(look.name, () => {
  test.use({ viewport: look.viewport, font: look.font });

  test('--text-scale follows the browser\'s font size, and a narrow page leaves it alone', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale'))).toBe(look.font > 16 ? String(look.font / 16) : '');
    // The browser's size reaches every line: the coach's words grow with the headings.
    expect(await page.locator('body').evaluate((b) => getComputedStyle(b).fontSize)).toBe(`${look.font}px`);
  });

  test('home on every tab, new and a month in, fits', async ({ page }) => {
    test.setTimeout(120000);
    const bad = [];
    for (const [who, saved] of [['new', { version: 3, picked: [], done: {}, cards: {}, habits: {}, log: [] }], ['a month in', daysIn(30)]]) {
      await page.goto('/');
      await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('wingbeat.progress', s); }, JSON.stringify(saved));
      await page.reload();
      for (const tab of await page.locator('.path-tab[data-path]').evaluateAll((t) => t.map((x) => x.dataset.path))) {
        await page.locator(`.path-tab[data-path="${tab}"]`).click();
        const courses = tab === 'learn' ? await page.locator('.courses:not(.games) .course').evaluateAll((c) => c.map((x) => x.dataset.course)) : [null];
        for (const course of courses) {
          if (course) await page.locator(`[data-course="${course}"]`).click();
          bad.push(...await wrong(page, `${who}, ${course ?? tab}`));
          // Each node is whole inside the page and its row, its mark inside it.
          bad.push(...(await page.locator('.path li').evaluateAll((rows) => rows.flatMap((li) => {
            const n = li.querySelector('.node').getBoundingClientRect(), r = li.getBoundingClientRect();
            return n.left < 0 || n.right > innerWidth || n.top < r.top - 1 || n.bottom > r.bottom + 1 ? [`node "${li.textContent.trim().slice(0, 20)}" out of its row or the page`] : [];
          }))).map((f) => `${who}, ${course ?? tab}: ${f}`));
        }
      }
    }
    expect(bad).toEqual([]);
  });

  // One item of each kind, asked and then answered (right or not): the lesson, its first item of that kind (after teach cards), the screen's parts.
  for (const [kind, course, lesson, item, parts] of [
    ['a Chess board (true or false)', 'chess', 'check-0', 'check-0-yes', CHESS],
    ['a quiz pick', 'maths', 'ten-0', 'ten-0-gaps', QUIZ],
    ['a match of pairs', 'maths', 'ten-0', 'ten-0-pairs', QUIZ],
    ['a sentence build', 'japanese', 'w1', 'w1-build-57', QUIZ],
    ['a number line', 'maths', 'round-0', 'round-0-line', QUIZ],
    ['a Coding program', 'coding', 'steps-0', 'steps-0-one', CODING],
    ['a code build with its tray', 'javascript', 'jsv-1', 'jsv-1-3', CODE],
    ['a code quiz card', 'javascript', 'jsv-3', 'jsv-3-3', CODE],
  ]) {
    test(`${kind} fits, asked and answered`, async ({ page }) => {
      test.setTimeout(60000);
      const known = OPEN[look.name] ?? {};
      const asked = await reach(page, course, lesson, item);
      const bad = await wrong(page, `${item} asked`, parts);
      const lostAsked = known.asked?.includes(kind) ? (await page.evaluate(reachable, parts)).map((f) => `${item} asked: ${f}`) : [];
      await page.screenshot({ path: test.info().outputPath(`${item}-asked.png`) });
      if (/pairs/.test(item)) await solve(page, course, asked); // a match needs the right pairs to end
      await answerAnyhow(page);
      const after = await wrong(page, `${item} answered`, parts, true);
      await page.screenshot({ path: test.info().outputPath(`${item}-answered.png`) });
      // The verdict: never more than half the screen, Continue in view, its words read to the end in its own box.
      const verdict = (await page.evaluate(verdictRule)).map((f) => `${item} verdict: ${f}`);
      await page.screenshot({ path: test.info().outputPath(`${item}-verdict-end.png`) });
      // Where not everything fits (206 x 393), nothing may be lost: what the tray or the verdict covers can be scrolled clear.
      for (const [when, found] of [['asked', bad], ['answered', after]]) {
        if (!known[when]?.includes(kind)) continue;
        test.info().annotations.push({ type: 'covered, reachable', description: `${when}: ${found.join('; ') || 'fits'}` });
        found.length = 0;
      }
      const lost = [...lostAsked, ...(known.answered?.includes(kind) ? (await page.evaluate(reachable, parts)).map((f) => `${item} answered: ${f}`) : [])];
      expect([...bad, ...after, ...verdict, ...lost]).toEqual([]);
    });
  }

  test('an end screen fits', async ({ page }) => {
    await playThrough(page, 'japanese', 'v1');
    await expect(page.locator('.summary')).toBeVisible();
    expect(await wrong(page, 'end screen')).toEqual([]);
  });

  test('the garden, field guide, a species, wardrobe, Settings and + Habit fit', async ({ page }) => {
    await page.addInitScript((s) => { if (!localStorage.getItem('wingbeat.progress')) localStorage.setItem('wingbeat.progress', s); }, JSON.stringify(daysIn(30)));
    await page.goto('/');
    const bad = [];
    await page.locator('.garden-link').click(); bad.push(...await wrong(page, 'garden'));
    await page.getByRole('button', { name: 'Field guide' }).click(); bad.push(...await wrong(page, 'field guide'));
    await page.locator('.guide-tile').first().click(); bad.push(...await wrong(page, 'species'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click(); bad.push(...await wrong(page, 'settings'));
    await page.getByRole('button', { name: "Lumi's wardrobe" }).click(); bad.push(...await wrong(page, 'wardrobe'));
    await page.goto('/');
    await page.locator('[data-add]').click(); bad.push(...await wrong(page, '+ Habit'));
    expect(bad).toEqual([]);
  });
});

// A minimum font size enlarges only small text, such as a path's labels (.8rem): the rows must grow with them.
test.describe('a minimum font size of 20px', () => {
  test.use({ viewport: { width: 412, height: 786 }, minimum: 20 });
  test("the path's rows grow with its labels", async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', "Chrome's minimum font size is a profile setting, not one CDP can set");
    await page.addInitScript((s) => { if (!localStorage.getItem('wingbeat.progress')) localStorage.setItem('wingbeat.progress', s); }, JSON.stringify(daysIn(30)));
    await page.goto('/');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale'))).toBe('1.56');
    const bad = [];
    for (const path of ['learn', 'calm', 'move']) { await page.locator(`[data-path="${path}"]`).click(); bad.push(...await wrong(page, path)); }
    expect(bad).toEqual([]);
  });
});

/** Opens `lesson` and plays through it to its end screen. */
async function playThrough(page, course, lesson) {
  const { items } = subjects.find((s) => s.id === course).units.flatMap((u) => u.lessons).find((l) => l.id === lesson);
  await reach(page, course, lesson, items[0].id);
  for (const item of items) { await solve(page, course, item); await continueButton(page).click(); }
}
