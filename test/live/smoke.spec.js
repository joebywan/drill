import { test as base, expect } from '../e2e/fixtures.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { continueButton, pickMaths, playLesson } from '../e2e/maths-play.js';
import { INTRO_WORDS } from '../../src/cast/lines.js';

// The deployed site, played from outside. Every test fails on a page error or a failed request.
const course = JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url)));
const first = course.units[0].lessons[0];

const test = base.extend({
  page: async ({ page }, use) => {
    const bad = [];
    page.on('pageerror', (e) => bad.push(`page error: ${e.message}`));
    page.on('requestfailed', (r) => bad.push(`failed request: ${r.url()}`));
    page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await use(page);
    expect(bad).toEqual([]);
  },
});

test('a first visit shows the intro; skipping it gives home', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText(INTRO_WORDS.tagline)).toBeVisible();
  await page.getByRole('button', { name: INTRO_WORDS.skip }).click();
  await expect(page.locator('.garden-link')).toBeVisible();
  await expect(page.locator('.path-tab').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Continue/ })).toBeVisible();
});

test('the first Maths lesson plays to its end and home shows it done', async ({ page }) => {
  await pickMaths(page);
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  await playLesson(page, first);
  await expect(page.getByText(/of \d+ right first try/)).toBeVisible();
  await continueButton(page).click();
  await expect(page.getByRole('button', { name: `${first.title}, done` })).toBeVisible();
});

test('the site serves this commit: app.js and styles.css match the checkout', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  for (const file of ['src/app.js', 'styles.css']) {
    const want = sha(readFileSync(new URL(`../../${file}`, import.meta.url)));
    let got;
    // The deploy may still be spreading: look again for a few minutes.
    await expect(async () => {
      const r = await page.request.get(file, { headers: { 'cache-control': 'no-cache' } });
      got = sha(await r.body());
      expect(got).toBe(want);
    }).toPass({ timeout: 5 * 60_000, intervals: [5_000, 10_000, 20_000] });
  }
});
