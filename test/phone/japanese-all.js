// Plays Japanese's lessons by real touch, as a learner would, and records what it finds (tools/play.js).
// A long scenario, so `npm run phone` with no name skips it. One unit at a time:
//   JAPANESE_UNIT=3 npm run phone -- japanese-all          (1-11; unit n continues the progress unit n-1 saved)
//   JAPANESE_UNIT=1 JAPANESE_LESSONS=vowels-0,... ...      only those lessons
//   JAPANESE_SMALL=1080x1700 ...                           a short phone (under 700 px of page)
// Also checks that a card with a sound speaks when it is shown (speechSynthesis.speak is called with its
// text; and, when the phone has a ja-JP voice, a stream is started in `dumpsys audio`, as japanese.js does).
import { readFileSync } from 'node:fs';
import { withCheckpoint } from '../../src/repeat.js';
import { answerQuiz, answerShown } from '../../tools/play-quiz.js';
import { playCourse } from '../../tools/play.js';
import { recordSpeech, streamStarted } from '../../tools/sound.js';

const course = { id: 'japanese', units: JSON.parse(readFileSync(new URL('../../src/data/japanese.json', import.meta.url))).units.map(withCheckpoint) };

export default async (h) => {
  const { page, adb, check } = h;
  const only = process.env.JAPANESE_LESSONS?.split(',');
  await page.addInitScript(recordSpeech); // what the page asks the voice to say, kept across the reloads a seed makes
  const voiced = await page.evaluate(() => speechSynthesis.getVoices().some((v) => /^ja/i.test(v.lang)));
  console.log(`  ja voice: ${voiced ? 'yes' : 'none (readings are shown instead)'}`);
  const seen = new Set();
  const silent = [];
  let cards = 0, streams = 0;
  await playCourse(h, {
    course, unit: +(process.env.JAPANESE_UNIT ?? 1), only, small: process.env.JAPANESE_SMALL,
    answer: async (h2, item) => {
      if (item.type === 'teach' && item.speak && voiced) {
        cards++;
        let heard = false;
        for (let i = 0; i < 6 && !heard; i++) { heard = streamStarted(adb); if (!heard) await new Promise((r) => setTimeout(r, 150)); }
        if (heard) streams++;
        if (!(await page.evaluate((t) => window.__spoken.includes(t), item.speak))) silent.push(item.id);
      }
      const text = `${item.show ?? ''}${item.answer ?? ''}`; // one look at each kind of card, in each unit
      const key = [item.type, item.listen && 'listen', /[っゃゅょ]/.test(text) && 'small', /[がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ]/.test(text) && 'voiced', item.read?.length > 12 && 'long'].filter(Boolean).join('-');
      await answerShown(h2, item, key, seen);
      await page.evaluate(() => { window.__spoken = []; }); // a pick speaks its answer: not to be taken for the next card's sound
    },
    parts: ['.bubble', '.glyph', '.reading', '.meaning', '.slots', '.quiz .choices'],
    tray: ['.quiz .choices'],
  });
  if (voiced) {
    console.log(`  sound: ${cards} cards with a sound, ${streams} caught with a stream started`);
    check('every card with a sound speaks when shown', !silent.length, silent.slice(0, 5).join(', '));
  }
};
