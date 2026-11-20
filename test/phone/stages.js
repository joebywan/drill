// A raised butterfly at every stage: on Maths' path (egg, caterpillar small and grown, chrysalis, butterfly),
// on Move's plant in the garden (1, 5, 9, 14 and 30 days), and the line on the end screen as each arrives:
// a Calm session on its 1st, 5th, 14th and 30th day, and a Maths lesson that starts the course or finishes
// its first, eighth or last unit, played by real taps.
import { award } from '../../src/garden/model.js';
import { emptyProgress } from '../../src/progress.js';
import { subjects } from '../../src/subjects.js';
import { allBut, lessons, playMaths, practised } from './lib/seed.js';

const units = subjects.find((s) => s.id === 'maths').units; // nine
const base = () => ({ ...emptyProgress(), start: 'x', picked: [] }); // picked: the intro is done

export default async (h) => {
  const { page, seed, touch, btn, shot, run, check } = h;
  const maths = async (p) => {
    await page.evaluate(() => localStorage.setItem('wingbeat.course', 'maths'));
    await seed(p);
    await touch(btn(/^Learning(,|$)/)); await page.evaluate(() => scrollTo(0, 0));
  };
  const raising = () => page.locator('.raising').textContent();

  // On the path: [what, units finished (or -1 for one lesson), the line].
  for (const [what, d, want] of [['egg', -1, /is raising/], ['caterpillar-small', 1, /is raising/], ['caterpillar-grown', 7, /is raising/],
    ['chrysalis', 8, /is raising/], ['butterfly', 9, /raised a Blue Triangle/]]) {
    await maths(lessons(base(), 'maths', (all) => (d < 0 ? all.slice(0, 1) : units.slice(0, d).flatMap((u) => u.lessons))));
    check(`path: ${what}`, want.test(await raising()), await raising());
    await shot(`path-${what}`);
  }

  // In the garden: Move's plant and its creature, by days practised (to yesterday).
  for (const days of [1, 5, 9, 14, 30]) {
    await seed(practised(base(), 'move', days));
    await touch(btn(/^Your garden/)); await shot(`garden-move-${days}`);
    await page.evaluate(() => document.querySelector('.plant-cards').scrollIntoView()); await page.waitForTimeout(400);
    await shot(`garden-move-${days}-card`);
  }

  // The end screen as a Calm creature reaches each stage.
  for (const [days, want] of [[0, /egg arrived/], [4, /hatched/], [13, /chrysalis/], [29, /butterfly is out/]]) {
    await seed(days ? award(practised(base(), 'calm', days)).progress : base()); // what those days earned, as in the app
    await touch(btn(/^Calm(,|$)/));
    await touch(btn(/^Continue · /)); await touch(btn('Start')); await run(45000);
    const arrived = await page.locator('.arrivals').innerText().catch(() => '');
    check(`Calm day ${days + 1}: ${want.source}`, want.test(arrived), arrived.replace(/\s+/g, ' ').trim());
    await shot(`end-calm-day${days + 1}`);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot(`end-calm-day${days + 1}-bottom`);
  }

  // The end screen as the Maths creature reaches each stage: the lesson played is the next one left.
  for (const [what, u, want] of [['egg', -1, /egg arrived/], ['caterpillar', 0, /hatched/], ['chrysalis', 7, /chrysalis/], ['butterfly', 8, /butterfly is out/]]) {
    await maths(u < 0 ? base() : award(lessons(base(), 'maths', allBut(u))).progress);
    const next = u < 0 ? units[0].lessons[0] : units[u].lessons.at(-1);
    await touch(btn(`Continue · ${next.title}`));
    await playMaths(next, { ...h, shot: null });
    const arrived = await page.locator('.arrivals').innerText().catch(() => '');
    check(`Maths ${what}: ${want.source}`, want.test(arrived), arrived.replace(/\s+/g, ' ').trim());
    await shot(`end-maths-${what}`);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot(`end-maths-${what}-bottom`);
  }
};
