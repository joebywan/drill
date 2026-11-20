// Home for someone 30 days in, with four habits and two courses: the butterfly beside the streak line basking,
// flying and resting, what each path is raising, Walk's "when", the dot a quiet habit shows in place of its
// number, and the way to the wardrobe (⋯). Then a quiet habit (Calm) keeps its count off the tab, the greeting
// and the end screen until ⋯ switches it on.
import { thirtyDays } from './lib/seed.js';

export default async ({ page, seed, touch, btn, shot, run, check }) => {
  const label = () => page.locator('.yours-link').getAttribute('aria-label');
  const show = async (id) => { await touch(page.locator(`.path-tab[data-path="${id}"]`)); await page.locator(`.path-tab[data-path="${id}"][aria-pressed="true"]`).waitFor(); };
  // After a tab change on a heavy home (a 30-day garden) the emulator's screen can lag the page by a second: the DOM is
  // already Calm's at the top while a screenshot still shows the path before. Wait for the screen, not just the page.
  const top = async () => { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1500); };
  // Up to yesterday: basking. Today too: flying. Up to the day before yesterday: resting.
  for (const [state, to] of [['flying', 0], ['resting', 2], ['basking', 1]]) {
    await seed(thirtyDays(to));
    await show('calm'); await top();
    check(`home: the butterfly is ${state}`, (await label()) === `Your butterfly, ${state}`, await label());
    check(`home ${state}: Calm's own path under Calm's tab`, (await page.locator('.greeting b').textContent()) === 'Moss');
    await shot(`calm-${state}`);
  }

  // Basking, the fullest home: Calm is quiet, so a dot and no number.
  const calmTab = page.locator('.path-tab[data-path="calm"]');
  check('quiet: Calm\'s tab shows a dot, no number', (await calmTab.locator('b').textContent()) === '' && !/\d/.test(await calmTab.getAttribute('aria-label')),
    await calmTab.getAttribute('aria-label'));
  check('quiet: no count in the greeting', !/\d/.test(await page.locator('.greeting').textContent()), await page.locator('.greeting').textContent());
  check('quiet: no count on the streak line', !/\d/.test(await page.locator('.streak-line').textContent()), await page.locator('.streak-line').textContent());
  check('Calm: what it is raising', /Calm (is raising|raised)/.test(await page.locator('.raising').textContent()), await page.locator('.raising').textContent());

  await show('walk'); await top(); await shot('walk');
  check('Walk: its when on the panel', (await page.locator('.log-habit .when').textContent()) === 'After breakfast');
  check('Walk: what it is raising', await page.locator('.log-habit .raising').count() === 1);
  await show('reflect'); await top(); await shot('reflect');
  await show('move'); await top(); await shot('move');
  await show('learn'); await top(); await shot('learning');
  check('Learning: what the course is raising', /is raising/.test(await page.locator('.raising').textContent()), await page.locator('.raising').textContent());
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('learning-bottom');

  await touch(btn('Settings')); await shot('menu');
  check('the wardrobe is one tap from ⋯', await btn("Lumi's wardrobe").count() === 1);
  await touch(btn('Back'));

  // A Calm session on a quiet Calm: no streak chip on the end screen.
  await show('calm');
  await touch(btn(/^Continue · /));
  await touch(btn('Start')); await run(45000);
  await shot('calm-end');
  const end = await page.locator('main').innerText();
  check('quiet: no Calm streak chip on the end screen', !/CALM STREAK/i.test(end) && !/\b3[01]\b/.test(end), end.replace(/\s+/g, ' ').slice(0, 160));
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('calm-end-bottom');
  await touch(btn('Calmer')); await touch(btn(/^Continue/)); await top(); await shot('calm-after');
  check('quiet: still a dot after the session', (await calmTab.locator('b').textContent()) === '');
  check('quiet: no count in the greeting after the session', !/\d/.test(await page.locator('.greeting').textContent()), await page.locator('.greeting').textContent());

  // The switch on ⋯ brings the count back.
  await touch(btn('Settings'));
  await touch(page.locator('[data-pref="quiet-streaks"]')); await shot('quiet-switch');
  await touch(btn('Back')); await top();
  check('switched on: Calm\'s tab has its number', /\d/.test(await calmTab.locator('b').textContent()), await calmTab.getAttribute('aria-label'));
  await shot('calm-counted');
};
