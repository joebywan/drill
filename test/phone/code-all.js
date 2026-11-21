// Plays the JavaScript, TypeScript and Test writing lessons by real touch, as a learner would, and records what it finds (tools/play.js).
// A long scenario, so `npm run phone` with no name skips it. One unit at a time:
//   CODE_COURSE=javascript CODE_UNIT=3 npm run phone -- code-all     (javascript | typescript | testing; unit n continues the progress unit n-1 saved)
//   CODE_COURSE=testing CODE_UNIT=1 CODE_LESSONS=tb-1,tb-2 ...         only those lessons
//   CODE_SMALL=1080x1700 ...                                           a short phone (under 700 px of page)
import { chipsOf, optionsOf, wayOf } from '../../src/code/items.js';
import { chipName } from '../../src/code/exercise.js';
import { withCheckpoint } from '../../src/repeat.js';
import { playCourse } from '../../tools/play.js';
import javascript from '../../src/code/courses/javascript.js';
import typescript from '../../src/code/courses/typescript.js';
import testing from '../../src/code/courses/testing.js';

const COURSES = { javascript, typescript, testing };
// The parts of a code screen that must not sit on each other; the verdict may cover the tray, and the answers a quiz card offers.
const PARTS = ['.bubble', '.grid-world', '.code-given', '.code-program', '.code-out', '.quiz .card', '.quiz .choices', '.tiles'];
const TRAY = ['.tiles', '.quiz .choices'];

/** Taps one code item in, worked out from the item itself with the functions test/code-courses.test.js proves it with. */
async function answerCode({ page, tap, btn }, item) {
  if (item.type === 'teach') return;
  if (item.type === 'predict') {
    const { answer } = optionsOf(item);
    const texts = await page.locator('.choices .choice').allTextContents(); // exact: "one two" is not "one\ntwo"
    const at = texts.indexOf(answer);
    if (at < 0) throw new Error(`${item.id}: "${answer}" is not among ${JSON.stringify(texts)}`);
    return tap(page.locator('.choices .choice').nth(at));
  }
  if (item.type !== 'build' && item.type !== 'gap') throw new Error(`no way to answer a ${item.type} item`);
  for (const w of item.type === 'gap' ? item.fill : chipsOf(wayOf(item), item.chunks)) await tap(page.locator('.tiles').getByRole('button', { name: chipName(w), exact: true }));
  await tap(btn('Run', { exact: true })); // exact: a chip named run( is not Run
}

export default async (h) => {
  const id = process.env.CODE_COURSE ?? 'javascript';
  if (!COURSES[id]) throw new Error(`CODE_COURSE is javascript, typescript or testing, not ${id}`);
  const course = { id, follows: COURSES[id].follows, units: COURSES[id].units.map(withCheckpoint) };
  const only = process.env.CODE_LESSONS?.split(',');
  await playCourse(h, { course, unit: +(process.env.CODE_UNIT ?? 1), only, answer: answerCode, small: process.env.CODE_SMALL, parts: PARTS, tray: TRAY });
};
