// Plays Maths' lessons by real touch, as a learner would, and records what it finds (tools/play.js).
// A long scenario, so `npm run phone` with no name skips it. One unit at a time:
//   MATHS_UNIT=3 npm run phone -- maths-all          (1-9; unit n continues the progress unit n-1 saved)
//   MATHS_UNIT=1 MATHS_LESSONS=ten-0,ten-1-checkpoint ...   only those lessons
//   MATHS_SMALL=1080x1700 ...                         a short phone (under 700 px of page)
import { readFileSync } from 'node:fs';
import { toQuiz } from '../../src/maths/items.js';
import { withCheckpoint } from '../../src/repeat.js';
import { answerQuiz, answerShown } from '../../tools/play-quiz.js';
import { playCourse } from '../../tools/play.js';

const course = { id: 'maths', units: JSON.parse(readFileSync(new URL('../../src/data/maths.json', import.meta.url))).units.map(withCheckpoint) };

export default async (h) => {
  const seen = new Set();
  const only = process.env.MATHS_LESSONS?.split(',');
  await playCourse(h, {
    course, unit: +(process.env.MATHS_UNIT ?? 1), only, small: process.env.MATHS_SMALL,
    answer: async (h2, item) => { // the answer is worked out from the sum or the picture
      const q = toQuiz(item);
      // one look at each kind of picture, number line, sum with money and long sum, in each lesson family
      const kind = item.picture ? Object.keys(item.picture)[0] : item.type === 'line' ? 'line' : /\$/.test(item.show ?? '') ? 'money' : (item.show ?? '').length > 14 ? 'long' : null;
      await answerShown(h2, item, kind && `${item.id.split('-')[0]}-${kind}-${item.type}`, seen, (h3) => answerQuiz(h3, q));
      if (item.type === 'line') { // a right drop leaves one marker on the line, never a second
        await h.page.locator('.foot.show').waitFor();
        const markers = await h.page.locator('.numline .marker').evaluateAll((ms) => ms.filter((m) => m.checkVisibility()).length);
        h.check(`${item.id}: one marker on the line`, markers === 1, `${markers} seen`);
      }
    },
    parts: ['.bubble', '.pic', '.glyph', '.meaning', '.slots', '.numline', '.quiz .choices'],
    tray: ['.quiz .choices'],
  });
};
