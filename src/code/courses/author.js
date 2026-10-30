/**
 * Shorthand for writing a code course: each course file is data, one line per item, and item ids come
 * from the lesson and the place in it. Add new items at a lesson's end, so a card keeps its key.
 * See src/code/items.js for what each item is.
 */
import { CONSTRUCTS, WALK_API, chunksFor } from '../items.js';

export const lesson = (id, title, items) => ({ id, title, items: items.map((item, i) => ({ id: `${id}-${i + 1}`, ...item })) });
export const unit = (title, ...lessons) => ({ title, lessons });

/** A card: words, and code to look at (and any it prints). */
export const T = (text, code, extra) => ({ type: 'teach', text, ...(code && { code }), ...extra });
/** Build it from nothing so it prints what `way` prints. */
export const P = (way, prompt, explain, decoys, extra) => ({ type: 'build', goal: 'print', way, prompt, explain, ...(decoys && { decoys }), ...extra });
/** Fill the ___ holes so it prints what the filled code prints. */
export const G = (code, fill, prompt, explain, decoys, extra) => ({ type: 'gap', goal: 'print', code, fill, prompt, explain, ...(decoys && { decoys }), ...extra });
/** Build it from nothing so Fennel reaches the flower. */
export const W = (level, way, prompt, explain, decoys, extra) => ({ type: 'build', goal: 'walk', level, way, prompt, explain, ...(decoys && { decoys }), ...extra });
/** Fill the holes so Fennel reaches the flower. */
export const WG = (level, code, fill, prompt, explain, decoys, extra) => ({ type: 'gap', goal: 'walk', level, code, fill, prompt, explain, ...(decoys && { decoys }), ...extra });
/** Build a function `name` that passes the hidden `cases`, [[args, want], ...]. */
export const R = (name, cases, way, prompt, explain, decoys, extra) => ({ type: 'build', goal: 'returns', name, cases, way, prompt, explain, ...(decoys && { decoys }), ...extra });
/** Fill the holes of a function `name` that passes the hidden `cases`. */
export const RG = (name, cases, code, fill, prompt, explain, decoys, extra) => ({ type: 'gap', goal: 'returns', name, cases, code, fill, prompt, explain, ...(decoys && { decoys }), ...extra });
/** What does this print? */
export const Q = (code, wrong, explain, extra) => ({ type: 'predict', code, wrong, explain, ...extra });

/**
 * Sets each build's chips in path order: a construct is single tokens the first time it is built (the
 * item's `learns` says which), and one chip from then on. `known` is what a course may assume at its start.
 */
export function coarsened(course, known = []) {
  const seen = new Set(known);
  for (const u of course.units) for (const l of u.lessons) {
    l.items = l.items.map((item) => {
      if (item.type !== 'build') return item;
      const { chunks, used } = chunksFor(item.way, seen, item.decoys);
      const learns = [...used].filter((k) => !seen.has(k));
      learns.forEach((k) => seen.add(k));
      const all = [...(item.chunks ?? []), ...chunks];
      const decoys = item.decoys?.flatMap((d) => (d === '--' && seen.has('for') ? [] : WALK_API.includes(d) && all.some((c) => c.endsWith('();')) ? [`${d}();`] : [d])); // a decoy in the shape of the chips around it
      return { ...item, chunks: all, ...(decoys && { decoys }), ...(learns.length && { learns }) };
    });
  }
  return course;
}
/** For a course that follows JavaScript: all of its syntax is known. */
export const AFTER_JS = CONSTRUCTS.filter((k) => !['label', 'test'].includes(k));
