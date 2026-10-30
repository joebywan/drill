import { test, expect } from '@playwright/test';

const seed = (page, course, done = {}) => page.addInitScript(([c, d]) => {
  if (localStorage.getItem('drill.progress')) return;
  localStorage.setItem('drill.course', c);
  localStorage.setItem('drill.progress', JSON.stringify({ version: 3, picked: [], done: d, cards: {}, habits: {}, log: [] }));
}, [course, done]);

test("a course's own coach waits on its path and introduces themselves once, before the first lesson", async ({ page }) => {
  await seed(page, 'coding');
  await page.goto('/');
  await expect(page.locator('.guide svg')).toHaveClass(/cast-fennel/);
  await page.locator('.node.here').click();
  await expect(page.getByRole('heading', { name: 'Meet Fennel' })).toBeFocused();
  await expect(page.locator('.meet .does li')).toHaveCount(3);
  await page.getByRole('button', { name: "Let's build" }).click();
  await expect(page.locator('.who svg')).toHaveClass(/cast-fennel/);
  await page.getByRole('button', { name: 'Quit lesson' }).click();
  const leave = page.getByRole('button', { name: /leave|quit/i });
  if (await leave.count()) await leave.first().click();
  await page.reload();
  await page.locator('.node.here').click();
  await expect(page.locator('.who svg')).toHaveClass(/cast-fennel/);
  await expect(page.getByRole('heading', { name: 'Meet Fennel' })).toHaveCount(0);
});

test('someone already on a course never gets the introduction', async ({ page }) => {
  await seed(page, 'maths', { 'maths:done-already': true });
  await page.goto('/');
  await expect(page.locator('.guide svg')).toHaveClass(/cast-ada/);
  await page.locator('.node.here').click();
  await expect(page.locator('.who svg')).toHaveClass(/cast-ada/);
});
