/**
 * How long sessions get: plays every lesson and checkpoint of each Learn course, in path order, for
 * a learner who misses a fixed share of answers, through the real rules in src/repeat.js and
 * src/adapt.js. `node tools/sessions.js` prints the table; test/sessions.test.js holds the bound.
 * A session's length is its screens, teach cards included.
 */
import { pathToFileURL } from 'node:url';
import { flying, GOES, misses, noteAnswer, struggling, warmedLast, easier } from '../src/adapt.js';
import { CHECKPOINT, ECHOES, WARM_UPS, checkpoint, comeBack, dropEchoes, echoes, fresh, marked, warmUps } from '../src/repeat.js';
import { subjects } from '../src/subjects.js';

export const LEARNERS = [['all right', 0], ['misses 30%', 0.3], ['misses 60%', 0.6]];

const seeded = (seed) => () => { // mulberry32
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** One learner's walk down one course: the screens in each session, `{ lessons, checkpoints }`. */
function walk(subject, miss, random) {
  const key = (item) => `${subject.id}:${item.id}`;
  const inCourse = (k) => k.startsWith(`${subject.id}:`);
  const lengths = { lessons: [], checkpoints: [] };
  const cards = {};
  let log = { answers: [] };
  let day = 0;
  for (const unit of subject.units) {
    const unitKeys = new Set(unit.lessons.flatMap((l) => l.items.map(key)));
    const list = unit.lessons.filter((l) => !l.mix).flatMap((l) => l.items);
    for (const lesson of unit.lessons) {
      const missed = misses(log.answers);
      const weight = (item) => missed[key(item)] ?? 0;
      const entry = ({ item, source }, extra) => ({ key: key(source), item, source, ...extra });
      const queue = lesson.mix
        ? checkpoint(subject, lesson.items, random, CHECKPOINT, weight).map((e) => entry(e))
        : [
          ...warmUps(cards, inCourse, lesson.items.map(key), WARM_UPS, missed, warmedLast(log.answers, inCourse, WARM_UPS))
            .map((k) => { const source = subject.units.flatMap((u) => u.lessons).flatMap((l) => l.items).find((i) => key(i) === k); return entry({ item: source, source }, { warm: true }); }),
          ...lesson.items.map((item) => entry({ item, source: item })),
          ...echoes(subject, lesson.items, random, flying(log.answers, inCourse) ? 1 : ECHOES, weight).map((e) => entry(e, { echo: true })),
        ];
      let eased = false;
      for (let at = 0; at < queue.length; at++) {
        const e = queue[at];
        if (!marked(e.item)) continue;
        const right = random() >= miss;
        comeBack(queue, at, e, right, () => fresh(subject, e.source, random), GOES);
        log = noteAnswer(log, { key: e.key, right, ms: 1, warm: e.warm && !e.retry });
        cards[e.key] ??= { due: new Date(2026, 0, ++day).toISOString() };
        if (!right && !eased && unitKeys.has(e.key) && struggling(log.answers, (k) => unitKeys.has(k))) {
          eased = true;
          dropEchoes(queue, at + 1);
          const smaller = easier(list, e.source);
          queue.splice(at + 1, 0, { item: { type: 'teach' } }, ...(smaller ? [{ key: key(smaller), item: smaller, source: smaller, echo: true, once: true }] : []));
        }
      }
      (lesson.mix ? lengths.checkpoints : lengths.lessons).push(queue.length);
    }
  }
  return lengths;
}

const stats = (list) => {
  const a = [...list].sort((x, y) => x - y);
  return { mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p90: a[Math.floor(a.length * 0.9)], max: a.at(-1) };
};

/** Every Learn course by every learner: `[{ course, learner, lessons: stats, checkpoints: stats }]`. */
export function simulate(walks = 5) {
  const rows = [];
  for (const subject of subjects.filter((s) => s.kind === 'learn')) {
    for (const [learner, miss] of LEARNERS) {
      const all = { lessons: [], checkpoints: [] };
      for (let seed = 1; seed <= walks; seed++) {
        const one = walk(subject, miss, seeded(seed));
        all.lessons.push(...one.lessons);
        all.checkpoints.push(...one.checkpoints);
      }
      rows.push({ course: subject.id, learner, lessons: stats(all.lessons), checkpoints: stats(all.checkpoints) });
    }
  }
  return rows;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const r of simulate(10)) {
    const show = ({ mean, p90, max }) => `mean ${mean} p90 ${p90} max ${max}`;
    console.log(`${r.course.padEnd(9)} ${r.learner.padEnd(11)} lesson ${show(r.lessons).padEnd(24)} checkpoint ${show(r.checkpoints)}`);
  }
}
