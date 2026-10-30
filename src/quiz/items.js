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

const unique = (list) => new Set(list).size === list.length;

/** Why an item can't ship, or null. Every shipped item passes this (see test/quiz.test.js). */
export function problem(item) {
  if (!item.id) return 'no id';
  if (item.type !== 'teach' && !item.explain) return 'no explanation';
  switch (item.type) {
    case 'teach': return item.show && item.text ? null : 'teach needs show and text';
    case 'pick':
      if (!item.show || !item.prompt) return 'pick needs show and a prompt';
      if (!Array.isArray(item.options) || item.options.length < 2 || !unique(item.options)) return 'pick needs two or more different options';
      if (item.listen && !item.speak) return 'listen needs speak';
      return item.options.filter((o) => picked(item, o)).length === 1 ? null : 'exactly one option must be the answer';
    case 'pairs': {
      const [ls, rs] = [0, 1].map((side) => (item.pairs || []).map((p) => p[side]));
      if (ls.length < 2) return 'pairs needs two or more pairs';
      return unique(ls) && unique(rs) ? null : 'each side of the pairs must be different';
    }
    case 'build':
      if (!item.show || !item.prompt || !item.answer?.length) return 'build needs show, a prompt and an answer';
      return (item.tiles || []).some((t) => item.answer.includes(t)) ? 'a decoy is also in the answer' : null;
    default: return `unknown type ${item.type}`;
  }
}
