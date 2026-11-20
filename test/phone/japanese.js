// The first Japanese lesson with real taps: the kana render in the phone's own font (no tofu), and
// the teach card speaks through the ja-JP voice, when the phone has one (Chrome hands speech to
// the TTS engine, so its stream is checked as well as Chrome's). Then a later kana lesson and a
// sentence lesson, opened by marking everything before them done, with nothing poking out sideways.
import { readFileSync } from 'node:fs';
import { recordSpeech } from '../../tools/sound.js';

const course = JSON.parse(readFileSync(new URL('../../src/data/japanese.json', import.meta.url)));
const lessons = course.units.flatMap((u) => [...u.lessons, ...(u.lessons.length > 1 ? [{ id: `${u.lessons[0].id}-checkpoint` }] : [])]);
const lesson = course.units[0].lessons[0];
const KANA = [...new Set(course.units.flatMap((u) => u.lessons).flatMap((l) => l.items).filter((i) => i.type === 'teach').flatMap((i) => [...i.show.replaceAll(' ', '')]))].join('');
const before = (id) => Object.fromEntries(lessons.slice(0, lessons.findIndex((l) => l.id === id)).map((l) => [`japanese:${l.id}`, true]));

export default async ({ page, touch, btn, shot, run, seed, check }) => {
  await seed({ start: {} });
  await touch(btn('Japanese')); await shot('home');
  // A glyph the font lacks draws as the same box as an unassigned code point.
  const tofu = await page.evaluate((all) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '40px system-ui, "Noto Sans JP", "Noto Sans CJK JP", sans-serif';
    const box = c.measureText('\u{10FFFD}').width;
    return [...all].filter((k) => c.measureText(k).width === box);
  }, KANA);
  check('kana render in a system font (no tofu)', !tofu.length, tofu.join(''));
  const voices = await page.evaluate(() => speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang)).map((v) => `${v.name} ${v.lang}`));
  console.log(`  ja voices: ${voices.join(', ') || 'none'}`);

  await touch(btn(`Continue · ${lesson.title}`));
  await run(400); await shot('teach');
  if (voices.length) {
    // "Hear it again" is a real tap, so speech has the user activation Chrome asks for. Then the
    // TTS engine's (or Chrome's) audio stream is started while it plays.
    await page.evaluate(recordSpeech);
    await touch(btn('Hear it again'));
    let said = 0, started = 0;
    for (let i = 0; i < 12 && !started; i++) {
      [said, started] = await page.evaluate(() => [window.__spoken.length, window.__started]);
      if (!started) await new Promise((r) => setTimeout(r, 250));
    }
    check('speech: "Hear it again" asks the voice to say the card', said > 0);
    check('speech: the voice started (the utterance\'s start event)', started > 0);
  } else check('no ja-JP voice: the listening item shows its reading instead', true);

  const choice = (t) => page.locator('.quiz .choices .choice:not(:disabled)', { hasText: new RegExp(`^${t}$`) }).first();
  const play = async (lesson, name) => {
    const wide = [];
    for (const [i, item] of lesson.items.entries()) {
      if (i) await shot(`${name}-item${i}-${item.type}${item.listen ? '-listen' : ''}`);
      if (item.type === 'pick') await touch(choice(item.answer));
      if (item.type === 'pairs') for (const [l, r] of item.pairs) { await touch(choice(l)); await touch(choice(r)); }
      if (item.type === 'build') for (const t of item.answer) await touch(choice(t));
      if (item.type !== 'teach') await shot(`${name}-item${i}-answered`);
      // Nothing on the card or among the tiles reaches past the screen's edges, or out of its own box.
      wide.push(...await page.evaluate((id) => [...document.querySelectorAll('.quiz .card *, .quiz .choice')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width && (r.left < 0 || r.right > innerWidth || e.scrollWidth > e.clientWidth + 1);
      }).map((e) => `${id}: ${e.className} "${e.textContent.trim()}"`), item.id));
      await touch(btn('Continue', { exact: true }));
    }
    check(`${name}: nothing overflows`, !wide.length, wide.slice(0, 3).join('; '));
    await shot(`${name}-summary`);
    check(`${name}: right first time all through`, await page.getByText(/(\d+) of \1 right first try/).count() > 0);
    await touch(btn('Continue', { exact: true })); await shot(`${name}-home-after`);
  };
  await play(lesson, 'first');

  for (const id of ['t1', 'se2']) {
    const later = course.units.flatMap((u) => u.lessons).find((l) => l.id === id);
    await seed({ start: {}, done: before(id) });
    await touch(btn('Japanese'));
    await touch(btn(`Continue · ${later.title}`)); await run(400);
    await play(later, id);
  }
};
