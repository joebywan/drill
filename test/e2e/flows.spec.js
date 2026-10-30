import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { answer, kind, starPath } from '../../src/chess/items.js';
import { emptyProgress, finishPractice, finishSession } from '../../src/progress.js';
import { award } from '../../src/garden/model.js';

// The first lesson on the path. Its answers are worked out from the course data with the same
// item logic the app uses, so the test follows the content when it changes.
const basics = JSON.parse(readFileSync(new URL('../../src/data/basics.json', import.meta.url)));
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

async function placeAtStart(page) {
  await page.goto('/');
  await page.getByRole('button', { name: "I've never played" }).click();
}

async function finishFirstLesson(page) {
  await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
  for (const item of first.items) {
    await solve(page, item);
    await continueButton(page).click();
  }
}

test('first visit asks where to start, then shows the path', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Have you played chess before?' })).toBeVisible();
  await page.getByRole('button', { name: "I've never played" }).click();
  await expect(page.getByRole('heading', { name: basics.units[0].title })).toBeVisible();
  await expect(page.getByRole('button', { name: `Continue · ${first.title}` })).toBeVisible();
});

test('finishing the first lesson shows the summary, starts the streak, and survives a reload', async ({ page }) => {
  await placeAtStart(page);
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

test("a habit's chip opens its view, with today's session listed", async ({ page }) => {
  await placeAtStart(page);
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
  await placeAtStart(page);
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

test('"Not really" gets a kind line and the help line', async ({ page }) => {
  await firstBreathing(page);
  await page.getByRole('button', { name: 'Not really' }).click();
  await expect(page.getByRole('status')).not.toBeEmpty();
  await expect(page.getByText("If you're struggling, talk to someone. In Australia, Lifeline is 13 11 14, any time.")).toBeVisible();
});

test('a screen break is taught once, plays its six steps on the clock, and keeps its own streak', async ({ page }) => {
  await page.clock.install();
  await placeAtStart(page);
  await tab(page, 'Screen break').click();
  await page.getByRole('button', { name: 'Continue · Why breaks help' }).click();
  await expect(page.getByText('Move gently and stop if anything hurts.')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  const now = page.locator('.steps li[aria-current="step"]');
  await expect(now).toHaveText('Look far away');
  await expect(page.getByText(/at least 6 metres away/)).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(now).toHaveText('Slow blinks');
  await page.clock.runFor(85_000);
  await expect(now).toHaveText('Sit tall');
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
  await placeAtStart(page);
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

test('once the short Reflect path is done, "Reflect today" stays on home', async ({ page }) => {
  await placeAtStart(page);
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
  await placeAtStart(page);
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

test('mute stays muted after a reload', async ({ page }) => {
  await placeAtStart(page);
  const sound = page.getByRole('button', { name: 'Sound' });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
});

test('progress saved to a file loads back', async ({ page }) => {
  await placeAtStart(page);
  await finishFirstLesson(page);
  await continueButton(page).click();

  await page.getByRole('button', { name: 'Your progress' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save to a file' }).click();
  const file = await (await download).path();

  // A browser that lost everything: start over, then load the file back.
  await page.evaluate(() => localStorage.clear());
  await placeAtStart(page);
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
 * `earned` gives it what that has earned, as if every session had been in the app.
 */
async function grown(page, habits, days, earned = false) {
  let p = { ...emptyProgress(), start: basics.units[0].title };
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
  await placeAtStart(page);
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
  await page.goto('/');
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
  await page.goto('/');
  await breathe(page);
  await expect(page.locator('.arrivals li')).toHaveCount(4);
  await expect(page.locator('.arrivals li').last()).toHaveText(/^and \d+ more in your garden$/);
});

test('with all five habits started, the bar fits at 360px and the tabs are one row that scrolls inside itself', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await grown(page, ['learn', 'calm', 'move', 'reflect', 'break'], 14);
  await page.goto('/');
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
  await page.goto('/');
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
  await page.goto('/');
  const { measured, table } = await page.evaluate(async () => {
    const { PLANTS, plant, MAX_FLOWERS, BOUNDS } = await import('/src/garden/art.js');
    const box = (svg) => {
      const d = document.createElement('div');
      d.innerHTML = svg.replace(/^(<svg [^>]*>)/, '$1<g>').replace(/<\/svg>$/, '</g></svg>');
      document.body.append(d);
      const b = d.querySelector('svg > g').getBBox();
      d.remove();
      return b;
    };
    // Open and shut, with every bloom; floored and ceiled to whole units, a unit of room around.
    const measured = Object.fromEntries(Object.entries(PLANTS).map(([habit, name]) => [name, [0, 1, 2, 3, 4].map((s) => {
      const bs = [false, true].map((closed) => box(plant(habit, s, { flowers: MAX_FLOWERS, closed })));
      return [Math.floor(Math.min(...bs.map((b) => b.x))) - 1, Math.floor(Math.min(...bs.map((b) => b.y))) - 1,
        Math.ceil(Math.max(...bs.map((b) => b.x + b.width))) + 1, Math.ceil(Math.max(...bs.map((b) => b.y + b.height))) + 1];
    })]));
    return { measured, table: BOUNDS };
  });
  expect(table).toEqual(measured);
});

test('young plants have shapes of their own, whatever their size', async ({ page }) => {
  await page.goto('/');
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
  await page.goto('/');
  await strip(page, 5).click();
  const card = await page.locator('.plant-card').first().boundingBox();
  // A browser's own bars take about 100px of a 780px phone screen: the whole first card is above them.
  expect(card.y + card.height).toBeLessThan(680);
});

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const colorScheme of ['light', 'dark']) {
  for (const width of [360, 412]) {
    test.describe(`${width}px, ${colorScheme}`, () => {
      test.use({ colorScheme, viewport: { width, height: 800 } });

      test('home has no sideways scroll', async ({ page }) => {
        await placeAtStart(page);
        await expect(tab(page, 'Learning')).toBeVisible();
        expect(await overflow(page)).toBe(0);
      });

      test('the habit view has no sideways scroll', async ({ page }) => {
        await placeAtStart(page);
        await page.getByRole('button', { name: 'Your first session starts a streak' }).click();
        await expect(page.getByRole('heading', { name: 'Learning' })).toBeVisible();
        expect(await overflow(page)).toBe(0);
      });

      test('the garden strip and the full garden have no sideways scroll', async ({ page }) => {
        await grown(page, ['learn', 'calm', 'move', 'reflect', 'break'], 30, true);
        await page.goto('/');
        await expect(strip(page, 5).locator('svg.visitor')).toHaveCount(14); // a bee for each but Learning
        expect(await overflow(page)).toBe(0);
        await strip(page, 5).click();
        await expect(page.locator('.plant-card')).toHaveCount(5);
        expect(await overflow(page)).toBe(0);
      });

      test('a lesson has no sideways scroll', async ({ page }) => {
        await placeAtStart(page);
        await page.getByRole('button', { name: `Continue · ${first.title}` }).click();
        await expect(page.locator('.board svg')).toBeVisible();
        expect(await overflow(page)).toBe(0);
      });
    });
  }
}
