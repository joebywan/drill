// What the intro picks is what home shows, and a course that follows another (decision 26), with real taps, on a normal
// phone and a short one (FOLLOW_SMALL, default 1080x1700, a 412x533 page): a first visit picking only Calm and Move, one
// picking only TypeScript, one skipping; home after each. Then TypeScript's tab before any JavaScript, after "I know
// JavaScript: start here", and after the JavaScript it needs.
import { emptyProgress } from '../../src/progress.js';
import { subjects } from '../../src/subjects.js';
import { onShortPhone } from './lib/chess.js';
import { lessons } from './lib/seed.js';

const ts = subjects.find((s) => s.id === 'typescript');

export default async (h) => {
  const { page, touch, btn, shot, check, fresh, seed } = h;
  const tabs = async () => (await page.locator('.path-tab[data-path]').evaluateAll((t) => t.map((x) => x.dataset.path))).join(',');
  const row = async () => (await page.locator('[data-course]').evaluateAll((t) => t.map((x) => x.dataset.course))).join(',');
  const pick = (name) => page.getByRole('button', { name, exact: true });
  const onScreen = async (loc) => { const b = await loc.boundingBox(); return !!b && b.y >= 0 && b.x >= 0 && b.x + b.width <= await page.evaluate(() => innerWidth) + 1 && b.y + b.height <= await page.evaluate(() => innerHeight) + 1; };
  const play = async (tag) => {
    console.log(`  ${tag}: page ${await page.evaluate(() => `${innerWidth}x${innerHeight}`)}`);
    await fresh();
    await touch(btn('Next')); await shot(`${tag}-want`);
    await touch(pick('Build habits'));
    await touch(pick('Calm')); await touch(pick('Move')); await shot(`${tag}-picked-calm-move`);
    await touch(btn('Show my home')); await shot(`${tag}-home-calm-move`);
    check(`${tag}: only Calm and Move on home`, await tabs() === 'calm,move', await tabs());
    check(`${tag}: + Habit on screen without a swipe`, await onScreen(btn('Add a habit')));
    await touch(btn('Add a habit')); await shot(`${tag}-add-habit`);
    check(`${tag}: the others are one tap away`, await page.locator('[data-track="reflect"], [data-track="learn"]').count() === 2);
    await touch(btn('Back'));

    await fresh();
    await touch(btn('Next')); await touch(pick('Learn something'));
    await page.evaluate(() => document.querySelector('[data-pick="typescript"]').scrollIntoView({ block: 'center' }));
    await touch(pick('TypeScript')); await shot(`${tag}-picked-typescript`);
    check(`${tag}: TypeScript brings JavaScript, and says so`, await pick('JavaScript').getAttribute('aria-pressed') === 'true'
      && await page.getByText('JavaScript comes first, so it is picked too.').isVisible());
    await touch(btn('Show my home')); await shot(`${tag}-home-typescript`);
    check(`${tag}: Learning alone, with JavaScript and TypeScript`, await tabs() === 'learn' && await row() === 'javascript,typescript', `${await tabs()} / ${await row()}`);
    await touch(page.locator('[data-course="typescript"]')); await shot(`${tag}-ts-before-javascript`);
    check(`${tag}: TypeScript offers JavaScript first, and a start here`, await onScreen(btn('Start JavaScript')) && await onScreen(btn('I know JavaScript: start here'))
      && !(await page.locator('.path .node').count()));
    await touch(btn('I know JavaScript: start here')); await shot(`${tag}-ts-start-here`);
    check(`${tag}: its path opens at its start`, await btn(`Continue · ${ts.units[0].lessons[0].title}`).isVisible());

    await seed(lessons({ ...emptyProgress(), picked: ['learn'] }, 'javascript', (_, units) => units.slice(0, ts.follows.units).flatMap((u) => u.lessons)));
    await shot(`${tag}-ts-after-javascript`);
    check(`${tag}: after the JavaScript it needs, TypeScript is simply open`, await btn(`Continue · ${ts.units[0].lessons[0].title}`).isVisible()
      && !(await btn('Start JavaScript').count()));

    await fresh();
    await touch(btn('Skip')); await shot(`${tag}-home-skipped`);
    check(`${tag}: a skip shows everything`, (await tabs()).split(',').length === 7 && (await row()).split(',').length === 7, `${await tabs()} / ${await row()}`);
  };
  await play('normal');
  await onShortPhone(h, process.env.FOLLOW_SMALL ?? '1080x1700', () => play('short'));
};
