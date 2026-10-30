/**
 * Item types for any course where the learner taps answers rather than moving pieces: a glyph to
 * learn, a sound or a word. Pure, so tests can check every shipped item. Course-free: Japanese
 * uses them now; any language, script or vocabulary course can.
 *
 *   teach  { show, read?, speak?, text }               a big glyph or word, its reading, the coach's explanation
 *   pick   { show, speak?, listen?, prompt, options, answer, explain }
 *          pick the one option that goes with what is shown; `listen` plays `speak` instead of
 *          showing `show`, when the browser has a voice (else `show` is shown, so it still works)
 *   pairs  { prompt, pairs: [[left, right]], explain }  match each left to its right
 *   build  { show, speak?, prompt, answer: [tile], tiles: [extra tile], explain }
 *          tap tiles in order to build the answer; `tiles` are the decoys
 *   line   { show?, prompt, min, max, ticks, unit?, answer, explain }
 *          drag (or tap) a marker on a number line; it snaps to the nearest of `ticks` equal steps,
 *          and letting go answers. `answer` is a number on one of the ticks
 *
 * Any item may carry a `picture` instead of (or as well as) `show`: the course draws it, through the
 * mount's `ctx.art(picture)` (maths' ten frames and fraction bars).
 *
 * Every item is judged on the tap that answers it: no Check button.
 */

/** A copy of `list` in random order (Fisher-Yates). `rand` is for tests. */
export function shuffle(list, rand = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A pick's tap is right when it is the answer. */
export const picked = (item, option) => option === item.answer;

/** Two taps in a pairs item belong together: `left` from the left column, `right` from the right. */
export const paired = (item, left, right) => item.pairs.some(([l, r]) => l === left && r === right);

/** The tile a build item needs next, `at` tiles in. */
export const nextTile = (item, at) => item.answer[at];

/** What a build item lays out to tap: the answer's tiles and the decoys, shuffled. */
export const tilesOf = (item, rand) => shuffle([...item.answer, ...(item.tiles || [])], rand);

/** The value of tick `k` on a line item. */
export const tick = (item, k) => item.min + (k * (item.max - item.min)) / item.ticks;

/** The tick nearest to `at`, a fraction of the way along the line (clamped to the ends). */
export const nearestTick = (item, at) => Math.round(Math.min(1, Math.max(0, at)) * item.ticks);

/** A value on the line is the answer (to rounding: 1/3 of the way is never exactly 0.333…). */
export const onLine = (item, v) => Math.abs(v - item.answer) < 1e-9;

const unique = (list) => new Set(list).size === list.length;

/** Why an item can't ship, or null. Every shipped item passes this (see test/quiz.test.js). */
export function problem(item) {
  if (!item.id) return 'no id';
  if (item.type !== 'teach' && !item.explain) return 'no explanation';
  switch (item.type) {
    case 'teach': return (item.show || item.picture) && item.text ? null : 'teach needs show and text';
    case 'pick':
      if (!(item.show || item.picture) || !item.prompt) return 'pick needs show and a prompt';
      if (!Array.isArray(item.options) || item.options.length < 2 || !unique(item.options)) return 'pick needs two or more different options';
      if (item.listen && !item.speak) return 'listen needs speak';
      return item.options.filter((o) => picked(item, o)).length === 1 ? null : 'exactly one option must be the answer';
    case 'pairs': {
      const [ls, rs] = [0, 1].map((side) => (item.pairs || []).map((p) => p[side]));
      if (ls.length < 2) return 'pairs needs two or more pairs';
      return unique(ls) && unique(rs) ? null : 'each side of the pairs must be different';
    }
    case 'build':
      if (!(item.show || item.picture) || !item.prompt || !item.answer?.length) return 'build needs show, a prompt and an answer';
      return (item.tiles || []).some((t) => item.answer.includes(t)) ? 'a decoy is also in the answer' : null;
    case 'line': {
      if (!item.prompt || !Number.isInteger(item.ticks) || item.ticks < 2 || !(item.max > item.min)) return 'line needs a prompt, min < max and two or more ticks';
      const n = Array.from({ length: item.ticks + 1 }, (_, k) => tick(item, k)).filter((v) => onLine(item, v)).length;
      return n === 1 ? null : 'the answer must be on exactly one tick';
    }
    default: return `unknown type ${item.type}`;
  }
}
