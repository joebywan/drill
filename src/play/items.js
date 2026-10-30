/**
 * Item types any subject can play without a board, judged on every tap (no Check button). The
 * subject supplies the rules (`rules` in mount.js); this file is the pure part.
 *
 *   teach  { text }                               a card to read: not marked, not reviewed
 *   pick   { prompt, options }                    tap one of a few
 *   tiles  { prompt, extra? }                     build the answer from tiles, one at a time; the
 *                                                 tiles are its characters plus `extra` (default: two
 *                                                 more digits), shuffled the same way every time
 *   line   { prompt, min, max, ticks, unit? }     drag or tap a marker on a number line; it snaps
 *                                                 to the nearest of `ticks` equal steps
 *   pairs  { prompt, tiles }                      tap two tiles that go together until none are left
 *
 * Any item may carry the subject's own extras (a picture, a sum to show).
 */

/** A random-looking but fixed sequence in [0, 1) from a string: the same item always shuffles the same. */
function seeded(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 2 ** 32;
  };
}

export function shuffle(list, seed) {
  const next = seeded(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The tiles for a tiles item whose answer is `answer` (a string). */
export function tilesFor(item, answer) {
  const next = seeded(`${item.id}+`);
  const extra = item.extra ?? Array.from({ length: 2 }, () => String(Math.floor(next() * 10))).join('');
  return shuffle([...answer, ...extra], item.id);
}

/** One more tile on what is built so far: 'right', 'done' (that finished it) or 'wrong'. */
export function nextTile(answer, built, tile) {
  const now = built + tile;
  return !answer.startsWith(now) ? 'wrong' : now === answer ? 'done' : 'right';
}

/** The value of tick `k` on a line item. */
export const tick = (item, k) => item.min + (k * (item.max - item.min)) / item.ticks;

/** The tick nearest to `at`, a fraction of the way along the line (clamped to the ends). */
export const nearestTick = (item, at) => Math.round(Math.min(1, Math.max(0, at)) * item.ticks);

/**
 * Whether every tile can be paired off by `together(a, b)`. Tries each partner for the first tile
 * (pairs items are a handful of tiles, so this stays tiny).
 */
export function clears(tiles, together) {
  if (!tiles.length) return true;
  const [first, ...rest] = tiles;
  return rest.some((t, i) => together(first, t) && clears(rest.filter((_, j) => j !== i), together));
}
