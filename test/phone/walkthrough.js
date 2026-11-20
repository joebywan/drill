// A fresh user, start to finish, with real taps: intro → Learn (Maths) + Calm + Walk, home, one Maths
// lesson, one Calm session, Walk, the garden and the ⋯ menu. A screenshot of every screen.
import { readFileSync } from 'node:fs';
import { playMaths } from './lib/seed.js';

const first = JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url))).units[0].lessons[0];

export default async ({ page, touch, btn, swipe, shot, run, check }) => {
  const pick = (name) => page.getByRole('button', { name, exact: true });
  const dump = async (label) => console.log(`  [${label}]`, JSON.stringify(await page.evaluate(() =>
    [...document.querySelectorAll('.pane > *, .rail > *, .cta > *')].map((e) => {
      const r = e.getBoundingClientRect();
      return `${e.className || e.tagName}:${Math.round(r.top)}-${Math.round(r.bottom)} "${e.textContent.trim().replace(/\s+/g, ' ').slice(0, 70)}"`;
    }))));
  await shot('intro');
  await touch(btn('Next')); await shot('want');
  await touch(pick('Learn something'));
  await touch(pick('Maths'));
  await touch(pick('Build habits'));
  await touch(pick('Calm'));
  await touch(pick('Walk')); await shot('picked');
  await touch(btn('Show my home')); await run(1500); await shot('home'); await dump('home');

  await touch(btn(`Continue · ${first.title}`));
  await playMaths(first, { page, touch, btn, swipe, shot });
  await shot('maths-summary');
  await touch(btn('Continue')); await run(3000); await shot('home-after-maths'); await dump('after maths');

  await touch(page.locator('.path-tab[data-path="calm"]')); await run(1000); await shot('calm-home'); await dump('calm');
  await touch(btn(/^Continue · /)); await shot('calm-teach');
  await touch(btn('Start')); await run(5000); await shot('calm-breathing');
  await run(60000); await shot('calm-end');
  await touch(btn('Calmer')); await touch(btn(/^Continue/)); await run(3000); await shot('home-after-calm'); await dump('after calm');

  await touch(page.locator('.path-tab[data-path="walk"]')); await shot('walk');
  await touch(btn('I walked today')); await run(1500); await shot('walked'); await dump('walked');

  await touch(btn(/^Your garden/)); await run(1500); await shot('garden');
  await page.evaluate(() => document.querySelector('.plant-cards')?.scrollIntoView()); await shot('garden-cards');
  await touch(btn('Back'));
  await touch(btn('Settings')); await shot('menu');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400); await shot('menu-bottom');
  check('walkthrough reached the menu', true);
};
