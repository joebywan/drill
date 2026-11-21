// What a beginner meets when a step goes wrong, played by real touch: Coding's "Around the rock" walked into the rock on
// purpose (the card that shows it first, then a burst of shots while Fennel's own run fails and the way that works
// replaces it), Chess's "Rook and bishop" (the board's top held through every stars move, the bishop's introduction
// kept until the first move) and a Maths build missed on purpose (what was put, shown back).
// FEEDBACK_SMALL=1080x1700 plays it on a short phone.
import { readFileSync } from 'node:fs';
import { subjects } from '../../src/subjects.js';
import { answer as tapsOf, kind as chessKind } from '../../src/chess/items.js';
import { answer as mathsAnswer, right as mathsRight, toQuiz } from '../../src/maths/items.js';
import { RUN_ENDS } from '../../src/cast/lines.js';
import { movesOf, onShortPhone, promote, square, tapMove } from './lib/chess.js';

const coding = JSON.parse(readFileSync(new URL('../../src/data/coding.json', import.meta.url))).units[0];
const chess = subjects.find((s) => s.id === 'chess').units.flatMap((u) => u.lessons);
const maths = subjects.find((s) => s.id === 'maths').units[0].lessons[0];

async function rock(h) {
  const { page, touch, btn, shot, run, seed, check } = h;
  await seed({ done: { 'coding:steps-0': true } });
  await touch(page.locator('[data-course="coding"]'));
  await touch(btn(`Continue · ${coding.lessons[1].title}`));
  await shot('rock-card');
  await run(900); await page.waitForTimeout(2500); // the demo walks on real time
  await shot('rock-card-shown');
  check('the card leaves the stop marked', await page.locator('.program .block.stopped').count() === 1 && await page.locator('.program .block.unrun').count() === 2);
  await touch(btn('Continue', { exact: true }));
  await shot('rock-build');
  for (const step of ['right', 'down', 'right', 'up']) await touch(page.locator('.tiles').getByRole('button', { name: `Step ${step}`, exact: true }));
  // A burst while the miss plays: Fennel bumps, his own program stays marked, then the way that works.
  const said = [];
  for (let i = 0; i < 4; i++) {
    await shot(`rock-miss-${i}`);
    said.push(await page.locator('#said').textContent());
    if (i === 0) check('their own program stays, marked where it stopped', await page.locator('.program .block.stopped').count() === 1 && await page.locator('.program.shown').count() === 0);
    await run(600);
  }
  await run(1500);
  await shot('rock-miss-way');
  check(`he says the rock stopped him (${said.join(' | ')})`, said.includes(RUN_ENDS.rock));
  check('the way that works comes after, the reason first in the verdict', await page.locator('.program.shown').count() === 1
    && (await page.locator('#said').textContent()) === RUN_ENDS.way && (await page.locator('.foot.show p').textContent()).startsWith(RUN_ENDS.rock));
  await touch(btn('Quit lesson'));

  // Again, and this time a tap during the hold, where Continue will be: it ends the hold, and does not press Continue.
  await touch(btn(`Continue · ${coding.lessons[1].title}`));
  await touch(btn('Continue', { exact: true }));
  for (const step of ['right', 'down', 'right', 'up']) await touch(page.locator('.tiles').getByRole('button', { name: `Step ${step}`, exact: true }));
  check('the hold is on', await page.locator('.foot.show').count() === 0 && await page.locator('.program .block.stopped').count() === 1);
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', `<i id="pin" style="position:fixed;left:50%;top:${innerHeight - 40}px;width:1px;height:1px;pointer-events:none"></i>`));
  await touch(page.locator('#pin'));
  await page.evaluate(() => document.getElementById('pin').remove());
  await shot('rock-hold-tapped');
  check('a tap ends the hold: the way and the verdict show', await page.locator('.program.shown').count() === 1 && await page.locator('.foot.show.wrong').count() === 1);
  await run(800);
  check('and it did not press Continue', await page.locator('.foot.show.wrong').count() === 1 && await page.locator('.program.shown').count() === 1);
  await touch(btn('Quit lesson'));
}

async function stars(h) {
  const { page, touch, btn, shot, run, seed, check } = h;
  const lesson = chess.find((l) => l.id === 'moves-0');
  await seed({ done: Object.fromEntries(chess.slice(0, chess.indexOf(lesson)).map((l) => [`chess:${l.id}`, true])) });
  const course = page.locator('[data-course="chess"]');
  if (await course.count()) await touch(course);
  await touch(btn(`Continue · ${lesson.title}`));
  const top = () => page.locator('div.board').evaluate((b) => Math.round(b.getBoundingClientRect().top + scrollY));
  for (const item of lesson.items) {
    const k = chessKind(item);
    if (item.demo) {
      for (let i = 0; i < 4; i++) { await shot(`${item.id}-demo-${i}`); await run(700); await page.waitForTimeout(300); }
      await run(1500); await page.waitForTimeout(500);
      await shot(`${item.id}-asked`);
      check(`${item.id}: the introduction stays with the prompt`, (await page.locator('#said').textContent()).startsWith(item.intro));
    } else if (k !== 'teach') { await run(700); await shot(`${item.id}-asked`); }
    if (k === 'teach') { await touch(btn('Continue', { exact: true })); continue; }
    const asked = await top();
    const seen = [];
    if (k === 'tap') for (const sq of tapsOf(item)) await touch(square(page, sq));
    else {
      for (const [n, m] of movesOf(item).entries()) {
        await tapMove(touch, page, m.from, m.to);
        if (m.promotion) await promote(h, m.promotion);
        await run(600);
        seen.push(await top());
        if (n === 0) await shot(`${item.id}-moved`);
      }
    }
    await page.locator('.foot.show').waitFor();
    seen.push(await top());
    check(`${item.id}: the board stays at ${asked} (${seen.join(', ')})`, seen.every((t) => Math.abs(t - asked) <= 1));
    await touch(btn('Continue', { exact: true }));
  }
}

async function sums(h) {
  const { page, touch, btn, shot, seed, check } = h;
  await seed();
  await touch(page.locator('[data-course="maths"]'));
  await touch(btn(`Continue · ${maths.title}`));
  const bottom = page.locator('.choices');
  for (const item of maths.items) {
    if (item.type === 'build' && mathsAnswer(item).length > 1) {
      const right = [...mathsAnswer(item)];
      await shot('maths-build');
      const card = await page.locator('.quiz .card').boundingBox();
      await touch(bottom.getByRole('button', { name: right[0], exact: true, disabled: false }));
      const slip = (await bottom.locator('.choice:not(:disabled)').allTextContents()).find((t) => t !== right[1]);
      await touch(bottom.getByRole('button', { name: slip, exact: true, disabled: false }));
      await page.locator('.foot.show').waitFor();
      await shot('maths-missed');
      check(`what was put shows: ${await page.locator('.quiz .yours').textContent()}`, (await page.locator('.quiz .yours').textContent()) === `You put ${right[0]}${slip}`);
      const after = await page.locator('.quiz .card').boundingBox();
      check('the card stays put', Math.abs(after.y - card.y) <= 1 && Math.abs(after.height - card.height) <= 1);
      return;
    }
    if (item.type === 'pick') await touch(bottom.getByRole('button', { name: item.options.find((o) => mathsRight(item, o)), exact: true }));
    if (item.type === 'build') for (const c of mathsAnswer(item)) await touch(bottom.getByRole('button', { name: c, exact: true, disabled: false }));
    if (item.type === 'pairs') for (const pair of toQuiz(item).pairs) for (const x of pair) await touch(bottom.getByRole('button', { name: x, exact: true, disabled: false }));
    if (item.type !== 'teach') await page.locator('.foot.show').waitFor();
    await touch(btn('Continue', { exact: true }));
  }
}

export default async (h) => {
  await h.page.addInitScript(() => { window.WINGBEAT_PLAIN = true; }); // the lessons as written: no warm-ups to answer
  const all = async () => { await rock(h); await stars(h); await sums(h); };
  if (process.env.FEEDBACK_SMALL) await onShortPhone(h, process.env.FEEDBACK_SMALL, all);
  else await all();
};
