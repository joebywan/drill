import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
import { answer, kind, starPath } from '../../src/chess/items.js';
import { emptyProgress, finishPractice } from '../../src/progress.js';
import { award } from '../../src/garden/model.js';

// Lumi's skins: one arrives on the end screen, shows in the wardrobe, is worn with one tap, and
// she wears it on the next end screen.
const basics = JSON.parse(readFileSync(new URL('../../src/data/basics.json', import.meta.url)));
const first = basics.units[0].lessons[0];

async function tap(page, square) {
  const box = await page.locator(`.board rect[data-square="${square}"]`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });
async function playFirst(page) {
  for (const item of first.items) {
    if (kind(item) === 'tap') for (const sq of answer(item)) await tap(page, sq);
    else if (kind(item) === 'stars') for (const { from, to } of starPath(item)) {
      await expect(page.locator(`.board g[data-piece][data-square="${from}"]`)).toBeVisible();
      await tap(page, from);
      await tap(page, to);
    }
    else if (kind(item) !== 'teach') throw new Error(`can't play a ${kind(item)} item`);
    await expect(continueButton(page)).toBeInViewport();
    await continueButton(page).click();
  }
}

test('a daisy arrives for 7 days practised, is worn from the wardrobe, and Lumi wears it on the next end screen', async ({ page }) => {
  // Six days of Calm in October: one more day of anything is the garden's seventh.
  let p = { ...emptyProgress(), picked: [] };
  for (let d = 1; d <= 6; d++) p = finishPractice(p, 'calm', null, new Date(2026, 9, d, 9));
  p = award(p, new Date(2026, 9, 6, 9)).progress; // what those days brought is already in the garden
  await page.addInitScript((s) => { if (!localStorage.getItem('wingbeat.progress')) localStorage.setItem('wingbeat.progress', s); }, JSON.stringify(p));
  await page.goto('/');
  await page.locator('[data-path="learn"]').click();
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  await playFirst(page);

  await expect(page.locator('.arrivals')).toContainText('A daisy for Lumi to wear');
  await expect(page.locator('.arrivals svg.skin-daisy')).toHaveCount(1);
  await expect(page.locator('.duo .hero.lumi svg')).not.toHaveClass(/skin-/); // given, not yet worn
  await continueButton(page).click();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: "Lumi's wardrobe" }).click();
  await expect(page.getByRole('heading', { name: "Lumi's wardrobe" })).toBeFocused();
  await expect(page.getByRole('button', { name: /^Just Lumi/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('li.skin-card.later')).toHaveCount(6);
  await expect(page.locator('li.skin-card.later').filter({ hasText: 'A flower crown' })).toContainText('From the Spring market');
  const daisy = page.getByRole('button', { name: /^A daisy/ });
  await expect(daisy).toContainText('For 7 days practised');
  await daisy.click();
  await expect(page.getByRole('button', { name: /^A daisy/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^Just Lumi/ })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wingbeat.progress')).skin)).toBe('daisy');

  await page.goBack(); // the phone's back (nav.js) presses the wardrobe's own
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  // The garden opens it too.
  await page.locator('.garden-link').click();
  await page.getByRole('button', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('button', { name: /^A daisy/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.reload(); // the choice is kept
  await page.getByRole('button', { name: `${first.title}, done` }).click();
  await playFirst(page);
  await expect(page.locator('.duo .hero.lumi svg')).toHaveClass(/skin-daisy/);
  await expect(page.locator('.arrivals')).toHaveCount(0);
});

test("with the Android bridge, wearing a skin sends Lumi's poses again, and only hers", async ({ page }) => {
  await page.addInitScript(() => {
    const calls = (window.bridgeCalls = []);
    window.WingbeatBridge = { summary: () => {}, art: (pose, png) => calls.push([pose, png.length]), remindersOn: () => false, reminders: () => {}, notes: () => '[]' };
  });
  const p = { ...emptyProgress(), picked: [], garden: { earned: { 'skin:crown': '2026-10-01' } } };
  await page.addInitScript((s) => { if (!localStorage.getItem('wingbeat.progress')) localStorage.setItem('wingbeat.progress', s); }, JSON.stringify(p));
  await page.goto('/');
  const sent = () => page.evaluate(() => window.bridgeCalls.map(([pose]) => pose));
  await expect.poll(async () => (await sent()).length).toBe(9);
  const plain = await page.evaluate(() => window.bridgeCalls[0][1]);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: "Lumi's wardrobe" }).click();
  await page.getByRole('button', { name: /^A flower crown/ }).click();
  await expect.poll(async () => (await sent()).slice(9)).toEqual(['teach', 'sleepy', 'complete']);
  expect(await page.evaluate(() => window.bridgeCalls[9][1])).not.toBe(plain); // she wears it there too
});
