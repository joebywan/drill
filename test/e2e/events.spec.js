import { test, expect } from './fixtures.js';
import { emptyProgress, finishPractice } from '../../src/progress.js';

// Fixed dates and a Sydney device: the January event is the summer one, the owner's own hemisphere.
test.use({ timezoneId: 'Australia/Sydney' });

const atDate = async (page, iso) => {
  await page.clock.setFixedTime(new Date(iso));
  const p = finishPractice(emptyProgress(), 'calm', null, new Date(iso), { title: 'Breathe', mins: 2 });
  await page.addInitScript((s) => { if (!localStorage.getItem('drill.progress')) localStorage.setItem('drill.progress', s); }, JSON.stringify(p));
  await page.goto('/');
};
const tap = (page, sq) => page.locator(`.board rect[data-square="${sq}"]`).click();
const hop = async (page, from, to) => { await tap(page, from); await tap(page, to); };
const next = (page) => page.locator('.foot.show .next').click();

test('the park tournament changes the garden, its set grants the pennant, and it stays when the event is over', async ({ page }) => {
  await atDate(page, '2027-01-10T12:00:00+11:00');
  await expect(page.locator('.garden-link svg.event-summer-tournament')).toBeVisible();
  await expect(page.locator('.event-tag')).toHaveText('Park tournament');
  await page.locator('.garden-link').click();
  await expect(page.locator('.garden-view svg.event-summer-tournament')).toBeVisible();
  const card = page.locator('.event-card');
  await expect(card).not.toContainText(/\d+ days?|left|until|ends/i);
  await card.getByRole('button', { name: 'Tournament boards' }).click();

  await next(page); // the teach card
  await hop(page, 'a1', 'a8');
  await hop(page, 'a8', 'h8');
  await next(page);
  await hop(page, 'c1', 'g5');
  await hop(page, 'g5', 'd8');
  await next(page);
  await hop(page, 'g1', 'f3');
  await hop(page, 'f3', 'g5');
  await next(page);
  await hop(page, 'a1', 'a8');
  await next(page);

  await expect(page.locator('.arrival, .arrivals').first()).toContainText('pennant');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')));
  expect(saved.done['event:summer-tournament']).toBe(true);
  expect(saved.garden.earned['garden:pennant']).toBeTruthy();
  expect(saved.cards).toEqual({});

  await page.locator('.cta .next').click();
  await page.locator('.garden-link').click();
  await expect(page.locator('.event-card')).toContainText('yours to keep');
  await expect(page.locator('.garden-view [data-landmark="pennant"]')).toBeAttached();

  // A later date: the garden is plain again, the pennant isn't.
  await page.clock.setFixedTime(new Date('2027-02-20T12:00:00+11:00'));
  await page.reload();
  await page.locator('.garden-link').click();
  await expect(page.locator('.event-card')).toHaveCount(0);
  await expect(page.locator('.garden-view svg.garden-scene')).not.toHaveClass(/event-/);
  await expect(page.locator('.garden-view [data-landmark="pennant"]')).toBeAttached();
});

test('off the event dates there is no tag and no card', async ({ page }) => {
  await atDate(page, '2027-01-25T12:00:00+11:00');
  await expect(page.locator('.event-tag')).toHaveCount(0);
  await page.locator('.garden-link').click();
  await expect(page.locator('.event-card')).toHaveCount(0);
});

test('the southern toggle flips a Sydney January to the northern winter festival', async ({ page }) => {
  await atDate(page, '2027-01-10T12:00:00+11:00');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Southern hemisphere seasons' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.event-tag')).toHaveText('Winter festival');
});
