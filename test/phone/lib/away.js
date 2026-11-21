// A phone put down and picked up: Home pressed, then the screen locked, in the middle of a Maths answer (verdict up), a
// Coding program (two tiles in) and a Chess puzzle (one move in). After each: is the lesson exactly where it was, and
// does it still finish? Routines (count, sound, screen) are lib/bare.js: a page Playwright drives never hears Home.
import { readFileSync } from 'node:fs';
import { right } from '../../../src/maths/items.js';
import { solve } from '../../../src/coding/program.js';
import { answer, kind, starPath } from '../../../src/chess/items.js';
import { subjects } from '../../../src/subjects.js';
import { putDown, screenOff, sleep, stateOf } from './device.js';
import { playMaths } from './seed.js';

const maths = JSON.parse(readFileSync(new URL('../../../src/data/maths.json', import.meta.url))).units[0].lessons[0];
const coding = JSON.parse(readFileSync(new URL('../../../src/data/coding.json', import.meta.url))).units[0].lessons[0];
const chess = subjects.find((s) => s.id === 'chess').units[0].lessons[0];
const AWAY = Number(process.env.AWAY_SECS ?? 20);

export default async function away(h, { pkg = h.pkg ?? 'com.android.chrome', dir = 'away' } = {}) {
  const { page, adb, seed, touch, btn, shot, run, check, playing } = h;
  const notes = process.env.AWAY_NOTES ?? new URL(`../../../test-results/phone/${dir}/`, import.meta.url).pathname;
  const say = (m) => console.log(`  ${m}`);
  const same = (a, b) => a.text === b.text;
  const diff = (a, b) => { const x = a.split('\n'), y = b.split('\n'); return `lines differ: ${JSON.stringify(x.filter((l) => !y.includes(l)))} vs ${JSON.stringify(y.filter((l) => !x.includes(l)))}`; };

  // Lessons: where they are, before and after Home and the lock screen.
  const lesson = (name, setup, finish) => async () => {
    await setup();
    for (const [how, leave] of [['home', (d) => putDown(h, AWAY, d, pkg)], ['screen-off', (d) => screenOff(h, AWAY, d)]]) {
      const before = await stateOf(page);
      await shot(`${name}-${how}-before`);
      let hid;
      await leave(async () => { hid = playing(); });
      await shot(`${name}-${how}-after`);
      const after = await stateOf(page);
      check(`${name}, ${how}: the lesson is where it was (same screen text)`, same(before, after), same(before, after) ? '' : diff(before.text, after.text));
      check(`${name}, ${how}: the saved progress is untouched`, before.saved === after.saved);
      say(`${name}, ${how}: page hidden afterwards? ${after.hidden}; sound while away: ${JSON.stringify(hid)}`);
    }
    await finish();
  };

  await lesson('maths-pick', async () => {
    await seed();
    await touch(page.locator('[data-course="maths"]'));
    await touch(btn(`Continue · ${maths.title}`));
    await playMaths(maths, h, 1); // the teach card; the pick is next
    const pick = maths.items[1];
    await touch(page.locator('.choices').getByRole('button', { name: pick.options.find((o) => right(pick, o)), exact: true }));
    await page.locator('.foot.show').waitFor();
    await sleep(2000); // the answer's little pop of stars is over
  }, async () => {
    check('maths-pick: Continue is still there and works', await btn('Continue').isVisible());
    await touch(btn('Continue')); await shot('maths-pick-continued');
  })();

  // The three-step program, two tiles in. Played by hand so the item is exactly the half-laid-out one.
  await (async () => {
    await seed();
    await touch(page.locator('[data-course="coding"]'));
    await touch(btn(`Continue · ${coding.title}`));
    await touch(btn('Continue', { exact: true })); // steps-0-meet
    for (const item of coding.items.slice(1, 2)) { // steps-0-one, played through; steps-0-three is next, played half way
      for (const t of solve(item)) await touch(page.locator(`.tiles [data-tile="${item.tiles.findIndex((x) => JSON.stringify(x) === JSON.stringify(t))}"]`));
      await page.locator('.foot.show').waitFor(); await touch(btn('Continue', { exact: true }));
    }
  })().catch((e) => say(`coding setup: ${e.message.split('\n')[0]}`));
  {
    const three = coding.items[2];
    const tile = (t) => page.locator(`.tiles [data-tile="${three.tiles.findIndex((x) => JSON.stringify(x) === JSON.stringify(t))}"]`);
    for (const t of solve(three).slice(0, 2)) await touch(tile(t));
    for (const [how, leave] of [['home', (d) => putDown(h, AWAY, d, pkg)], ['screen-off', (d) => screenOff(h, AWAY, d)]]) {
      const before = await stateOf(page);
      const programBefore = await page.locator('.program').innerHTML();
      await shot(`coding-${how}-before`);
      await leave();
      await shot(`coding-${how}-after`);
      const after = await stateOf(page);
      check(`coding, ${how}: the half-laid program is where it was`, before.text === after.text && programBefore === await page.locator('.program').innerHTML());
    }
    await touch(tile(solve(three)[2]));
    await page.locator('.foot.show').waitFor();
    check('coding: the last tile still finishes the program, right', await page.locator('.foot.right').count() === 1);
  }

  await (async () => {
    await seed();
    await touch(page.locator('[data-course="chess"]'));
    await touch(btn(`Continue · ${chess.title}`));
    for (const item of chess.items.slice(0, 3)) { // teach, tap, teach: then the stars item is next
      if (kind(item) === 'tap') { for (const sq of answer(item)) await touch(page.locator(`.board rect[data-square="${sq}"]`)); await page.locator('.foot.show').waitFor(); }
      await touch(btn('Continue', { exact: true }));
    }
  })().catch((e) => say(`chess setup: ${e.message.split('\n')[0]}`));
  {
    const stars = chess.items[3];
    const [m1] = starPath(stars);
    await touch(page.locator(`.board rect[data-square="${m1.from}"]`)); await touch(page.locator(`.board rect[data-square="${m1.to}"]`)); await run(700);
    for (const [how, leave] of [['home', (d) => putDown(h, AWAY, d, pkg)], ['screen-off', (d) => screenOff(h, AWAY, d)]]) {
      const before = await stateOf(page);
      const board = await page.locator('.board').first().innerHTML();
      await shot(`chess-${how}-before`);
      await leave();
      await shot(`chess-${how}-after`);
      const after = await stateOf(page);
      check(`chess, ${how}: the puzzle is one move in, as it was`, before.text === after.text && board === await page.locator('.board').first().innerHTML());
    }
    const [, m2] = starPath(stars);
    await touch(page.locator(`.board rect[data-square="${m2.from}"]`)); await touch(page.locator(`.board rect[data-square="${m2.to}"]`));
    await page.locator('.foot.show').waitFor();
    check('chess: the second move still finishes the puzzle, right', await page.locator('.foot.right').count() === 1);
  }
}
