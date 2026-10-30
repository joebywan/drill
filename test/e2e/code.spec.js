import { test, expect } from './fixtures.js';
import { chipsOf } from '../../src/code/items.js';
import { chipName } from '../../src/code/exercise.js';

const chip = (page, word) => page.locator('.tiles').getByRole('button', { name: chipName(word), exact: true });

test('a code item: chips form lines, a tap takes one out, the result moves nothing, and a miss shows one way', async ({ page }) => {
  await page.goto('/');
  const mount = (item) => page.evaluate(async (item) => {
    const { mount } = await import('/src/code/exercise.js');
    document.body.innerHTML = '<main class="play"><div class="coach"><p class="bubble" id="said"></p></div><div id="t"></div></main><p id="why"></p>';
    window.result = null;
    mount(document.getElementById('t'), item, { say(t) { document.getElementById('said').textContent = t; }, done(right, why) { window.result = right; document.getElementById('why').textContent = why; } });
  }, item);
  const result = () => page.evaluate(() => window.result);
  const item = { id: 'x', type: 'build', goal: 'print', way: 'for (let i = 0; i < 2; i++) { console.log(i); }', prompt: 'p', explain: 'e', decoys: ['--'] };
  await mount(item);
  const run = page.getByRole('button', { name: 'Run', exact: true });
  await expect(run).toBeDisabled();
  for (const w of chipsOf(item.way)) await chip(page, w).click();
  await expect(page.locator('.code-answer .line-break')).toHaveCount(2);
  await page.getByRole('button', { name: 'console.log, tap to take out' }).click();
  await chip(page, 'console.log').click(); // back in at the gap it left
  const top = await page.locator('.code-answer').evaluate((a) => a.getBoundingClientRect().top);
  await run.click();
  await expect.poll(result).toBe(true);
  await expect(page.locator('.code-out')).toHaveText('0\n1');
  expect(await page.locator('.code-answer').evaluate((a) => a.getBoundingClientRect().top)).toBe(top);

  // Any arrangement that prints the same is right: this one has no loop at all.
  const other = { ...item, way: 'console.log(0); console.log(1);' };
  await mount(other);
  for (const w of chipsOf(other.way)) await chip(page, w).click();
  await run.click();
  await expect.poll(result).toBe(true);

  // A parse error is plain words, and a miss shows the one way.
  await mount(item);
  for (const w of ['for', '(']) await chip(page, w).click();
  await run.click();
  await expect.poll(result).toBe(false);
  await expect(page.locator('#why')).toContainText('stops too early');
  await expect(page.locator('.program.shown .code')).toContainText('console.log(i);');

  // A gap: Run waits for the hole, a tap empties it, and the wrong word fails by running.
  await mount({ id: 'g', type: 'gap', goal: 'print', code: 'console.log(___);', fill: ['3'], decoys: ['4'], prompt: 'p', explain: 'e' });
  await expect(run).toBeDisabled();
  await chip(page, '4').click();
  await expect(run).toBeEnabled();
  await page.getByRole('button', { name: '4, tap to take out' }).click();
  await expect(run).toBeDisabled();
  await chip(page, '4').click();
  await run.click();
  await expect.poll(result).toBe(false);
});

test('Fennel walks what the chips say on the same grid, and a test that lets a faulty version through says which', async ({ page }) => {
  await page.goto('/');
  const mount = (item) => page.evaluate(async (item) => {
    const { mount } = await import('/src/code/exercise.js');
    document.body.innerHTML = '<main class="play"><div class="coach"><p class="bubble" id="said"></p></div><div id="t"></div></main><p id="why"></p>';
    window.result = null;
    mount(document.getElementById('t'), item, { say(t) { document.getElementById('said').textContent = t; }, done(right, why) { window.result = right; document.getElementById('why').textContent = why; } });
  }, item);
  const result = () => page.evaluate(() => window.result);
  const run = page.getByRole('button', { name: 'Run', exact: true });
  const walk = { id: 'w', type: 'build', goal: 'walk', level: ['S.*'], way: 'right(); right();', prompt: 'p', explain: 'e' };
  await mount(walk);
  await expect(page.locator('.grid-world .walker')).toHaveCount(1);
  for (const w of chipsOf(walk.way)) await chip(page, w).click();
  await run.click();
  await expect.poll(result).toBe(true);
  await expect(page.locator('.walker')).toHaveAttribute('style', /translate\(200%, 0%\)/);

  const tests = { id: 't', type: 'gap', goal: 'tests', ts: true, given: 'function add(a: number, b: number): number { return a + b; }', mutants: [{ code: 'function add(a: number, b: number): number { return a * b; }', says: 'it multiplies instead of adding.' }],
    code: 'test("adds", () => { ___; });', fill: ['expect(add(2, 3)).toBe(5)'], decoys: ['expect(add(2, 2)).toBe(4)'], prompt: 'p', explain: 'e' };
  await mount(tests);
  await expect(page.locator('.code-given')).toContainText('function add');
  await chip(page, 'expect(add(2, 2)).toBe(4)').click();
  await run.click();
  await expect.poll(result).toBe(false);
  await expect(page.locator('#why')).toContainText('it multiplies instead of adding');
});
