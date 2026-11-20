import { test, expect } from './fixtures.js';
import { chipsOf, optionsOf, vary, wayOf } from '../../src/code/items.js';
import { chipName } from '../../src/code/exercise.js';
import javascript from '../../src/code/courses/javascript.js';
import typescript from '../../src/code/courses/typescript.js';
import testing from '../../src/code/courses/testing.js';

const COURSES = [javascript, typescript, testing];
const itemsOf = (c) => c.units.flatMap((u) => u.lessons.flatMap((l) => l.items));
const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });
const wordsFor = (item) => (item.type === 'gap' ? item.fill : chipsOf(wayOf(item), item.chunks));
const chip = (page, word) => page.locator('.tiles').getByRole('button', { name: chipName(word), exact: true });

/** Answers an item right, the way a thumb would. */
async function solve(page, item) {
  if (item.type === 'build' || item.type === 'gap') {
    for (const w of wordsFor(item)) await chip(page, w).click();
    await page.getByRole('button', { name: 'Run', exact: true }).click();
  }
  if (item.type === 'predict') {
    const { answer } = optionsOf(item);
    const texts = await page.locator('.choices .choice').allTextContents(); // exact: "one two" is not "one\ntwo"
    await page.locator('.choices .choice').nth(texts.indexOf(answer)).click();
  }
  await expect(continueButton(page), item.id).toBeInViewport({ timeout: 15000 });
}

// The widest font a phone is likely to fall back to, as the Coding fit test has it, at both layouts' sizes.
for (const [width, height] of [[360, 582], [360, 640], [375, 812]]) test(`every code item fits a ${width}x${height} phone`, async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.addStyleTag({ content: 'body, button { font-family: "DejaVu Sans", Verdana, sans-serif; } :root { --mono: "DejaVu Sans Mono", monospace; }' });
  const all = COURSES.flatMap(itemsOf);
  let seed = 11;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Shipped items, and a fresh version of each: new names can run longer.
  const items = [...all, ...all.map((i) => vary(i, random)).filter(Boolean)];
  const bad = await page.evaluate(async (items) => {
    const { mount } = await import('/src/code/exercise.js');
    const { chipsOf, wayOf } = await import('/src/code/items.js');
    const app = document.getElementById('app');
    const out = [];
    for (const item of items) {
      app.innerHTML = `<header class="bar" style="height:44px"></header><main class="play"><p class="topic">Topic</p>
        <div class="coach"><button class="who"></button><p class="bubble"></p></div><div class="stage"></div></main>`;
      const bubble = app.querySelector('.bubble');
      const stop = mount(app.querySelector('.stage'), item, { say(t) { bubble.textContent = t; }, done() {} });
      const note = (why) => out.push(`${item.id}: ${why}`);
      const tiles = app.querySelector('.tiles');
      if (tiles) {
        const rect = tiles.getBoundingClientRect();
        if (rect.bottom > innerHeight + 1) note('the tray runs off the screen');
        if (tiles.querySelector('.run').getBoundingClientRect().bottom > innerHeight + 1) note('Run is off the screen');
        for (const c of tiles.querySelectorAll('[data-chip]')) if (c.getBoundingClientRect().height < 40 || c.scrollWidth > c.clientWidth + 1) note(`chip ${c.textContent} is cramped`);
        const words = item.type === 'gap' ? item.fill : chipsOf(wayOf(item), item.chunks);
        for (const w of words) [...tiles.querySelectorAll('[data-chip]')].find((c) => c.textContent === w).click();
        const prog = app.querySelector('.program');
        const roof = tiles.getBoundingClientRect().top;
        const r = prog.getBoundingClientRect();
        if (r.bottom > roof + 1) note(`the answer runs under the tray: ${Math.round(r.bottom)} over ${Math.round(roof)}`);
        if (r.height < 44) note(`only ${Math.round(r.height)}px for the answer`);
        if (prog.scrollWidth > prog.clientWidth + 1) note('the answer scrolls sideways');
        for (const b of prog.querySelectorAll('button:not(.slot)')) if (b.getBoundingClientRect().height < 26) note('a placed word is under 26px');
      }
      const given = app.querySelector('.code-given');
      if (given && tiles && given.getBoundingClientRect().bottom > tiles.getBoundingClientRect().top) note('the given code runs under the tray');
      const choices = app.querySelector('.quiz .choices');
      if (choices?.children.length) {
        const c = choices.getBoundingClientRect();
        const card = app.querySelector('.quiz .card');
        if (c.bottom > innerHeight + 1) note('the answers run off the screen');
        if (card && card.getBoundingClientRect().height && card.getBoundingClientRect().bottom > c.top + 1) note(`the code runs under the answers: ${Math.round(card.getBoundingClientRect().bottom)} over ${Math.round(c.top)}`);
        for (const b of choices.children) if (b.getBoundingClientRect().height < 44) note('an answer is under 44px');
      }
      const reserved = parseFloat(getComputedStyle(bubble).minHeight);
      if (item.prompt && bubble.offsetHeight > reserved + 1) note(`the prompt outgrows the bubble: ${bubble.offsetHeight} over ${reserved}`);
      if (document.documentElement.scrollWidth > innerWidth) note(`sideways ${document.documentElement.scrollWidth - innerWidth}`);
      stop?.();
    }
    return out;
  }, items);
  expect(bad).toEqual([]);
});

test('at 412x786, what a Run printed shows next to what it should print, clear of the verdict', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 412, height: 786 });
  const all = typescript.units.flatMap((u) => u.lessons);
  const lesson = all.find((l) => l.id === 'tsi-2');
  const unit = typescript.units.find((u) => u.lessons.includes(lesson));
  await page.goto('/');
  await page.evaluate(([start, done]) => {
    localStorage.setItem('wingbeat.course', 'typescript');
    localStorage.setItem('wingbeat.progress', JSON.stringify({ ...JSON.parse(localStorage.getItem('wingbeat.progress') || '{}'), version: 3, picked: [], done, cards: {}, habits: {}, log: [], start: { typescript: start } }));
  }, [unit.title, Object.fromEntries(unit.lessons.slice(0, unit.lessons.indexOf(lesson)).map((l) => [`typescript:${l.id}`, true]))]);
  await page.reload();
  await page.getByRole('button', { name: `Continue · ${lesson.title}` }).click();
  const box = (sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left }; });
  let printed = 0;
  for (const item of lesson.items) {
    await solve(page, item);
    if (item.goal === 'print') {
      printed++;
      const [want, got, foot] = [await box('.code-goal code'), await box('.code-out'), await box('.foot')];
      expect(got.bottom, `${item.id}: the verdict covers what it printed`).toBeLessThanOrEqual(foot.top);
      expect(got.top - want.bottom, `${item.id}: what it printed sits right under what it should print`).toBeLessThan(10);
      expect(Math.abs(got.left - want.left), `${item.id}: the two line up`).toBeLessThan(1);
      await expect(page.locator('.code-out')).toHaveText(await page.locator('.code-goal code').textContent());
    }
    await continueButton(page).click();
  }
  expect(printed).toBeGreaterThan(0);
});

test('the Test writing tray never shows a chip cut in half above Run', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 786 });
  await page.goto('/');
  await page.addStyleTag({ content: ':root { --mono: "DejaVu Sans Mono", monospace; }' });
  const item = itemsOf(testing).find((i) => i.id === 'tb-2-4');
  const bad = await page.evaluate(async (item) => {
    const { mount } = await import('/src/code/exercise.js');
    const app = document.getElementById('app');
    const out = [];
    let seed = 7;
    const random = Math.random;
    for (let n = 0; n < 12; n++) { // the tray is shuffled: some orders take more rows than others
      Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      app.innerHTML = `<header class="bar" style="height:44px"></header><main class="play"><p class="topic">Topic</p>
        <div class="coach"><button class="who"></button><p class="bubble"></p></div><div class="stage"></div></main>`;
      const stop = mount(app.querySelector('.stage'), item, { say(t) { app.querySelector('.bubble').textContent = t; }, done() {} });
      Math.random = random;
      const chips = app.querySelector('.code-tray .chips').getBoundingClientRect();
      const run = app.querySelector('.code-tray .run').getBoundingClientRect();
      for (const c of app.querySelectorAll('.code-tray [data-chip]')) {
        const r = c.getBoundingClientRect();
        if (r.top < chips.bottom - 1 && r.bottom > chips.bottom + 1) out.push(`order ${n}: ${c.textContent} is cut in half`);
        if (r.bottom > run.top && r.top < chips.bottom) out.push(`order ${n}: ${c.textContent} runs under Run`);
      }
      stop?.();
    }
    return out;
  }, item);
  expect(bad).toEqual([]);
});

for (const [course, id] of [[javascript, 'jsv-1'], [javascript, 'jsl-1'], [javascript, 'jsf-3'], [javascript, 'jse-2'], [typescript, 'tsu-2'], [testing, 'tb-1']]) {
  test(`${course.title}: ${id} plays through as a real session`, async ({ page }) => {
    test.setTimeout(120000);
    const all = course.units.flatMap((u) => u.lessons);
    const lesson = all.find((l) => l.id === id);
    const unit = course.units.find((u) => u.lessons.includes(lesson));
    await page.goto('/');
    await page.evaluate(([c, start, done]) => {
      localStorage.setItem('wingbeat.course', c);
      localStorage.setItem('wingbeat.progress', JSON.stringify({ ...JSON.parse(localStorage.getItem('wingbeat.progress') || '{}'), version: 3, picked: [], done, cards: {}, habits: {}, log: [], start: { [c]: start } }));
    }, [course.id, unit.title, Object.fromEntries(unit.lessons.slice(0, unit.lessons.indexOf(lesson)).map((l) => [`${course.id}:${l.id}`, true]))]);
    await page.reload();
    await page.getByRole('button', { name: `Continue · ${lesson.title}` }).click();
    for (const item of lesson.items) {
      await solve(page, item);
      await expect(page.locator('.foot.wrong'), item.id).toHaveCount(0);
      await continueButton(page).click();
    }
    await expect(page.locator('.summary')).toBeVisible();
    const marked = lesson.items.filter((i) => i.type !== 'teach').length;
    await expect(page.getByText(`${marked} of ${marked} right first try`)).toBeVisible();
  });
}
