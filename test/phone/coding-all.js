// Plays Coding's lessons by real touch, as a learner would, and records what it finds (tools/play.js).
// A long scenario, so `npm run phone` with no name skips it. One unit at a time:
//   CODING_UNIT=3 npm run phone -- coding-all          (1-13; unit n continues the progress unit n-1 saved)
//   CODING_UNIT=1 CODING_LESSONS=steps-0,steps-1-checkpoint ...   only those lessons
//   CODING_SMALL=1080x1700 ...                          a short phone (under 700 px of page)
import { readFileSync } from 'node:fs';
import { answer, armsOf, fixBug, kind, isBuilt, solve } from '../../src/coding/program.js';
import { withCheckpoint } from '../../src/repeat.js';
import { playCourse } from '../../tools/play.js';

const course = { id: 'coding', units: JSON.parse(readFileSync(new URL('../../src/data/coding.json', import.meta.url))).units.map(withCheckpoint) };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const emptied = (b) => (typeof b === 'object' && armsOf(b).length ? { ...b, ...Object.fromEntries(armsOf(b).map((k) => [k, []])) } : b);

/** Taps one Coding item in, worked out from the item itself with the same functions the course is checked with. */
async function answerCoding({ page, tap, btn }, item) {
  const k = kind(item);
  if (k === 'teach') return;
  if (k === 'predict') {
    const [x, y] = answer(item);
    return tap(btn(`Column ${x + 1}, row ${y + 1}`));
  }
  const tile = (t) => tap(page.locator(`.tiles [data-tile="${item.tiles.findIndex((x) => same(x, t))}"]`));
  if (k === 'build') for (const t of solve(item)) await tile(t);
  else if (k === 'bug') { const fix = fixBug(item); await tap(page.locator(`button[data-part="${fix.part}"]`)); await tile(fix.tile); }
  else if (isBuilt(item)) {
    // Chips go in at the cursor; a chip with arms takes it inside, and tapping a list's slot brings it back out.
    const whole = item.type === 'unscramble'; // each of its chips once; a palette's go in as often as wanted
    const used = new Set();
    const lay = async (list, path) => {
      for (const [i, b] of list.entries()) {
        const chip = item.chips.findIndex((c, n) => !(whole && used.has(n)) && same(c, emptied(b)));
        if (chip < 0) throw new Error(`no chip for ${JSON.stringify(emptied(b))}`);
        used.add(chip);
        await tap(page.locator(`.tiles [data-chip="${chip}"]`));
        const arms = typeof b === 'object' ? armsOf(b) : [];
        for (const [a, arm] of arms.entries()) {
          if (a) await tap(page.locator(`button.slot[data-list="${[...path, i, a].join()}"]`));
          await lay(b[arm], [...path, i, a]);
        }
        if (arms.length && i < list.length - 1) await tap(page.locator(`button.slot[data-list="${path.join()}"]`));
      }
    };
    await lay(item.way, []);
    await tap(btn('Run'));
  } else throw new Error(`no way to answer a ${k} item`);
}

export default async (h) => {
  const only = process.env.CODING_LESSONS?.split(',');
  await playCourse(h, { course, unit: +(process.env.CODING_UNIT ?? 1), only, answer: answerCoding, small: process.env.CODING_SMALL });
};
