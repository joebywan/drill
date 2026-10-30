import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { emptyProgress, finishPractice, finishSession } from '../../src/progress.js';
import { API } from '../../src/sync/config.js';

// Sync and friends against the real worker, run locally (server/dev.js: Miniflare with an
// in-memory D1). The app keeps its one API constant; each browser context routes that host to
// the local worker. Needs `npm ci --prefix server` (CI does it).
let worker;
test.beforeAll(async () => {
  const { start } = await import('../../server/dev.js');
  worker = await start({ port: 0 });
});
test.afterAll(() => worker?.mf.dispose());

async function device(browser) {
  const context = await browser.newContext();
  await context.route(`${API}/**`, async (route) => {
    const response = await route.fetch({ url: route.request().url().replace(API, worker.url) });
    await route.fulfill({ response });
  });
  return context.newPage();
}

const basics = JSON.parse(readFileSync(new URL('../../src/data/basics.json', import.meta.url)));
const first = basics.units[0].lessons[0];

async function open(page, progress) {
  if (progress) await page.addInitScript((p) => { if (!localStorage.getItem('drill.progress')) localStorage.setItem('drill.progress', p); }, JSON.stringify(progress));
  await page.goto('/');
  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await skip.click();
}

const menu = async (page, item) => {
  await page.getByRole('button', { name: 'Your progress' }).click();
  await page.getByRole('button', { name: item }).click();
};
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')));

test('sync is off until turned on: nothing is sent', async ({ page }) => {
  const calls = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')) calls.push(r.url()); });
  await open(page, finishPractice(emptyProgress(), 'calm', null, new Date(), { title: 'Breathe', mins: 2 }));
  await menu(page, 'Friends');
  await expect(page.getByRole('heading', { name: 'Friends' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'How Drill handles your data' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Delete my data' }).click();
  await expect(page.getByText('Sync is off on this device')).toBeVisible();
  expect(calls).toEqual([]);
});

test('pair a second device, see progress arrive, make a friend, cheer, then delete my data', async ({ browser }) => {
  // Device A: a lesson and a Calm session done, then sync on and a pairing code shown.
  let progressA = finishSession(emptyProgress(), `chess:${first.id}`, first.items.map((i) => ({ key: `chess:${i.id}`, correct: true })), new Date(), { title: first.title, mins: 3 });
  progressA = finishPractice(progressA, 'calm', null, new Date(), { title: 'Breathe', mins: 2 });
  const a = await device(browser);
  await open(a, progressA);
  await menu(a, 'Use on another device');
  await a.getByRole('button', { name: 'Show a code' }).click();
  const code = (await a.locator('.pair .code').textContent()).replace(/\s/g, '');
  expect(code).toMatch(/^\d{6}$/);

  // Device B: something of its own, then the code. No button to press: six digits link it.
  const b = await device(browser);
  await open(b, finishPractice(emptyProgress(), 'reflect', null, new Date(), { title: 'Three lines', mins: 1 }));
  await menu(b, 'Use on another device');
  await b.getByRole('button', { name: 'Enter a code' }).click();
  await b.getByRole('textbox', { name: 'Code from your other device' }).fill(code);
  await expect(b.getByRole('heading', { name: 'This device is linked' })).toBeVisible();
  await expect(b.getByText('1 lesson done')).toBeVisible();
  const onB = await stored(b);
  expect(onB.done[`chess:${first.id}`]).toBe(true);
  expect(onB.habits.calm.count).toBe(1);
  expect(onB.habits.reflect.count).toBe(1, 'B keeps its own session too');
  await b.getByRole('button', { name: 'Back' }).click();
  await b.getByRole('button', { name: 'Back' }).click();
  await expect(b.getByRole('button', { name: 'Calm, 1-day streak' })).toBeVisible();
  // Both devices share a recovery code.
  await menu(b, 'Recovery code');
  const recovery = await b.locator('.code.recovery').textContent();
  expect(JSON.parse(await a.evaluate(() => localStorage.getItem('drill.sync'))).recovery).toBe(recovery);

  // A third person, C, turns sync on from Friends and gives A their code.
  const c = await device(browser);
  await open(c);
  await menu(c, 'Friends');
  await c.getByRole('button', { name: 'Turn on sync' }).click();
  const codeC = (await c.locator('.friend-code').textContent()).trim();
  expect(codeC).toMatch(/^[A-Z2-9]{8}$/);
  await expect(c.getByText('No friends here yet')).toBeVisible();

  await a.getByRole('button', { name: 'Back' }).click();
  await a.getByRole('button', { name: 'Friends' }).click();
  // A picks a name: presets only.
  await a.getByText('Change your name and animal').click();
  await a.getByRole('button', { name: 'Steady', exact: true }).click();
  await a.getByRole('button', { name: 'Otter', exact: true }).click();
  await expect(a.locator('.me')).toHaveText(/Steady Otter/);
  await a.getByRole('textbox', { name: 'Add a friend: their code' }).fill(codeC.toLowerCase());
  await expect(a.getByText("Asked. You're friends once they accept")).toBeVisible();

  await c.getByRole('button', { name: 'Back' }).click();
  await c.getByRole('button', { name: 'Friends' }).click();
  await expect(c.getByText('Steady Otter would like to be friends')).toBeVisible();
  await c.getByRole('button', { name: 'Accept' }).click();
  await expect(c.locator('.friend')).toContainText('Steady Otter');
  await expect(c.locator('.friend')).toContainText('1-day streak · 1 lesson');

  // A cheers C, once today.
  await a.getByRole('button', { name: 'Back' }).click();
  await a.getByRole('button', { name: 'Friends' }).click();
  await a.getByRole('button', { name: '🌱 Growing together' }).click();
  await expect(a.getByText('Cheered today')).toBeVisible();
  await c.getByRole('button', { name: 'Back' }).click();
  await c.getByRole('button', { name: 'Friends' }).click();
  await expect(c.locator('.cheers')).toContainText('Steady Otter 🌱 Growing together');

  // A deletes its data: the server forgets the profile; A's progress stays on A.
  await a.getByRole('button', { name: 'Back' }).click();
  await a.getByRole('button', { name: 'Delete my data' }).click();
  await a.getByRole('button', { name: 'Delete it' }).click();
  await expect(a.getByRole('heading', { name: 'Deleted' })).toBeVisible();
  expect(await a.evaluate(() => localStorage.getItem('drill.sync'))).toBeNull();
  expect((await stored(a)).done[`chess:${first.id}`]).toBe(true);
  expect(await worker.db.prepare('SELECT COUNT(*) AS n FROM profiles').first('n')).toBe(1, 'only C is left');
  await c.getByRole('button', { name: 'Back' }).click();
  await c.getByRole('button', { name: 'Friends' }).click();
  await expect(c.getByText('No friends here yet')).toBeVisible();
  await expect(c.locator('.cheers')).toHaveCount(0);
});
