import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { answer, kind, starPath } from '../../src/chess/items.js';
import { emptyProgress, finishPractice, finishSession } from '../../src/progress.js';
import { award } from '../../src/garden/model.js';

// The first lesson on the path. Its answers are worked out from the course data with the same
// item logic the app uses, so the test follows the content when it changes.
const basics = JSON.parse(readFileSync(new URL('../../src/data/basics.json', import.meta.url)));
const calmCourse = JSON.parse(readFileSync(new URL('../../src/data/calm.json', import.meta.url)));
const first = basics.units[0].lessons[0];

// Board squares are SVG with no accessible name, so they're found by cm-chessboard's data-square.
async function tap(page, square) {
  const box = await page.locator(`.board rect[data-square="${square}"]`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Plays a move by tapping the piece, then where it goes; waits for the last move to land first. */
async function play(page, { from, to }) {
  await expect(page.locator(`.board g[data-piece][data-square="${from}"]`)).toBeVisible();
  await tap(page, from);
  await tap(page, to);
}

/** A habit's tab on home: "Calm", or "Calm, 3-day streak" once it has had a session. */
const tab = (page, name) => page.getByRole('button', { name: new RegExp(`^${name}(, \\d+-day streak)?$`) });
/** The line over the path that opens the shown habit's view. */
const week = (page, n) => page.getByRole('button', { name: `${n}-day streak · See your week` });

const continueButton = (page) => page.getByRole('button', { name: 'Continue', exact: true });

/** Answers one item correctly, then waits for the answer banner. */
async function solve(page, item) {
  switch (kind(item)) {
    case 'teach': break;
    case 'tap': for (const sq of answer(item)) await tap(page, sq); break;
    case 'stars': for (const m of starPath(item)) await play(page, m); break;
    default: throw new Error(`the e2e test can't play a ${kind(item)} item yet`);
  }
  await expect(continueButton(page), item.id).toBeInViewport();
}

/** Opens home. A first visit starts on the intro, which is skipped here (its own tests are below). */
async function firstVisit(page) {
  await page.goto('/');
  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await skip.click();
}

async function finishFirstLesson(page) {
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  for (const item of first.items) {
    await solve(page, item);
    await continueButton(page).click();
  }
}

const offer = (page) => page.getByRole('button', { name: 'Know some chess already? Skip ahead' });

// The first-visit intro: what Drill does, then what you'd like out of it; home puts that first.
const tabOrder = (page) => page.locator('.path-tab[data-path]').evaluateAll((tabs) => tabs.map((t) => t.dataset.path));
const pressedTab = (page) => page.locator('.path-tab[aria-pressed="true"]');
const pick = (page, name) => page.getByRole('button', { name, exact: true });

async function toStepTwo(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What can Drill do for you?' })).toBeFocused();
  for (const text of ['Calm: slow breathing', 'Track: one tap', 'nothing ever wilts', 'Everything stays on this device'])
    await expect(page.getByText(text)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'What would you like out of Drill?' })).toBeFocused();
}

test('intro, learn only: Learn something lists the live courses, the others are coming soon, and home starts on Learning', async ({ page }) => {
  await toStepTwo(page);
  await expect(pick(page, 'Chess')).toBeHidden();
  await pick(page, 'Learn something').click();
  await expect(pick(page, 'Learn something')).toHaveAttribute('aria-pressed', 'true');
  await expect(pick(page, 'Japanese')).toBeEnabled(); // live
  await pick(page, 'Chess').click();
  await expect(pick(page, 'Chess')).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Maths', 'Coding']) await expect(page.getByRole('button', { name: `${name} · coming soon` })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Have you played chess before?' })).toHaveCount(0); // no placement questions
  await page.getByRole('button', { name: 'Show my home' }).click();
  await expect(pressedTab(page)).toHaveAttribute('data-path', 'learn');
  expect((await tabOrder(page))[0]).toBe('learn');
  await expect(page.getByText('Learning is first. Start with the button below.')).toBeVisible();
  await expect(offer(page)).toBeVisible(); // the placement offer is still there, as it was
  await expect(page.locator('.cta .next')).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What can Drill do for you?' })).toHaveCount(0);
});

test('intro, habits only: the picks come first in the order tapped, and a tracker is switched on', async ({ page }) => {
  await toStepTwo(page);
  await pick(page, 'Build habits').click();
  await pick(page, 'Walk').click();
  await pick(page, 'Calm').click();
  await pick(page, 'Read').click();
  await pick(page, 'Read').click(); // changed my mind
  await expect(pick(page, 'Read')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Show my home' }).click();
  expect(await tabOrder(page)).toEqual(['walk', 'calm', 'learn', 'break', 'reflect', 'move', 'winddown', 'focus']);
  await expect(pressedTab(page)).toHaveAttribute('data-path', 'walk');
  await expect(page.getByText('Walk is first. Start with the button below.')).toBeVisible();
  await page.getByRole('button', { name: 'I walked today' }).click();
  await expect(tab(page, 'Walk')).toHaveAccessibleName('Walk, 1-day streak');
  await page.reload();
  expect(await tabOrder(page)).toEqual(['walk', 'calm', 'learn', 'break', 'reflect', 'move', 'winddown', 'focus']);
});

test("intro, skipped at either step: today's default home, and the intro never comes back", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText("Hi, I'm Lumi. Pick something to grow")).toBeVisible();
  expect(await tabOrder(page)).toEqual(['learn', 'calm', 'break', 'reflect', 'move', 'winddown', 'focus']);
  await page.reload();
  await expect(page.getByText("Hi, I'm Lumi. Pick something to grow")).toBeVisible();

  await page.evaluate(() => localStorage.clear());
  await toStepTwo(page);
  await pick(page, 'Build habits').click();
  await pick(page, 'Move').click();
  await page.getByRole('button', { name: 'Skip' }).click(); // a skip drops what was tapped
  expect(await tabOrder(page)).toEqual(['learn', 'calm', 'break', 'reflect', 'move', 'winddown', 'focus']);
  await expect(pressedTab(page)).toHaveAttribute('data-path', 'learn');
});

for (const [width, height] of [[360, 640], [412, 800], [412, 915]]) {
  test(`intro at ${width}x${height}: the last line scrolls fully clear of the button bar`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const last = page.getByText('Everything stays on this device');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const line = await last.boundingBox();
    const bar = await page.locator('.cta').boundingBox();
    const next = await page.getByRole('button', { name: 'Next' }).boundingBox();
    expect(line.y + line.height).toBeLessThanOrEqual(bar.y);
    expect(line.y + line.height).toBeLessThanOrEqual(next.y);
    expect(await page.locator('.cta').evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none'); // solid, nothing shows through
  });
}

test('someone who used Drill before the intro existed never sees it', async ({ page }) => {
  const v6 = { version: 6, habits: { learn: { count: 0, last: null, forgiven: [], days: 0 } }, log: [], done: {}, cards: {},
    journal: {}, garden: { earned: {} }, tracked: [], start: { chess: null } };
  await page.addInitScript((p) => localStorage.setItem('drill.progress', p), JSON.stringify(v6));
  await page.goto('/');
  await expect(tab(page, 'Learning')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What can Drill do for you?' })).toHaveCount(0);
});

test('"Change what you see" in the ⋯ menu reopens step 2 with the picks, and Back changes nothing', async ({ page }) => {
  await toStepTwo(page);
  await pick(page, 'Build habits').click();
  await pick(page, 'Calm').click();
  await page.getByRole('button', { name: 'Show my home' }).click();
  await page.getByRole('button', { name: 'Your progress' }).click();
  await page.getByRole('button', { name: 'Change what you see' }).click();
  await expect(page.getByRole('heading', { name: 'What would you like out of Drill?' })).toBeFocused();
  await expect(pick(page, 'Calm')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back' }).click();
  expect((await tabOrder(page))[0]).toBe('calm');

  await page.getByRole('button', { name: 'Your progress' }).click();
  await page.getByRole('button', { name: 'Change what you see' }).click();
  await pick(page, 'Calm').click();
  await pick(page, 'Screen break').click();
  await pick(page, 'Learn something').click();
  await page.getByRole('button', { name: 'Show my home' }).click();
  expect(await tabOrder(page)).toEqual(['break', 'learn', 'calm', 'reflect', 'move', 'winddown', 'focus']);
  await expect(pressedTab(page)).toHaveAttribute('data-path', 'break');
});

test('skipping the intro lands on home with a welcome and no questions; Learning starts straight in', async ({ page }) => {
  await firstVisit(page);
  await expect(page.getByText("Hi, I'm Lumi. Pick something to grow")).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Have you played chess before?' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /streak/ })).toHaveCount(0); // no streak line before a first session
  await expect(page.getByRole('heading', { name: basics.units[0].title })).toBeVisible();
  await expect(offer(page)).toBeVisible();
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  await expect(page.locator('div.board')).toBeVisible();
  await expect(page.locator('.survey')).toHaveCount(0);
});

test('Calm never offers or asks a placement question', async ({ page }) => {
  await firstVisit(page);
  await tab(page, 'Calm').click();
  await expect(page.getByRole('heading', { name: 'Breathing' })).toBeVisible();
  await expect(offer(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue · The long out-breath' }).click();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect(page.locator('.survey')).toHaveCount(0);
});

test('the skip-ahead offer is optional: taking it starts the path further on, and it never comes back', async ({ page }) => {
  await firstVisit(page);
  await offer(page).click();
  await expect(page.getByRole('heading', { name: 'Have you played chess before?' })).toBeFocused();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(offer(page)).toBeVisible(); // backing out changes nothing
  await offer(page).click();
  await page.getByRole('button', { name: 'I play now and then' }).click();
  await page.getByRole('button', { name: 'Start at Forks' }).click();
  await expect(page.locator('.cta .next')).toBeFocused();
  await expect(page.locator('.cta .next')).toHaveText(/^Continue · /);
  await expect(page.locator('.street', { has: page.getByRole('heading', { name: 'Forks' }) }).locator('.here')).toHaveCount(1);
  await expect(offer(page)).toHaveCount(0);
  await page.reload();
  await expect(offer(page)).toHaveCount(0);
  await expect(page.locator('.street', { has: page.getByRole('heading', { name: 'Forks' }) }).locator('.here')).toHaveCount(1);
});

test('the skip-ahead offer stops once the first unit is finished', async ({ page }) => {
  const done = Object.fromEntries(basics.units[0].lessons.map((l) => [`chess:${l.id}`, true]));
  await page.addInitScript((p) => localStorage.setItem('drill.progress', p), JSON.stringify({ ...emptyProgress(), done }));
  await firstVisit(page);
  await expect(page.getByRole('heading', { name: basics.units[0].title })).toBeVisible();
  await expect(offer(page)).toHaveCount(0);
});

test('dismissing the skip-ahead offer hides it for good', async ({ page }) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(offer(page)).toHaveCount(0);
  await page.reload();
  await expect(offer(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Continue · ${first.title}` })).toBeVisible();
});

test('finishing the first lesson shows the summary, starts the streak, and survives a reload', async ({ page }) => {
  await firstVisit(page);
  await expect(tab(page, 'Learning')).toHaveAccessibleName('Learning');
  await finishFirstLesson(page);

  const marked = first.items.filter((i) => kind(i) !== 'teach').length;
  await expect(page.getByText(`${marked} of ${marked} right first try`)).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await continueButton(page).click();

  const streak = tab(page, 'Learning');
  await expect(streak).toHaveAccessibleName('Learning, 1-day streak');
  await expect(streak.locator('b')).toHaveText('1');
  await expect(page.getByRole('button', { name: `${first.title}, done` })).toBeVisible();

  await page.reload();
  await expect(streak).toHaveAccessibleName('Learning, 1-day streak');
  await expect(page.getByRole('button', { name: `${first.title}, done` })).toBeVisible();
});

test('the "5 in a row" flare plays, then leaves nothing behind', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); // the flare only plays with motion on
  await firstVisit(page);
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  const flare = page.locator('.flare');
  const marked = first.items.filter((i) => kind(i) !== 'teach');
  for (const item of first.items.slice(0, first.items.indexOf(marked[4]) + 1)) {
    await expect(flare).toBeHidden(); // Playwright counts opacity 0 as visible; a ghost would fail here
    await solve(page, item);
    if (item !== marked[4]) await continueButton(page).click();
  }
  await expect(flare).toHaveText('5 in a row');
  await expect(flare).toBeVisible();
  await expect(flare).toBeHidden({ timeout: 3000 });
});

/** Home with the board unit done, then "Rook and bishop" played through: Lumi's next step is in the same unit. */
async function rookAndBishop(page, during = async () => {}) {
  const lesson = basics.units[1].lessons[0];
  await page.addInitScript((p) => { if (!localStorage.getItem('drill.progress')) localStorage.setItem('drill.progress', p); },
    JSON.stringify({ ...emptyProgress(), done: { [`chess:${basics.units[0].lessons[0].id}`]: true } }));
  await firstVisit(page);
  await page.getByRole('button', { name: `Continue · ${lesson.title}` }).click();
  for (const [i, item] of lesson.items.entries()) {
    if (item.demo) await expect(page.locator('#said')).not.toHaveText(item.intro, { timeout: 10000 }); // the piece's demo first
    await solve(page, item);
    if (!i) await during();
    await continueButton(page).click();
  }
}

test('lessons feel alive: answers pop, petals fall, and the path fills to the next node', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await rookAndBishop(page, async () => {
    // The verdict pops (scale up and back), and Continue takes the tap while it plays.
    expect(await page.evaluate(() => document.getAnimations().some((a) => a.effect.getKeyframes().some((k) => k.transform === 'scale(1.12)')))).toBe(true);
  });
  await expect(page.locator('.petals i.petal').first()).toBeAttached();
  await expect(page.locator('.petals i.leaf').first()).toBeAttached();
  await continueButton(page).click();
  await expect(page.locator('.petals')).toHaveCount(0); // leaving the summary stops them
  // The stretch from the lesson just done to the next node is its own path, filling as Lumi hops.
  const fresh = page.locator('.trail .fresh');
  await expect(fresh).toHaveCount(1);
  expect(await fresh.evaluate((el) => el.getAnimations().length)).toBe(1);
  await expect.poll(() => fresh.evaluate((el) => el.getAnimations().length), { timeout: 3000 }).toBe(0);
  await expect(page.getByRole('button', { name: `${basics.units[1].lessons[1].title}, current` })).toBeVisible();
});

test('a wrong answer gives a small shake, never in the way', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await firstVisit(page);
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  const tapItem = first.items.find((i) => kind(i) === 'tap');
  for (const item of first.items.slice(0, first.items.indexOf(tapItem))) { await solve(page, item); await continueButton(page).click(); }
  const right = new Set(answer(tapItem));
  await tap(page, ['a1', 'h8', 'd4', 'e5', 'b2'].find((sq) => !right.has(sq)));
  await expect(page.locator('.foot.wrong')).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().some((a) => a.effect.getKeyframes().some((k) => k.transform === 'translateX(-6px)')))).toBe(true);
  await continueButton(page).click();
});

test('under reduced motion, feedback is still and the path is simply drawn, but the cues still sound', async ({ page }) => {
  // Counts the notes the lesson plays: reduced motion skips motion, never sound.
  await page.addInitScript(() => {
    window.notes = 0;
    const make = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () { window.notes++; return make.call(this); };
  });
  let heard = 0;
  await rookAndBishop(page, async () => { heard = await page.evaluate(() => window.notes); });
  expect(heard, 'the right-answer cue').toBeGreaterThan(0);
  expect(await page.evaluate(() => window.notes), 'more cues, up to lesson complete').toBeGreaterThan(heard);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.petals')).toHaveCount(0);
  await continueButton(page).click();
  await expect(page.locator('.trail .fresh')).toHaveCount(1);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

// Japanese: a second course on the Learning tab, played with the tap-and-match items in src/quiz/.
const japanese = JSON.parse(readFileSync(new URL('../../src/data/japanese.json', import.meta.url)));
const kanaFirst = japanese.units[0].lessons[0];
const quizChoice = (page, text) => page.locator('.quiz .choices .choice:not(:disabled)', { hasText: new RegExp(`^${text}$`) }).first();

/** Answers one quiz item correctly by tapping, then waits for the answer banner. */
async function solveQuiz(page, item) {
  if (item.type === 'pick') await quizChoice(page, item.answer).click();
  if (item.type === 'pairs') for (const [l, r] of item.pairs) { await quizChoice(page, l).click(); await quizChoice(page, r).click(); }
  if (item.type === 'build') for (const t of item.answer) await quizChoice(page, t).click();
  await expect(continueButton(page), item.id).toBeInViewport();
}

async function toJapanese(page) {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Japanese', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Japanese', exact: true })).toHaveAttribute('aria-pressed', 'true');
}

test('intro: picking Japanese opens Learning on the Japanese path', async ({ page }) => {
  await toStepTwo(page);
  await pick(page, 'Learn something').click();
  await pick(page, 'Japanese').click();
  await page.getByRole('button', { name: 'Show my home' }).click();
  await expect(pressedTab(page)).toHaveAttribute('data-path', 'learn');
  await expect(page.getByRole('heading', { name: 'Vowels' })).toBeVisible();
  await expect(page.getByRole('button', { name: `Continue · ${kanaFirst.title}` })).toBeVisible();
});

test('a full Japanese lesson: teach, pick, listen, pairs; Kaede ends it, and the course is remembered', async ({ page }) => {
  await toJapanese(page);
  await expect(page.getByRole('heading', { name: 'Vowels' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Know some chess already? Skip ahead' })).toHaveCount(0);
  await page.getByRole('button', { name: `Continue · ${kanaFirst.title}` }).click();
  await expect(page.locator('.quiz .glyph')).toHaveText('あ');
  await expect(page.locator('.quiz')).toHaveAttribute('lang', 'ja-JP');
  await expect(page.locator('.who svg')).toHaveClass(/cast-kaede/);
  for (const item of kanaFirst.items) {
    // No voice in headless Chromium: a listening item shows its reading instead, and still plays.
    if (item.listen) await expect(page.locator('.quiz .glyph')).toHaveText(item.show);
    await solveQuiz(page, item);
    await continueButton(page).click();
  }
  const marked = kanaFirst.items.filter((i) => i.type !== 'teach').length;
  await expect(page.getByText(`${marked} of ${marked} right first try`)).toBeVisible();
  await expect(page.locator('.duo .hero svg').first()).toHaveClass(/cast-kaede/);
  await continueButton(page).click();
  await expect(page.getByRole('button', { name: `${kanaFirst.title}, done` })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Japanese', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Chess', exact: true }).click();
  await expect(page.getByRole('heading', { name: basics.units[0].title })).toBeVisible();
});

test('a wrong tap is judged at once, comes back at the end, and a mismatched pair flashes and lets go', async ({ page }) => {
  await toJapanese(page);
  await page.getByRole('button', { name: `Continue · ${kanaFirst.title}` }).click();
  const [pickItem] = kanaFirst.items.filter((i) => i.type === 'pick');
  for (const item of kanaFirst.items.slice(0, kanaFirst.items.indexOf(pickItem))) { await solveQuiz(page, item); await continueButton(page).click(); }
  await quizChoice(page, pickItem.options.find((o) => o !== pickItem.answer)).click();
  await expect(page.locator('.foot.wrong')).toBeVisible();
  await expect(page.locator('.quiz .choice.right')).toHaveText(pickItem.answer);
  await continueButton(page).click();
  for (const item of kanaFirst.items.slice(kanaFirst.items.indexOf(pickItem) + 1)) {
    if (item.type === 'pairs') {
      const [[l1], [, r2]] = item.pairs;
      await quizChoice(page, l1).click();
      await quizChoice(page, r2).click();
      await expect(page.locator('.quiz .choice.wrong')).toHaveCount(2);
      await expect(page.locator('.quiz .choice.wrong')).toHaveCount(0); // lets go
    }
    await solveQuiz(page, item);
    await continueButton(page).click();
  }
  await expect(page.locator('.quiz .glyph')).toHaveText(pickItem.show); // the missed one, once more
  await solveQuiz(page, pickItem);
  await continueButton(page).click();
  await solveQuiz(page, kanaFirst.items.find((i) => i.type === 'pairs')); // and the pairs, which had a slip
  await continueButton(page).click();
  const marked = kanaFirst.items.filter((i) => i.type !== 'teach').length;
  await expect(page.getByText(`${marked - 2} of ${marked} right first try`)).toBeVisible();
});

test('a Japanese review: due kana come back on the Japanese path, with Kaede', async ({ page }) => {
  const lesson = japanese.units[0].lessons[2]; // has a build item
  const results = lesson.items.filter((i) => i.type !== 'teach').map((i) => ({ key: `japanese:${i.id}`, correct: true }));
  const then = new Date(Date.now() - 30 * 86400000);
  const p = finishSession(emptyProgress(), `japanese:${lesson.id}`, results, then);
  await page.addInitScript(([p, course]) => { localStorage.setItem('drill.progress', p); localStorage.setItem('drill.course', course); }, [JSON.stringify(p), 'japanese']);
  await firstVisit(page);
  await page.locator('[data-review]').click();
  await expect(page.locator('.who svg')).toHaveClass(/cast-kaede/);
  for (let n = 0; n < results.length; n++) {
    const id = await page.evaluate(() => document.querySelector('.quiz .glyph, .quiz .meaning, .quiz .choices')?.textContent);
    const item = lesson.items.find((i) => i.type !== 'teach' && (i.show === id || (i.type === 'pairs' && i.pairs.every(([l]) => id.includes(l)))));
    await solveQuiz(page, item);
    await continueButton(page).click();
  }
  await expect(page.locator('.kicker')).toHaveText('Review done');
  await expect(page.getByText(`${results.length} of ${results.length} recalled`)).toBeVisible();
});

test('Japanese skip-ahead: someone who reads the vowels starts at K and S', async ({ page }) => {
  await toJapanese(page);
  await page.getByRole('button', { name: 'Read some kana already? Skip ahead' }).click();
  await expect(page.getByRole('heading', { name: 'Can you read hiragana?' })).toBeFocused();
  await page.getByRole('button', { name: 'I know あいうえお' }).click();
  await page.getByRole('button', { name: 'Start at K and S' }).click();
  await expect(page.locator('.street', { has: page.getByRole('heading', { name: 'K and S' }) }).locator('.here')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Read some kana already? Skip ahead' })).toHaveCount(0);
});

test('with a ja-JP voice, a listening item plays the sound and hides the reading', async ({ page }) => {
  await page.addInitScript(() => {
    window.spoken = [];
    const voice = { lang: 'ja-JP', name: 'Test JP' };
    speechSynthesis.getVoices = () => [voice];
    speechSynthesis.speak = (u) => window.spoken.push(u.text);
    speechSynthesis.cancel = () => {};
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } }; // a real one only takes a real voice
  });
  await toJapanese(page);
  await page.getByRole('button', { name: `Continue · ${kanaFirst.title}` }).click();
  await expect.poll(() => page.evaluate(() => window.spoken)).toEqual(['あ']); // the teach card says it
  const listen = kanaFirst.items.find((i) => i.listen);
  for (const item of kanaFirst.items.slice(0, kanaFirst.items.indexOf(listen))) { await solveQuiz(page, item); await continueButton(page).click(); }
  await expect(page.locator('.quiz .glyph')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hear it again' })).toBeVisible();
  expect((await page.evaluate(() => window.spoken)).at(-1)).toBe(listen.speak);
  await solveQuiz(page, listen);
});

test("a habit's chip opens its view, with today's session listed", async ({ page }) => {
  await firstVisit(page);
  await finishFirstLesson(page);
  await continueButton(page).click();

  await week(page, 1).click();
  await expect(page.getByRole('heading', { name: 'Learning' })).toBeFocused();
  await expect(page.locator('.day').first()).toContainText('Today');
  await expect(page.locator('.day').first().getByRole('listitem')).toContainText(`${first.title} · `);
  await expect(page.getByText('1 of the last 14 days')).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(week(page, 1)).toBeFocused();
});

/** Switches home to Calm and does the first breathing lesson, on a fake clock: 3 breaths, 36 s. */
async function firstBreathing(page) {
  await page.clock.install();
  await firstVisit(page);
  await breathe(page);
}

/** From home, the first breathing lesson on Calm's path, played on the installed fake clock. */
async function breathe(page) {
  await tab(page, 'Calm').click();
  await expect(page.getByRole('heading', { name: 'Breathing' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue · The long out-breath' }).click();
  await expect(page.getByText('Lifeline is 13 11 14')).toBeVisible(); // real help, on the first Calm lesson
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Breath 1 of 3')).toBeVisible();
  // Pausing holds the clock: a long pause moves nothing on.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.clock.runFor(60_000);
  await expect(page.getByText('Breath 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Carry on' }).click();
  await page.clock.runFor(30_000);
  await expect(page.getByText('Breath 3 of 3')).toBeVisible();
  await page.clock.runFor(7_000);
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
}

test('a Calm breathing session keeps its own streak, and asks how you feel', async ({ page }) => {
  await firstBreathing(page);
  await expect(page.getByText(/^3 breaths · \d+ min$/)).toBeVisible();
  await expect(page.locator('.chip.calm')).toContainText('🌿 1');
  await page.getByRole('button', { name: 'Calmer' }).click();
  await expect(page.getByRole('button', { name: 'Calmer' })).toHaveCount(0);
  await continueButton(page).click();

  // Home remembers Calm, the next breathing lesson is open, and Learning's streak is untouched.
  await expect(tab(page, 'Calm')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'The long out-breath, done' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue · Five slow breaths' })).toBeVisible();
  await expect(tab(page, 'Learning')).toHaveAccessibleName('Learning');

  await week(page, 1).click();
  await expect(page.locator('.day').first().getByRole('listitem')).toHaveText(/^Breathing · \d+ min · felt calmer$/);
  await page.getByRole('button', { name: 'Back' }).click();

  await page.reload();
  await expect(tab(page, 'Calm')).toHaveAttribute('aria-pressed', 'true');
  await tab(page, 'Learning').click();
  await expect(page.getByRole('button', { name: `Continue · ${first.title}` })).toBeVisible();
});

test('your own timings: a growing value shows what the next lesson uses, and + steps from it', async ({ page }) => {
  await firstVisit(page);
  await tab(page, 'Calm').click();
  await page.getByRole('button', { name: 'Your timings' }).click();
  const first = calmCourse.units[0].lessons[0].items.find((i) => i.type === 'breathe').cycles;
  const breaths = page.locator('.steppers li[data-k="breaths"]');
  await expect(breaths.locator('output')).toHaveText(`${first} (grows as you go)`);
  await breaths.getByRole('button', { name: 'More' }).click();
  await expect(breaths.locator('output')).toHaveText(`${first + 1} (default grows as you go)`);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')).timings)).toEqual({ calm: { breaths: first + 1 } });
  await page.getByRole('button', { name: 'Back to defaults' }).click();
  await expect(breaths.locator('output')).toHaveText(`${first} (grows as you go)`);
});

test('your own timings: a value that differs per step reads as written, and + sets one time for every step', async ({ page }) => {
  await firstVisit(page);
  await tab(page, 'Screen break').click();
  await page.getByRole('button', { name: 'Your timings' }).click();
  const each = page.locator('.steppers li[data-k="seconds"]');
  await expect(each.locator('output')).toHaveText('As written (15–25 s)');
  await each.getByRole('button', { name: 'More' }).click();
  await expect(each.locator('output')).toHaveText('25 s (default as written, 15–25 s)');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')).timings)).toEqual({ break: { seconds: 25 } });
  await page.getByRole('button', { name: 'Back to defaults' }).click();
  await expect(each.locator('output')).toHaveText('As written (15–25 s)');
});

test('your own timings: Calm breathes in for 6 when set, saves at once, and goes back to defaults', async ({ page }) => {
  await page.clock.install();
  await firstVisit(page);
  await tab(page, 'Calm').click();
  // Before the first session there is no habit view yet, so the timings are on home.
  await page.getByRole('button', { name: 'Your timings' }).click();
  await expect(page.getByRole('heading', { name: 'Your timings' })).toBeFocused();
  await expect(page.getByText('If someone has given you timings, set them here.')).toBeVisible();
  const inhale = page.locator('.steppers li[data-k="inhale"]');
  await expect(inhale.locator('output')).toHaveText('4 s (default 4)');
  await expect(page.locator('.steppers li[data-k="breaths"] output')).toHaveText('3 (grows as you go)');
  await expect(page.getByRole('button', { name: 'Back to defaults' })).toBeDisabled();
  for (let i = 0; i < 2; i++) await inhale.getByRole('button', { name: 'More' }).click();
  await expect(inhale.locator('output')).toHaveText('6 s (default 4)');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')).timings)).toEqual({ calm: { inhale: 6 } });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Your timings' })).toBeFocused();

  // The breath in now lasts 6 s: the orb still fills at 5.9 s and turns to the out-breath at 6.
  await page.getByRole('button', { name: 'Continue · The long out-breath' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  const orb = page.locator('.orb');
  await expect(orb).toHaveAttribute('data-phase', 'in');
  await expect(orb.locator('.count')).toHaveText('6');
  await page.clock.runFor(5_900);
  await expect(orb).toHaveAttribute('data-phase', 'in');
  await page.clock.runFor(200);
  await expect(orb).toHaveAttribute('data-phase', 'out');
  await expect(orb.locator('.count')).toHaveText('8'); // the out-breath keeps its default
  await page.clock.runFor(3 * 14_000);
  await expect(page.getByText(/^3 breaths · \d+ min$/)).toBeVisible();
  await continueButton(page).click();

  // After a session they live in the habit view; Back to defaults resets everything, at once.
  await week(page, 1).click();
  await page.getByRole('button', { name: 'Your timings' }).click();
  await expect(inhale.locator('output')).toHaveText('6 s (default 4)');
  await page.getByRole('button', { name: 'Back to defaults' }).click();
  await expect(inhale.locator('output')).toHaveText('4 s (default 4)');
  await expect(page.getByRole('button', { name: 'Back to defaults' })).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('drill.progress')).timings)).toEqual({ calm: {} });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Calm' })).toBeVisible();
});

test('"Not really" gets a kind line and the help line', async ({ page }) => {
  await firstBreathing(page);
  await page.getByRole('button', { name: 'Not really' }).click();
  await expect(page.getByRole('status')).not.toBeEmpty();
  await expect(page.getByText("If you're struggling, talk to someone. In Australia, Lifeline is 13 11 14, any time.")).toBeVisible();
});

test('a screen break is taught once, plays its six steps on the clock, and keeps its own streak', async ({ page }) => {
  await page.clock.install();
  await firstVisit(page);
  await tab(page, 'Screen break').click();
  await page.getByRole('button', { name: 'Continue · Why breaks help' }).click();
  await expect(page.getByText('Move gently and stop if anything hurts.')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  const now = page.locator('.steps li[aria-current="step"]');
  await expect(now).toHaveText(/^Look far away\s*\d+ s$/);
  await expect(page.getByText(/at least 6 metres away/)).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(now).toHaveText(/^Slow blinks\s*\d+ s$/);
  await page.clock.runFor(85_000);
  await expect(now).toHaveText(/^Sit tall\s*\d+ s$/);
  await page.clock.runFor(16_000);
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  await expect(page.getByText(/^6 steps · \d+ min$/)).toBeVisible();
  await expect(page.locator('.chip.break')).toContainText('👀 1');
  await page.getByRole('button', { name: 'About the same' }).click();
  await expect(page.getByRole('status')).not.toBeEmpty();
  await continueButton(page).click();
  await expect(page.getByRole('button', { name: 'Continue · Take a break' })).toBeVisible();
  await week(page, 1).click();
  await expect(page.locator('.day').first().getByRole('listitem')).toHaveText(/^Screen break · \d+ min · felt about the same$/);
});

test('Mira demonstrates the screen break, and "How?" pauses it for the guidance', async ({ page }) => {
  await page.clock.install();
  await firstVisit(page);
  await tab(page, 'Screen break').click();
  await page.getByRole('button', { name: 'Continue · Why breaks help' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.coach.demonstrates .who')).toHaveAccessibleName('Mira');
  await expect(page.locator('.who svg.cast-mira')).toBeVisible();
  const now = page.locator('.steps li[aria-current="step"]');
  await page.clock.runFor(21_000);
  await expect(now).toHaveText(/^Slow blinks\s*\d+ s$/);
  await page.getByRole('button', { name: 'How?' }).click();
  const how = page.getByRole('dialog', { name: 'Slow blinks' });
  await expect(how).toContainText('Hold them closed for a slow count of two');
  const left = await page.locator('.steps .count').textContent();
  expect(Number(left)).toBeGreaterThan(10); // seconds left in the 15 s step
  await page.clock.runFor(30_000); // the clock waits while the guidance is open
  await expect(now).toHaveText(/^Slow blinks\s*\d+ s$/);
  await expect(page.locator('.steps .count')).toHaveText(left);
  await how.getByRole('button', { name: 'Got it' }).click();
  await expect(how).toBeHidden();
  await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'false');
  await page.clock.runFor(15_000);
  await expect(now).toHaveText(/^Shoulder rolls\s*\d+ s$/);
  await page.clock.runFor(86_000);
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
});

for (const [width, height] of [[412, 780], [360, 740]]) {
  test(`at ${width}x${height} the screen break's step and its seconds sit clear of the buttons`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await firstVisit(page);
    await tab(page, 'Screen break').click();
    await page.getByRole('button', { name: 'Continue · Why breaks help' }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    const top = (await page.locator('.choices').boundingBox()).y;
    for (const el of [page.locator('.steps li[aria-current="step"]'), page.locator('.steps .count')]) {
      const box = await el.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(top);
    }
  });
}

test('grounding is tap-to-count, and stopping is one tap with no questions', async ({ page }) => {
  await firstBreathing(page); // grounding opens once breathing has been started
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Five senses' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: '5 things you can see' })).toBeVisible();
  for (let i = 1; i <= 5; i++) await page.getByRole('button', { name: `Noticed ${i} of 5` }).click();
  await expect(page.getByRole('heading', { name: '4 things you can hear' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click(); // moving on with none tapped is fine
  await expect(page.getByRole('heading', { name: '3 things you can touch' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(tab(page, 'Calm')).toHaveAttribute('aria-pressed', 'true');
  // Stopping logs nothing: today still shows just the breathing.
  await week(page, 1).click();
  await expect(page.locator('.day').first().getByRole('listitem')).toHaveCount(1);
});

test('Reflect keeps two lines and a skip, on its own streak, and shows them back in the habit view', async ({ page }) => {
  await firstVisit(page);
  await tab(page, 'Reflect').click();
  await page.getByRole('button', { name: 'Continue · Three small lines' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  // One prompt at a time, typed into one line; nothing is ever counted or judged.
  await expect(page.getByRole('heading', { name: 'One good thing' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'One good thing' })).toBeFocused();
  await page.getByRole('textbox').fill('Tea in the sun');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'One thing you learned' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('textbox', { name: 'One thing for tomorrow' }).fill('Call Sam');
  await page.getByRole('button', { name: 'Finish' }).click();

  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  await page.getByRole('button', { name: 'About the same' }).click();
  await expect(page.locator('.chip.reflect')).toContainText('📓 1');
  await continueButton(page).click();
  await expect(tab(page, 'Learning')).toHaveAccessibleName('Learning');

  await week(page, 1).click();
  const todayLines = page.locator('.day').first();
  await expect(todayLines.locator('ul').first().getByRole('listitem')).toHaveText(/^Reflect · 1 min · felt about the same$/);
  await expect(todayLines.getByRole('list', { name: 'Your lines' }).getByRole('listitem')).toHaveText(['Good Tea in the sun', 'Tomorrow Call Sam']);
});

test('a Reflect box grows with what is written, up to a cap, and the mic tip shows once', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await firstVisit(page);
  await tab(page, 'Reflect').click();
  await page.getByRole('button', { name: 'Continue · Three small lines' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  const tip = page.getByText('Rather talk? Tap the mic on your keyboard.');
  await expect(tip).toBeVisible();
  const box = page.getByRole('textbox', { name: 'One good thing' });
  const height = async () => (await box.boundingBox()).height;
  const one = await height();
  await box.fill('A long walk by the river with a friend, and the sun came out just as we reached the bridge.');
  const grown = await height();
  expect(grown).toBeGreaterThan(one * 1.5);
  await box.fill('word '.repeat(200));
  const capped = await height();
  expect(capped).toBeGreaterThan(grown);
  expect(capped).toBeLessThan(300);
  expect(await box.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true); // then it scrolls
  await box.press('Enter'); // Enter still moves on
  await expect(page.getByRole('heading', { name: 'One thing you learned' })).toBeVisible();
  await expect(tip).toBeHidden();
});

test('once the short Reflect path is done, "Reflect today" stays on home', async ({ page }) => {
  await firstVisit(page);
  await tab(page, 'Reflect').click();
  for (const title of ['Three small lines', 'Another day', 'Making it yours']) {
    await page.getByRole('button', { name: `Continue · ${title}` }).click();
    if (title === 'Three small lines') await page.getByRole('button', { name: 'Start' }).click();
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Skip' }).click(); // an empty day still counts
    await continueButton(page).click();
  }
  await page.getByRole('button', { name: 'Reflect today' }).click();
  await expect(page.getByRole('heading', { name: 'One good thing' })).toBeVisible();
});

test('a Move session plays timed exercises with rests, and keeps its own streak', async ({ page }) => {
  await page.clock.install();
  await firstVisit(page);
  await tab(page, 'Move').click();
  await expect(page.getByRole('heading', { name: 'Wake up' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue · Loosen up' }).click();
  // Safety first, on the first Move lesson.
  await expect(page.getByText('Move gently and stop if anything hurts. If you have an injury or a health condition, check with a doctor first.')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Neck tilts' })).toBeVisible();
  await expect(page.getByText('Exercise 1 of 5')).toBeVisible();
  await expect(page.locator('.count')).toHaveText('30');
  await page.clock.runFor(30_000);
  await expect(page.getByRole('heading', { name: 'Rest' })).toBeVisible();
  await expect(page.getByText('Rest · next: Shoulder rolls')).toBeVisible();
  await expect(page.getByText(/Exercise \d of/)).toHaveCount(0);
  await page.clock.runFor(10_000);
  await expect(page.getByText('Exercise 2 of 5')).toBeVisible();
  await expect(page.locator('.tally')).toHaveText('1 of 8'); // a rep move counts reps
  await page.clock.runFor(140_000);
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  await expect(page.getByText(/^5 moves · 8 shoulder rolls · \d+ min$/)).toBeVisible();
  await expect(page.locator('.chip.move')).toContainText('🌱 1');
  await page.getByRole('button', { name: 'Not really' }).click();
  await expect(page.getByText('Move gently and stop if anything hurts.', { exact: false })).toBeVisible();
  await continueButton(page).click();

  // The next Wake up lesson is open; Calm and Learning are untouched.
  await expect(page.getByRole('button', { name: 'Continue · A bit longer' })).toBeVisible();
  await expect(tab(page, 'Learning')).toHaveAccessibleName('Learning');
  await expect(tab(page, 'Calm')).toHaveAccessibleName('Calm');
  await week(page, 1).click();
  await expect(page.locator('.day').first().getByRole('listitem')).toHaveText(/^Wake up · \d+ min · felt no different$/);
});

// Focus keeps the screen on through the Wake Lock API: a stand-in records each request and release.
const fakeWakeLock = (page) => page.addInitScript(() => {
  window.locks = [];
  Object.defineProperty(navigator, 'wakeLock', { value: { request: async (type) => {
    const lock = { type, released: false, release: async () => { lock.released = true; } };
    window.locks.push(lock);
    return lock;
  } } });
});
const held = (page) => page.evaluate(() => window.locks.filter((l) => !l.released).length);

test('a Focus session: what it is for, a full timer with a pause, the screen kept on, and how it went', async ({ page }) => {
  await fakeWakeLock(page);
  await page.clock.install();
  await firstVisit(page);
  await tab(page, 'Focus').click();
  await page.getByRole('button', { name: 'Continue · Ten minutes, one thing' }).click();
  await expect(page.getByText('Stopping early is fine.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  // One optional tap: a preset starts it straight away.
  await expect(page.getByRole('heading', { name: 'What are you focusing on?' })).toBeVisible();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  const left = page.getByRole('timer', { name: 'Time left' });
  await expect(left).toHaveText('10:00');
  await expect(page.locator('.focus-on')).toHaveText('Reading');
  expect(await held(page)).toBe(1);
  await page.clock.runFor(60_000);
  await expect(left).toHaveText('9:00');
  // Pause holds the clock, however long; Carry on goes on from the same second.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.clock.runFor(300_000);
  await expect(left).toHaveText('9:00');
  await page.getByRole('button', { name: 'Carry on' }).click();
  await page.clock.runFor(540_000);
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeVisible();
  expect(await held(page)).toBe(0);
  await expect(page.locator('.chip.focus')).toContainText('⏳ 1');
  await page.getByRole('button', { name: 'Focused' }).click();
  await expect(page.getByRole('status')).not.toBeEmpty();
  await continueButton(page).click();
  await expect(page.getByRole('button', { name: 'Continue · Fifteen minutes' })).toBeVisible();
  // The log says what was done, never what it was for; that is the day's own detail.
  await week(page, 1).click();
  const day = page.locator('.day').first();
  await expect(day.locator('ul').first().getByRole('listitem')).toHaveText(/^Focus · \d+ min · felt focused$/);
  await expect(day.getByRole('list', { name: 'What you focused on' })).toHaveText(/Focused on\s*Reading/);
});

test("Focus: your own words, then \"I'm done\" early ends it like any other, with no penalty", async ({ page }) => {
  await fakeWakeLock(page);
  await page.clock.install();
  await firstVisit(page);
  await tab(page, 'Focus').click();
  await page.getByRole('button', { name: 'Continue · Ten minutes, one thing' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('textbox', { name: 'What are you focusing on?' }).fill('Tax <forms>');
  await page.getByRole('button', { name: 'Start · 10 min' }).click();
  await expect(page.locator('.focus-on')).toHaveText('Tax <forms>');
  await page.clock.runFor(180_000);
  await expect(page.getByRole('timer')).toHaveText('7:00');
  await page.getByRole('button', { name: "I'm done" }).click();
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeVisible();
  expect(await held(page)).toBe(0);
  await expect(page.locator('.practice-end')).not.toContainText(/distract|only|early/i);
  await continueButton(page).click();
  // Finished is finished: the path moves on, as after a full session.
  await expect(page.getByRole('button', { name: 'Continue · Fifteen minutes' })).toBeVisible();
  await week(page, 1).click();
  await expect(page.locator('.day').first().getByRole('list', { name: 'What you focused on' })).toHaveText(/Tax <forms>/);
});

test('Focus with nothing picked, on your own time from the timings', async ({ page }) => {
  await page.clock.install();
  await firstVisit(page);
  await tab(page, 'Focus').click();
  await page.getByRole('button', { name: 'Your timings' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.locator('.steppers output')).toContainText('20 min');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Continue · Ten minutes, one thing' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Start · 20 min' }).click();
  await expect(page.getByRole('timer')).toHaveText('20:00');
  await expect(page.locator('.focus-on')).toHaveCount(0);
  await page.clock.runFor(1_200_000);
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeVisible();
  await continueButton(page).click();
  await week(page, 1).click();
  await expect(page.getByRole('list', { name: 'What you focused on' })).toHaveCount(0);
});

test('mute stays muted after a reload', async ({ page }) => {
  await firstVisit(page);
  const sound = page.getByRole('button', { name: 'Sound' });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
});

test('progress saved to a file loads back', async ({ page }) => {
  await firstVisit(page);
  await finishFirstLesson(page);
  await continueButton(page).click();

  await page.getByRole('button', { name: 'Your progress' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save to a file' }).click();
  const file = await (await download).path();

  // A browser that lost everything: start over, then load the file back.
  await page.evaluate(() => localStorage.clear());
  await firstVisit(page);
  await expect(tab(page, 'Learning')).toHaveAccessibleName('Learning');
  await page.getByRole('button', { name: 'Your progress' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load from a file' }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByText('The file has 1 lesson done, a 1-day streak')).toBeVisible();
  await page.getByRole('button', { name: 'Use this file' }).click();

  await expect(tab(page, 'Learning')).toHaveAccessibleName('Learning, 1-day streak');
  await expect(page.getByRole('button', { name: `${first.title}, done` })).toBeVisible();
});

/**
 * Progress with `habits` each practised on the `days` days before today, loaded before the page.
 * `earned` gives it what that has earned, as if every session had been in the app; `extra` is merged
 * in first (`tracked`, for self-reported habits).
 */
async function grown(page, habits, days, earned = false, extra = {}) {
  let p = { ...emptyProgress(), start: { chess: basics.units[0].title }, ...extra };
  for (const h of habits) {
    for (let i = days; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      p = h === 'learn' ? finishSession(p, null, [], d) : finishPractice(p, h, null, d);
    }
  }
  if (earned) p = award(p).progress;
  await page.addInitScript((saved) => { if (!localStorage.getItem('drill.progress')) localStorage.setItem('drill.progress', saved); }, JSON.stringify(p));
}

const strip = (page, n) => page.getByRole('button', { name: `Your garden: ${n} plant${n === 1 ? '' : 's'}` });

test('a fresh garden is one seed; the first lesson grows a sprout and opens a flower', async ({ page }) => {
  await firstVisit(page);
  await expect(strip(page, 1).locator('svg.plant')).toHaveCount(1);
  await expect(strip(page, 1).locator('svg.plant-tree.stage-0')).toBeVisible();
  await finishFirstLesson(page);
  // The first unit is one lesson long, so finishing it is a finished unit: a flower opens.
  await expect(page.locator('.arrivals li')).toHaveText([`A flower opened for ${basics.units[0].title}`]);
  await continueButton(page).click();
  await expect(strip(page, 1).locator('svg.plant-tree.stage-1')).toBeVisible();
  await expect(strip(page, 1).locator('[data-part="bloom"]')).toHaveCount(1);
});

test('a 7-day Calm streak brings a butterfly, shown on the end screen and in the garden', async ({ page }) => {
  await grown(page, ['calm'], 7);
  await page.clock.install();
  await firstVisit(page);
  await expect(strip(page, 2).locator('svg.visitor')).toHaveCount(0);
  await breathe(page);
  await expect(page.locator('.arrivals')).toContainText('A butterfly arrived');
  await expect(page.locator('.arrivals svg.visitor-butterfly')).toBeVisible();
  await continueButton(page).click();

  await expect(strip(page, 2).locator('svg.visitor-butterfly')).toHaveCount(1);
  await strip(page, 2).click();
  await expect(page.getByRole('heading', { name: 'Your garden' })).toBeFocused();
  const calm = page.locator('.plant-card[data-plant="calm"]');
  await expect(calm).toContainText('Lavender · sapling');
  await expect(calm).toContainText('8 days practised');
  await expect(calm).toContainText('6 more days to young');
  await expect(calm).toContainText(/A butterfly arrived · \d+ \w{3}/);

  // A card opens that habit's view; Back comes to the garden, then home to the strip.
  await calm.click();
  await expect(page.getByRole('heading', { name: 'Calm' })).toBeFocused();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(calm).toBeFocused();
  await page.locator('.garden-view svg.plant-tree').click();
  await expect(page.getByRole('heading', { name: 'Learning' })).toBeFocused();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(strip(page, 2)).toBeFocused();
});

test('a backlog of arrivals shows three lines, then the rest in one', async ({ page }) => {
  await grown(page, ['calm', 'move', 'break'], 30);
  await page.clock.install();
  await firstVisit(page);
  await breathe(page);
  await expect(page.locator('.arrivals li')).toHaveCount(4);
  await expect(page.locator('.arrivals li').last()).toHaveText(/^and \d+ more in your garden$/);
});

test('with all five habits started, the bar fits at 360px and the tabs are one row that scrolls inside itself', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await grown(page, ['learn', 'calm', 'move', 'reflect', 'break'], 14);
  await firstVisit(page);
  for (const name of ['Sound', 'Your progress']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box.x >= 0 && box.x + box.width <= 360, name).toBe(true);
  }
  const tabs = page.getByRole('navigation', { name: 'Show the path for' });
  const rows = await tabs.getByRole('button').evaluateAll((els) => new Set(els.map((e) => e.offsetTop)).size);
  expect(rows).toBe(1);
  expect(await overflow(page)).toBe(0);
  // The last tab, once picked, is scrolled into view within the row.
  await tab(page, 'Move').click();
  await expect(tab(page, 'Move')).toHaveAccessibleName('Move, 14-day streak');
  await expect(tab(page, 'Move')).toBeFocused();
  const box = await tab(page, 'Move').boundingBox();
  expect(box.x >= 0 && box.x + box.width <= 360).toBe(true);
  await expect(week(page, 14)).toBeVisible();
  expect(await overflow(page)).toBe(0);
});

test('every plant grows visibly stage to stage, and a sprout and a sapling read at a glance', async ({ page }) => {
  await firstVisit(page);
  const heights = await page.evaluate(async () => {
    const { PLANTS, plant } = await import('/src/garden/art.js');
    return Object.fromEntries(Object.keys(PLANTS).map((h) => [h, [0, 1, 2, 3, 4].map((s) => {
      const box = document.createElement('div');
      box.innerHTML = plant(h, s);
      document.body.append(box);
      const { y } = box.querySelector('[data-part="plant"]').getBBox();
      box.remove();
      return 106 - y; // the drawing's height above its base, in canvas units
    })]));
  });
  for (const [habit, [, sprout, sapling, young, full]] of Object.entries(heights)) {
    expect(sprout / full, `${habit} sprout`).toBeGreaterThan(0.3);
    expect(sapling / full, `${habit} sapling`).toBeGreaterThan(0.45);
    const h = heights[habit];
    for (let s = 1; s < 5; s++) expect(h[s] - h[s - 1], `${habit} stage ${s} grows`).toBeGreaterThan(8);
  }
});

test('BOUNDS in art.js is what each plant really draws (re-measure and paste if this fails)', async ({ page }) => {
  await firstVisit(page);
  const { measured, table } = await page.evaluate(async () => {
    const { KINDS, plant, MAX_FLOWERS, BOUNDS } = await import('/src/garden/art.js');
    const box = (svg) => {
      const d = document.createElement('div');
      d.innerHTML = svg.replace(/^(<svg [^>]*>)/, '$1<g>').replace(/<\/svg>$/, '</g></svg>');
      document.body.append(d);
      const b = d.querySelector('svg > g').getBBox();
      d.remove();
      return b;
    };
    // Open and shut, with every bloom; floored and ceiled to whole units, a unit of room around.
    // Every drawing, the self-reported habits' too (plant() takes a drawing's own name).
    const measured = Object.fromEntries(KINDS.map((name) => [name, [0, 1, 2, 3, 4].map((s) => {
      const bs = [false, true].map((closed) => box(plant(name, s, { flowers: MAX_FLOWERS, closed })));
      return [Math.floor(Math.min(...bs.map((b) => b.x))) - 1, Math.floor(Math.min(...bs.map((b) => b.y))) - 1,
        Math.ceil(Math.max(...bs.map((b) => b.x + b.width))) + 1, Math.ceil(Math.max(...bs.map((b) => b.y + b.height))) + 1];
    })]));
    return { measured, table: BOUNDS };
  });
  expect(table).toEqual(measured);
});

test('young plants have shapes of their own, whatever their size', async ({ page }) => {
  await firstVisit(page);
  const pairs = await page.evaluate(async () => {
    const { PLANTS, plant } = await import('/src/garden/art.js');
    // A plant's silhouette without its mound, cropped and fitted into a small square (sitting on its
    // bottom edge), so two plants compare by shape alone, at about the strip's size on a phone.
    const N = 32;
    const shape = async (habit, s) => {
      const img = new Image();
      img.src = `data:image/svg+xml,${encodeURIComponent(plant(habit, s).replace(/<ellipse data-part="mound"[^>]*\/>/, ''))}`;
      await img.decode();
      const big = Object.assign(document.createElement('canvas'), { width: 200, height: 240 });
      big.getContext('2d').drawImage(img, 0, 0, 200, 240);
      const a = big.getContext('2d').getImageData(0, 0, 200, 240).data;
      let x0 = 200, y0 = 240, x1 = 0, y1 = 0;
      for (let i = 0; i < 200 * 240; i++) {
        if (a[i * 4 + 3] > 128) { const x = i % 200, y = (i / 200) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, k = N / Math.max(w, h);
      const small = Object.assign(document.createElement('canvas'), { width: N, height: N });
      small.getContext('2d').drawImage(big, x0, y0, w, h, (N - w * k) / 2, N - h * k, w * k, h * k);
      const d = small.getContext('2d').getImageData(0, 0, N, N).data;
      return Array.from({ length: N * N }, (_, i) => d[i * 4 + 3] > 128);
    };
    const young = [];
    for (const habit of Object.keys(PLANTS)) for (const s of [1, 2]) young.push({ name: PLANTS[habit], id: `${PLANTS[habit]} ${s}`, px: await shape(habit, s) });
    const out = [];
    for (const a of young) for (const b of young) {
      if (a.name >= b.name) continue;
      let differ = 0, union = 0;
      a.px.forEach((on, i) => { if (on || b.px[i]) union++; if (on !== b.px[i]) differ++; });
      out.push([`${a.id} vs ${b.id}`, differ / union]);
    }
    return out;
  });
  for (const [pair, diff] of pairs) expect(diff, pair).toBeGreaterThan(0.4);
});

test('on a phone, the first plant card shows above the fold under the full garden', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 780 });
  await grown(page, ['learn', 'calm', 'move', 'reflect', 'break'], 5, true);
  await firstVisit(page);
  await strip(page, 5).click();
  const card = await page.locator('.plant-card').first().boundingBox();
  // A browser's own bars take about 100px of a 780px phone screen: the whole first card is above them.
  expect(card.y + card.height).toBeLessThan(680);
});

test('a self-reported habit: add Walk, one tap, its streak and plant, and Undo takes the tap back', async ({ page }) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Add a habit' }).click();
  await expect(page.getByRole('heading', { name: 'Add a habit' })).toBeFocused();
  for (const name of ['Walk', 'Read', 'Water', 'Outside', 'Make your own']) await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await page.getByRole('button', { name: /Walk/ }).click();

  await expect(tab(page, 'Walk')).toHaveAccessibleName('Walk');
  await expect(tab(page, 'Walk')).toBeFocused();
  await expect(page.locator('.street')).toHaveCount(0); // no path
  await expect(strip(page, 1).locator('svg.plant[data-habit="walk"]')).toHaveCount(0);
  const walked = page.getByRole('button', { name: 'I walked today' });
  const box = await walked.boundingBox();
  expect(box.y + box.height).toBeGreaterThan(915 - 160); // in the thumb zone
  await walked.click();

  await expect(tab(page, 'Walk')).toHaveAccessibleName('Walk, 1-day streak');
  await expect(page.getByText('Done for today.')).toBeFocused();
  await expect(page.locator('.chip.log')).toContainText('1');
  await expect(page.locator('.arrivals li')).toHaveText(['A bee found Walk']);
  await expect(walked).toHaveCount(0);
  await expect(page.getByText('How do you feel?')).toHaveCount(0);
  await expect(strip(page, 2).locator('svg.plant-tulip[data-habit="walk"]')).toBeVisible();
  await expect(week(page, 1)).toBeVisible();
  await page.reload();
  await expect(tab(page, 'Walk')).toHaveAccessibleName('Walk, 1-day streak');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(tab(page, 'Walk')).toHaveAccessibleName('Walk');
  await expect(walked).toBeFocused();
  await expect(strip(page, 1).locator('svg.plant[data-habit="walk"]')).toHaveCount(0);
  // Tapped again: the streak is back at one, and the bee, already earned, does not arrive twice.
  await walked.click();
  await expect(tab(page, 'Walk')).toHaveAccessibleName('Walk, 1-day streak');
  await expect(page.locator('.arrivals')).toHaveCount(0);
});

test('a habit of your own: name, icon and plant; log it, rename it, and its name is only ever text', async ({ page }) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Add a habit' }).click();
  await page.getByRole('button', { name: 'Make your own' }).click();
  await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Name' }).fill('   ');
  await page.getByRole('button', { name: 'Add habit' }).click();
  await expect(page.getByRole('heading', { name: 'Make your own' })).toBeVisible(); // a blank name is not a habit
  await page.getByRole('textbox', { name: 'Name' }).fill('Stretch');
  await page.getByRole('radio', { name: '🧘' }).check();
  await page.getByRole('radio', { name: 'Cactus' }).check();
  await page.getByRole('button', { name: 'Add habit' }).click();

  await expect(tab(page, 'Stretch')).toBeFocused();
  await page.getByRole('button', { name: 'Done today' }).click();
  await expect(tab(page, 'Stretch')).toHaveAccessibleName('Stretch, 1-day streak');
  await expect(page.locator('.arrivals li')).toHaveText(['A bee found Stretch']);
  await expect(strip(page, 2).locator('svg.plant-cactus[data-habit="own-1"]')).toBeVisible();

  const name = '<img src=x onerror=hacked=1>&'; // within the 30-letter name
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Stretch');
  await expect(page.getByRole('radio', { name: 'Cactus' })).toBeChecked();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.log-habit h2')).toHaveText(`🧘 ${name}`);
  await expect(page.locator('.path-tab[data-path="own-1"]')).toContainText(name);
  await expect(page.locator('#app img')).toHaveCount(0);
  await strip(page, 2).click();
  await expect(page.locator('.plant-card[data-plant="own-1"]')).toContainText(`A bee found ${name}`);
  await expect(page.locator('.plant-card[data-plant="own-1"]')).toContainText('Cactus · sprout');
  await page.locator('.plant-card[data-plant="own-1"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`🧘 ${name}`);
  await expect(page.getByText('Stretch', { exact: true })).toBeVisible(); // the log keeps what it was called that day
  expect(await page.evaluate(() => window.hacked)).toBeUndefined();

  // Hiding takes it off the tabs and keeps its days; + Habit brings it back.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.locator('.path-tab[data-path="own-1"]').click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Hide this habit' }).click();
  await expect(page.locator('.path-tab[data-path="own-1"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add a habit' }).click();
  await page.locator('[data-track="own-1"]').click();
  await expect(page.locator('.path-tab[data-path="own-1"]')).toHaveAccessibleName(`${name}, 1-day streak`);
});

test('with many habits, the tab row stays one row that scrolls inside itself, and + Habit is last', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const tracked = [...['walk', 'read', 'water', 'outside'].map((id) => ({ id })),
    ...['Stretch', 'Floss', 'Guitar practice, slow and easy'].map((name, i) => ({ id: `own-${i + 1}`, name, plant: 'mushroom' }))];
  await grown(page, ['learn', 'calm', 'move', 'reflect', 'break', ...tracked.map((t) => t.id)], 9, true, { tracked });
  await firstVisit(page);
  const tabs = page.getByRole('navigation', { name: 'Show the path for' });
  await expect(tabs.getByRole('button')).toHaveCount(15);
  expect(await tabs.getByRole('button').evaluateAll((els) => new Set(els.map((e) => e.offsetTop)).size)).toBe(1);
  await expect(tabs.getByRole('button').last()).toHaveAccessibleName('Add a habit');
  expect(await overflow(page)).toBe(0);
  await expect(strip(page, 12).locator('svg.plant')).toHaveCount(12);
  await tab(page, 'Guitar practice, slow and easy').click();
  await expect(page.getByRole('button', { name: 'Done today' })).toBeVisible();
  expect(await overflow(page)).toBe(0);
});

test('the tab row fades only an edge with more tabs past it, and never fades the selected tab', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const tracked = ['walk', 'read', 'water', 'outside'].map((id) => ({ id }));
  await grown(page, ['learn', 'calm', 'move', 'reflect', 'break', ...tracked.map((t) => t.id)], 3, false, { tracked });
  await firstVisit(page);
  const row = page.getByRole('navigation', { name: 'Show the path for' });
  const edges = () => row.evaluate((el) => [el.classList.contains('more-start'), el.classList.contains('more-end')]);
  expect(await edges()).toEqual([false, true]); // Learning is first: nothing to the left
  await row.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect.poll(edges).toEqual([true, false]);
  for (const name of ['Move', 'Read', 'Water']) {
    await tab(page, name).click();
    const [nav, sel] = await Promise.all([row.boundingBox(), tab(page, name).boundingBox()]);
    expect(sel.x, name).toBeGreaterThanOrEqual(nav.x + 36);
    expect(sel.x + sel.width, name).toBeLessThanOrEqual(nav.x + nav.width - 36);
  }
});

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const colorScheme of ['light', 'dark']) {
  for (const width of [360, 412]) {
    test.describe(`${width}px, ${colorScheme}`, () => {
      test.use({ colorScheme, viewport: { width, height: 800 } });

      test('home has no sideways scroll', async ({ page }) => {
        await firstVisit(page);
        await expect(tab(page, 'Learning')).toBeVisible();
        expect(await overflow(page)).toBe(0);
      });

      test('the habit view has no sideways scroll', async ({ page }) => {
        await grown(page, ['learn'], 1);
        await firstVisit(page);
        await page.getByRole('button', { name: /See your week$/ }).click();
        await expect(page.getByRole('heading', { name: 'Learning' })).toBeVisible();
        expect(await overflow(page)).toBe(0);
      });

      test('the garden strip and the full garden have no sideways scroll', async ({ page }) => {
        await grown(page, ['learn', 'calm', 'move', 'reflect', 'break'], 30, true);
        await firstVisit(page);
        await expect(strip(page, 5).locator('svg.visitor')).toHaveCount(14); // a bee for each but Learning
        expect(await overflow(page)).toBe(0);
        await strip(page, 5).click();
        await expect(page.locator('.plant-card')).toHaveCount(5);
        expect(await overflow(page)).toBe(0);
      });

      test('a log habit, the + Habit sheet and the make-your-own form have no sideways scroll', async ({ page }) => {
        const tracked = [{ id: 'walk' }, { id: 'water' }, { id: 'own-1', name: 'A very long name for a habit!!', plant: 'rose' }];
        await grown(page, ['learn', 'calm', 'walk', 'water', 'own-1'], 3, true, { tracked });
        await firstVisit(page);
        await tab(page, 'A very long name for a habit!!').click();
        await page.getByRole('button', { name: 'Done today' }).click();
        await expect(page.getByText('Done for today.')).toBeVisible();
        expect(await overflow(page)).toBe(0);
        await page.getByRole('button', { name: 'Add a habit' }).click();
        expect(await overflow(page)).toBe(0);
        await page.getByRole('button', { name: 'Make your own' }).click();
        await expect(page.getByRole('radio', { name: 'Mushroom' })).toBeAttached();
        expect(await overflow(page)).toBe(0);
        await page.getByRole('button', { name: 'Back' }).click();
        await page.getByRole('button', { name: 'Back' }).click();
        await strip(page, 5).click();
        expect(await overflow(page)).toBe(0);
      });

      test('a lesson has no sideways scroll', async ({ page }) => {
        await firstVisit(page);
        await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
        await expect(page.locator('.board svg')).toBeVisible();
        expect(await overflow(page)).toBe(0);
      });
    });
  }
}

/** Calm with `lessons` done (ids like 'breathe1'), so later units are open, loaded before the page. */
async function calmDone(page, lessons) {
  let p = { ...emptyProgress(), start: { chess: basics.units[0].title } };
  for (const id of lessons) p = finishPractice(p, 'calm', `calm:${id}`, new Date());
  await page.addInitScript((saved) => { if (!localStorage.getItem('drill.progress')) localStorage.setItem('drill.progress', saved); }, JSON.stringify(p));
}

/** Records every synthesised tone's frequency and every noise loop started, in window.heard. */
async function listen(page) {
  await page.addInitScript(() => {
    window.heard = { tones: [], noise: 0 };
    const tone = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.heard.tones.push(this.frequency.value); return tone.apply(this, a); };
    const loop = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { window.heard.noise++; return loop.apply(this, a); };
  });
}

test('the sigh is taught once, then two breaths in and one long sigh out, with Moss along', async ({ page }) => {
  await calmDone(page, ['breathe1', 'ground1', 'scan1']);
  await page.clock.install();
  await page.goto('/');
  await tab(page, 'Calm').click();
  await expect(page.getByRole('heading', { name: 'Sighing' })).toBeVisible();
  await page.getByRole('button', { name: 'Two breaths in, one long out', exact: true }).click();
  await expect(page.getByText('take a short extra sniff on top')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Sigh 1 of 3')).toBeVisible();
  await expect(page.locator('#said')).toHaveText('In through your nose…');
  await page.clock.runFor(3_000);
  await expect(page.locator('#said')).toHaveText('and a little more');
  await page.clock.runFor(1_000);
  await expect(page.locator('#said')).toHaveText('and one long sigh out');
  await expect(page.locator('.cast-moss.mood-exhale')).toBeVisible();
  await page.clock.runFor(6_000);
  await expect(page.getByText('Sigh 2 of 3')).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  await expect(page.getByText(/^3 sighs · \d+ min$/)).toBeVisible();
  await continueButton(page).click();
  await expect(page.getByRole('button', { name: 'Two breaths in, one long out, done' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Five long sighs', exact: true })).toBeEnabled();
});

test('the butterfly hug: Moss crosses its arms, and left and right light in turn, a second each', async ({ page }) => {
  await calmDone(page, ['breathe1', 'ground1', 'scan1', 'sigh1']);
  await page.clock.install();
  await page.goto('/');
  await tab(page, 'Calm').click();
  await page.getByRole('button', { name: 'Cross your arms', exact: true }).click();
  await expect(page.getByText('Cross your arms over your chest')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.cast-moss.mood-hug')).toBeVisible();
  await expect(page.getByText('Tap 1 of 40')).toBeVisible();
  await expect(page.locator('.sides .on')).toHaveText('Left');
  await page.clock.runFor(1_000);
  await expect(page.getByText('Tap 2 of 40')).toBeVisible();
  await expect(page.locator('.sides .on')).toHaveText('Right');
  // Pausing holds the taps too.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.clock.runFor(30_000);
  await expect(page.getByText('Tap 2 of 40')).toBeVisible();
  await page.getByRole('button', { name: 'Carry on' }).click();
  await page.clock.runFor(39_000);
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  await expect(page.getByText(/^40 slow taps · \d+ min$/)).toBeVisible();
});

test('Calm sounds: both are off until turned on, the bell then rings at the start and end, and mute silences both', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await listen(page);
  await calmDone(page, ['breathe1']);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Your progress' }).click();
  const bell = page.getByRole('button', { name: 'A soft bell at the start and end' });
  const rainButton = page.getByRole('button', { name: 'Soft rain while you practise' });
  await expect(bell).toHaveAttribute('aria-pressed', 'false');
  await expect(rainButton).toHaveAttribute('aria-pressed', 'false');
  await bell.click(); // turning it on rings it once, as a sample
  await expect(bell).toHaveAttribute('aria-pressed', 'true');
  await rainButton.click();
  await expect(rainButton).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back' }).click();

  const bells = () => page.evaluate(() => window.heard.tones.filter((f) => f === 528).length);
  await tab(page, 'Calm').click();
  await page.getByRole('button', { name: 'Continue · Five slow breaths' }).click();
  await expect(page.getByText('Breath 1 of 5')).toBeVisible();
  expect(await bells()).toBe(2);
  expect(await page.evaluate(() => window.heard.noise)).toBe(1);
  await page.clock.runFor(60_000);
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  expect(await bells()).toBe(3);

  // Muted on the home bar: no bell and no rain.
  await continueButton(page).click();
  await page.getByRole('button', { name: 'Sound' }).click();
  await page.getByRole('button', { name: 'Continue · Six slow breaths' }).click();
  await expect(page.getByText('Breath 1 of 6')).toBeVisible();
  expect(await bells()).toBe(3);
  expect(await page.evaluate(() => window.heard.noise)).toBe(1);
});

test('under reduced motion Calm stays quiet: no bell, no rain', async ({ page }) => {
  await listen(page);
  await page.addInitScript(() => { localStorage.setItem('drill.rain', 'on'); localStorage.setItem('drill.bell', 'on'); });
  await calmDone(page, ['breathe1']);
  await page.goto('/');
  await tab(page, 'Calm').click();
  await page.getByRole('button', { name: 'Continue · Five slow breaths' }).click();
  await expect(page.getByText('Breath 1 of 5')).toBeVisible();
  expect(await page.evaluate(() => [window.heard.tones.includes(528), window.heard.noise])).toEqual([false, 0]);
});

// ---- Wide screens: tablets and desktop browsers ----
// Each size plays the main flows (the garden, a lesson, a Calm practice) and screenshots them to
// test-results/screens/<size>-<scheme>/. The phone sizes are here too, so a layout change can be
// checked against the phone shots from before it.
const SCREENS = [[360, 800], [412, 915], [768, 1024], [1024, 768], [1440, 900]];
for (const colorScheme of ['light', 'dark']) {
  for (const [width, height] of SCREENS) {
    const wide = width >= 768;
    test(`${width}x${height} ${colorScheme}: home, the garden, a lesson and a Calm practice fit and play`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height });
      const at = new Date();
      at.setHours(10, 0, 0, 0);
      await page.clock.install({ time: at });
      // The cast's lines are picked at random: seeded here, so two runs' shots can be compared.
      await page.addInitScript(() => { let s = 1; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; });
      await grown(page, ['learn', 'calm', 'move', 'reflect', 'break'], 10, true);
      const dir = `test-results/screens/${width}x${height}-${colorScheme}`;
      const shot = async (name) => {
        expect(await overflow(page), name).toBe(0);
        await page.screenshot({ path: `${dir}/${name}.png` });
      };

      await firstVisit(page);
      await expect(strip(page, 5)).toBeVisible();
      await shot('1-home');
      if (wide) {
        // Two panes: the garden and the habit tabs in a rail beside the path.
        const [rail, path] = await Promise.all([page.locator('.paths').boundingBox(), page.locator('.street').first().boundingBox()]);
        expect(rail.x + rail.width).toBeLessThanOrEqual(path.x);
        expect((await page.locator('.cta .next').boundingBox()).height).toBeGreaterThanOrEqual(48);
      }

      await strip(page, 5).click();
      await expect(page.locator('.plant-card')).toHaveCount(5);
      await shot('2-garden');
      await page.getByRole('button', { name: 'Back' }).click();

      await tab(page, 'Learning').click();
      await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
      await expect(page.locator('.board svg')).toBeVisible();
      await shot('3-lesson');
      if (wide) expect((await page.locator('div.board').boundingBox()).width).toBeGreaterThan(412);
      for (const item of first.items) {
        await solve(page, item);
        await continueButton(page).click();
      }
      await expect(page.locator('.arrivals')).toBeVisible();
      await shot('4-lesson-end');
      await continueButton(page).click();

      await tab(page, 'Calm').click();
      await page.getByRole('button', { name: 'Continue · The long out-breath' }).click();
      await page.getByRole('button', { name: 'Start' }).click();
      await expect(page.getByText('Breath 1 of 3')).toBeVisible();
      await page.clock.runFor(2_000);
      await shot('5-calm');
      await page.clock.runFor(60_000);
      await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
      await shot('6-calm-end');
    });
  }
}

test.describe('a keyboard on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Tab reaches the habit tabs and Continue, and Enter and Space press them', async ({ page }) => {
    await firstVisit(page);
    const calm = tab(page, 'Calm');
    for (let i = 0; i < 30 && !(await calm.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(calm).toBeFocused();
    await page.keyboard.press('Space');
    await expect(tab(page, 'Calm')).toHaveAttribute('aria-pressed', 'true');
    const go = page.getByRole('button', { name: 'Continue · The long out-breath' });
    for (let i = 0; i < 30 && !(await go.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(go).toBeFocused();
    // The focus ring shows on a keyboard focus.
    expect(await go.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  });
});

test('on a short landscape screen the rail scrolls inside itself, so + Habit is always in reach', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  const tracked = [{ id: 'walk' }, { id: 'water' }, { id: 'own-1', name: 'Stretch', plant: 'rose' }];
  await grown(page, ['learn', 'calm', 'walk', 'water', 'own-1'], 3, true, { tracked });
  await firstVisit(page);
  const rail = page.locator('.rail');
  const box = await rail.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(600);
  const add = page.getByRole('button', { name: 'Add a habit' });
  await rail.evaluate((el) => { el.scrollTop = el.scrollHeight; }); // the rail scrolls, not the page
  await expect(add).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('on a landscape desktop, end-screen and practice buttons follow the content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await firstVisit(page);
  await tab(page, 'Calm').click();
  await page.getByRole('button', { name: 'Continue · The long out-breath' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  const gap = async (above, button) => { const [a, b] = [await above.boundingBox(), await button.boundingBox()]; return b.y - a.y - a.height; };
  expect(await gap(page.locator('.breath'), page.getByRole('button', { name: 'Pause' }))).toBeLessThan(80);
  await page.clock.runFor(60_000);
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  expect(await gap(page.locator('.feel'), continueButton(page))).toBeLessThan(80);
});

test('Wind down: settle in, Calm breathing on your own timings, a sigh, goodnight, all in the night palette', async ({ page }) => {
  const p = { ...emptyProgress(), picked: [], timings: { calm: { inhale: 6 } } };
  await page.addInitScript((saved) => { if (!localStorage.getItem('drill.progress')) localStorage.setItem('drill.progress', saved); }, JSON.stringify(p));
  await page.clock.install();
  await page.goto('/');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const day = await bg();
  await tab(page, 'Wind down').click();
  await expect(page.getByRole('heading', { name: 'Bedtime' })).toBeVisible();
  // Wind down plays Calm's timings, so its timings link opens Calm's.
  await expect(page.getByRole('button', { name: 'Your timings' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue · Lights low' }).click();
  // Dim and warm even in the light theme.
  await expect(page.locator('main.play.night')).toBeVisible();
  expect(await bg()).toBe('rgb(24, 20, 15)');
  await expect(page.locator('.cast-moss.mood-sleepy')).toBeVisible();
  await expect(page.getByText('Lifeline is 13 11 14')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.steps li.now')).toHaveText('Lights low');
  await expect(page.locator('#said')).toHaveText('Dim the lights, or switch one off.');
  await page.clock.runFor(20_000);
  // Calm's breathing, with the breath in at the learner's own 6 s.
  await expect(page.getByText('Breath 1 of 3')).toBeVisible();
  await expect(page.locator('.orb .count')).toHaveText('6');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.clock.runFor(60_000);
  await expect(page.getByText('Breath 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Carry on' }).click();
  await page.clock.runFor(3 * 14_000);
  await expect(page.getByText('Sigh 1 of 1')).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(page.getByText('Put your phone face down')).toBeVisible();
  await page.getByRole('button', { name: 'Goodnight' }).click();
  // The one practice end screen, still at night.
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  await expect(page.locator('main.practice-end.night')).toBeVisible();
  await expect(page.getByText(/^3 breaths · 1 sigh · \d+ min$/)).toBeVisible();
  await expect(page.locator('.chip.winddown')).toContainText('🌙 1');
  await page.getByRole('button', { name: 'Settled' }).click();
  await continueButton(page).click();
  await expect(page.getByRole('button', { name: 'Lights low, done' })).toBeVisible();
  expect(await bg()).toBe(day);
});

test('Japanese taps get the same pop and shake as every lesson', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const frames = (t) => page.evaluate((t) => document.getAnimations().some((a) => a.effect.getKeyframes().some((k) => k.transform === t)), t);
  await toJapanese(page);
  await page.getByRole('button', { name: `Continue · ${kanaFirst.title}` }).click();
  const [a, b] = kanaFirst.items.filter((i) => i.type === 'pick');
  for (const item of kanaFirst.items.slice(0, kanaFirst.items.indexOf(a))) { await solveQuiz(page, item); await continueButton(page).click(); }
  await quizChoice(page, a.answer).click();
  expect(await frames('scale(1.12)'), 'pop').toBe(true);
  await continueButton(page).click();
  for (const item of kanaFirst.items.slice(kanaFirst.items.indexOf(a) + 1, kanaFirst.items.indexOf(b))) { await solveQuiz(page, item); await continueButton(page).click(); }
  await quizChoice(page, b.options.find((o) => o !== b.answer)).click();
  expect(await frames('translateX(-6px)'), 'shake').toBe(true);
});
