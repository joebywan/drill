// Words that fit what just happened (the blind beginner playthrough), by real taps:
// - Japanese's "K and S mixed", one of its two listening items missed on purpose and the other answered right: the
//   verdicts never say "look at the strokes" or "you looked at the shape" of a sound (when the phone has a ja-JP voice;
//   with none, the item shows its reading and a reading's lines fit). Its end screen, one miss in seven, is 'nearly',
//   then the same lesson again with no miss. Unit 1 done, its butterfly egg hatches there, and the garden's card says
//   it is a butterfly.
// - Maths' first lesson from nothing: its first egg arrives as a butterfly egg, and the garden's card says so.
// - Maths' tab after a Chess lesson today (the log as a finished Chess lesson leaves it): Ada says today's learning is
//   done, never that Maths is; Chess's tab says chess is.
import { KAEDE_LINES, VOICES, verdicts } from '../../src/cast/lines.js';
import { emptyProgress, finishSession } from '../../src/progress.js';
import { subjects } from '../../src/subjects.js';
import { answerQuiz } from '../../tools/play-quiz.js';
import { playMaths } from './lib/seed.js';

const japanese = subjects.find((s) => s.id === 'japanese');
const all = japanese.units.flatMap((u) => u.lessons);
const lesson = all.find((l) => l.id === 'ks');
const base = () => ({ ...emptyProgress(), start: 'x', picked: ['learn'] });
const SIGHT = /\b(look(ed)? at|shape|strokes?|seen|page|good eyes)\b/i;

export default async (h) => {
  const { page, seed, touch, btn, shot, run, check } = h;
  /** From the end screen, Continue, then the garden's card for Learning, which names what `course` is raising. */
  const garden = async (course, want) => {
    await touch(btn('Continue', { exact: true }));
    await touch(btn(/^Your garden/)); await run(800);
    await page.evaluate(() => document.querySelector('.plant-cards').scrollIntoView()); await run(400);
    await shot(`garden-card-${course}`);
    const cards = (await page.locator('.plant-cards').innerText()).replace(/\s+/g, ' ');
    check(`the garden's card says ${course}'s species is a butterfly`, want.test(cards), cards.slice(0, 200));
  };
  // Every item as it is mounted (a repeat is a fresh version), so the answer is worked out from what is on screen.
  const hook = () => page.evaluate(async () => {
    const { subjects: list } = await import('/src/subjects.js');
    window.__n = 0;
    for (const s of list) if (!s.__seen) { const m = s.mount; s.mount = (el, item, ctx) => { window.__item = JSON.parse(JSON.stringify(item)); window.__n++; return m(el, item, ctx); }; s.__seen = true; }
  });
  const voiced = await page.evaluate(() => speechSynthesis.getVoices().some((v) => /^ja/i.test(v.lang)));
  console.log(`  ja voice: ${voiced ? 'yes' : 'none (a listening item shows its reading)'}`);

  const play = async (name, missOne) => {
    await page.evaluate(() => localStorage.setItem('wingbeat.course', 'japanese'));
    await seed({ ...base(), done: Object.fromEntries(all.slice(0, all.indexOf(lesson)).map((l) => [`japanese:${l.id}`, true])) });
    await touch(btn(/^Learning(,|$)/));
    await hook();
    await touch(btn(`Continue · ${lesson.title}`));
    let seen = 0, missed = false;
    for (let i = 0; i < 30 && !(await page.locator('main.summary').count()); i++) {
      await page.waitForFunction((k) => window.__n > k, seen, { timeout: 15000 });
      seen = await page.evaluate(() => window.__n);
      const item = await page.evaluate(() => window.__item);
      if (item.type === 'pick' && item.listen && missOne && !missed) {
        missed = true;
        const wrong = item.options.find((o) => o !== item.answer);
        await touch(page.locator('.quiz .choices .choice:not(:disabled)').filter({ hasText: new RegExp(`^${wrong}$`) }));
      } else await answerQuiz({ page, tap: touch }, item);
      if (item.type !== 'teach') await page.locator('.foot.show').waitFor();
      if (item.listen) {
        await run(900);
        const said = (await page.locator('.foot.show strong').textContent()).trim();
        const right = await page.locator('.foot.show.right').count() > 0;
        await shot(`${name}-listen-${right ? 'right' : 'wrong'}`);
        console.log(`  ${name}: listening item ${item.id}, ${right ? 'right' : 'wrong'}: "${said}"`);
        if (voiced) {
          check(`${name}: a ${right ? 'right' : 'wrong'} answer to a sound says nothing about looking`, !SIGHT.test(said), said);
          check(`${name}: it is one of the lines for a heard item`, verdicts(KAEDE_LINES, right ? 'correct' : 'wrong', item).includes(said)
            || ['run3', 'run5'].some((k) => KAEDE_LINES[k].includes(said)), said);
        }
      }
      await touch(btn('Continue', { exact: true }));
    }
    await page.locator('main.summary').waitFor();
    await run(1500); await shot(`${name}-end`);
    const head = (await page.locator('main.summary h1').textContent()).trim();
    const sub = (await page.locator('main.summary p.said').first().textContent()).trim();
    const tally = (await page.locator('main.summary .learned').textContent()).trim();
    console.log(`  ${name} end: "${head}" / "${sub}" / ${tally}`);
    return { head, sub, tally, missed };
  };

  const once = await play('miss-one', true);
  check('one listening item was missed', once.missed);
  const [, got, of] = once.tally.match(/(\d+) of (\d+) right first try/) || [];
  check('the end screen counts one miss', of - got === 1, once.tally);
  const nearly = [...japanese.coach.headlines.nearly, ...japanese.coach.lines.nearly];
  check('one miss: the "nearly" words, not "struggled" ones', nearly.includes(once.head) && nearly.includes(once.sub), `${once.head} / ${once.sub}`);
  // Unit 1 is done, so the egg hatches at once: the first word of it says whose egg it is.
  const arrived = await page.locator('.arrivals').innerText().catch(() => '');
  check('the hatching says it is a butterfly egg', /Your Japanese butterfly egg hatched/.test(arrived), arrived.replace(/\s+/g, ' '));
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('miss-one-end-bottom');
  await garden('japanese', /Great Purple Emperor butterfly · caterpillar/);

  const clean = await play('no-miss', false);
  const none = ['perfect', 'fast'].flatMap((k) => [...japanese.coach.headlines[k], ...japanese.coach.lines[k]]);
  check('no miss: the words for every one right', none.includes(clean.head) && none.includes(clean.sub), `${clean.head} / ${clean.sub}`);

  // A first egg: Maths' first lesson, from nothing, played by real taps.
  const maths = subjects.find((s) => s.id === 'maths').units[0].lessons[0];
  await page.evaluate(() => localStorage.setItem('wingbeat.course', 'maths'));
  await seed(base());
  await touch(btn(/^Learning(,|$)/));
  await touch(btn(`Continue · ${maths.title}`));
  await playMaths(maths, { ...h, shot: null });
  await page.locator('main.summary').waitFor(); await run(1500);
  const egg = await page.locator('.arrivals').innerText().catch(() => '');
  check('the first egg arrives, named as a butterfly egg', /Your Maths butterfly egg arrived: a Blue Triangle/.test(egg), egg.replace(/\s+/g, ' '));
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await shot('maths-egg-end');
  await garden('maths', /Blue Triangle butterfly · egg/);

  // Maths' tab after a Chess lesson today.
  const chess = subjects.find((s) => s.id === 'chess').units[0].lessons[0];
  const p = finishSession(base(), `chess:${chess.id}`, [{ key: 'chess:x', correct: true }], new Date(), { title: chess.title, mins: 3, course: 'chess' });
  await page.evaluate(() => localStorage.setItem('wingbeat.course', 'maths'));
  await seed(p);
  await touch(btn(/^Learning(,|$)/)); await page.evaluate(() => scrollTo(0, 0)); await run(400);
  await shot('maths-after-chess');
  const greeting = async () => (await page.locator('.greeting').innerText()).trim();
  const pool = (coach, pick) => VOICES[coach].lines.filter(({ when }) => pick(when)).flatMap((x) => x.lines);
  const ada = await greeting();
  console.log(`  Maths tab: "${ada}"`);
  check("Ada: today's learning is done, from her pool for another course's lesson", ada.startsWith('Ada ') && pool('ada', (w) => w.elsewhere).includes(ada.slice(4)), ada);
  check('Ada never says Maths is done today', !/maths done/i.test(ada), ada);
  await touch(page.locator('[data-course="chess"]')); await page.evaluate(() => scrollTo(0, 0)); await run(400);
  await shot('chess-after-chess');
  const rosa = await greeting();
  console.log(`  Chess tab: "${rosa}"`);
  check('Rosa: chess is done today', rosa.startsWith('Rosa ') && pool('rosa', (w) => w.light === 'done' && !w.elsewhere).includes(rosa.slice(5)), rosa);
};
