import { test, expect } from './fixtures.js';
import { createServer } from 'node:http';
import { emptyProgress, finishPractice, finishSession } from '../../src/progress.js';
import { API } from '../../src/sync/config.js';
import { matrixOf, readQr } from '../qr-read.js';

// Sync ships dark, so these turn it on per page with DRILL_SYNC, against the real worker run locally.
let worker;
test.beforeAll(async () => {
  const { start } = await import('../../server/dev.js');
  worker = await start({ port: 0 });
});
test.afterAll(() => worker?.mf.dispose());

async function device(browser, baseURL) {
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => { window.DRILL_SYNC = true; });
  await context.route(`${API}/**`, async (route) => {
    const response = await route.fetch({ url: route.request().url().replace(API, worker.url) });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
  await page.addInitScript(() => { window.DRILL_PLAIN = true; });
  return page;
}
const seed = (page, p) => page.addInitScript((s) => { if (!localStorage.getItem('drill.progress')) localStorage.setItem('drill.progress', s); }, JSON.stringify(p));

test('a QR code sits by the pairing code; scanning opens the app with it filled in, one tap links, and the fragment is cleared', async ({ browser, baseURL }) => {
  const a = await device(browser, baseURL);
  await seed(a, finishSession(emptyProgress(), 'chess:x', [], new Date(), { title: 'Lesson', mins: 1 }));
  await a.goto('/');
  await a.getByRole('button', { name: 'Settings' }).click();
  await a.getByRole('button', { name: 'Use on another device' }).click();
  await a.getByRole('button', { name: 'Show a code' }).click();
  const code = (await a.locator('.pair .code').textContent()).replace(/\s/g, '');
  const qr = a.getByRole('img', { name: 'QR code for this pairing code' });
  const [box, digits] = await Promise.all([qr.boundingBox(), a.locator('.pair .code').boundingBox()]);
  expect(box.width).toBeGreaterThan(120);
  expect(Math.abs((box.y + box.height / 2) - (digits.y + digits.height / 2))).toBeLessThan(box.height / 2); // side by side
  const link = readQr(matrixOf(await qr.evaluate((el) => el.outerHTML))).text;
  expect(link).toBe(`${baseURL}/#pair=${code}`);

  const b = await device(browser, baseURL);
  await seed(b, finishPractice(emptyProgress(), 'reflect', null, new Date(), { title: 'Three lines', mins: 1 }));
  await b.goto(link);
  await expect(b.getByRole('heading', { name: 'Enter a code' })).toBeVisible();
  await expect(b.getByRole('textbox', { name: 'Code from your other device' })).toHaveValue(code);
  expect(await b.evaluate(() => location.href)).toBe(`${baseURL}/`);
  await expect(b.getByText('locked on this device')).toBeVisible();
  await b.getByRole('button', { name: 'Link this device' }).click();
  await expect(b.getByRole('heading', { name: 'This device is linked' })).toBeVisible();
  await expect(b.getByText('1 lesson done')).toBeVisible();
});

test('the code in the fragment reaches no server: every request a scan makes is recorded at the server', async ({ browser, baseURL }) => {
  const code = '804217';
  const seen = [];
  const proxy = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    seen.push(JSON.stringify([req.method, req.url, req.headers, body]));
    const r = await fetch(baseURL + req.url);
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') ?? 'text/plain' });
    res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise((go) => proxy.listen(0, '127.0.0.1', go));
  const origin = `http://127.0.0.1:${proxy.address().port}`;
  const page = await device(browser, origin);
  const elsewhere = [];
  page.on('request', (r) => { if (!r.url().startsWith(origin)) elsewhere.push(r.url() + (r.postData() ?? '')); });
  await page.goto(`${origin}/#pair=${code}`);
  await expect(page.getByRole('textbox', { name: 'Code from your other device' })).toHaveValue(code);
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: 'Enter a code' }).click(); // anything a click might fetch, too
  proxy.close();
  expect(seen.length).toBeGreaterThan(3);
  for (const line of seen) expect(line).not.toContain(code);
  for (const line of elsewhere) expect(line).not.toContain(code);
});

test('with the flag off a link does nothing: the app opens as usual and nothing is sent', async ({ page }) => {
  const calls = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')) calls.push(r.url()); });
  await page.goto('/#pair=123456');
  await expect(page.getByRole('heading', { name: 'Enter a code' })).toHaveCount(0);
  await expect(page.locator('#app')).not.toBeEmpty();
  expect(calls).toEqual([]);
});

test('a malformed fragment is ignored', async ({ browser, baseURL }) => {
  const page = await device(browser, baseURL);
  await page.goto('/#pair=12x<img>');
  await expect(page.getByRole('heading', { name: 'Enter a code' })).toHaveCount(0);
});
