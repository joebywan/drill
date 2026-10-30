import { nextGo } from './adapt.js';
import { shuffle } from './quiz/items.js';

/**
 * What makes a session drill, pure: a lesson opens with a couple of earlier items, ends with a few
 * of its own again, and each unit ends in a checkpoint mixing the whole unit.
 *
 * A subject's `vary(item, random)` gives a fresh version of an item, so a repeat tests the idea and
 * not the memory of one puzzle. It returns the item itself when repeating it as written is still
 * worth doing and null when it isn't. `echoable(item)`, optional, keeps an item out of echoes though
 * it has a fresh version (a real-game puzzle: a mirror is fine days later, not five minutes later).
 * Everything here leaves the card key alone: a mirrored level still schedules the same card.
 */
export const WARM_UPS = 2;
export const ECHOES = 2;
export const CHECKPOINT = 8;
export const RETRIES = 5; // repeats of missed items in one session; after that they wait for review

/** A shuffle with the most-missed first (`weight` counts an item's misses). */
const hardFirst = (items, random, weight) => shuffle(items, random).sort((a, b) => weight(b) - weight(a));

export const marked = (item) => item.type !== 'teach';

/** The item to play on any repeat: a fresh version where the subject has one. */
export const fresh = (subject, item, random = Math.random) => subject.vary?.(item, random) ?? item;

/**
 * Which earlier cards open a lesson: the ones missed most, then closest to slipping; none from this
 * lesson, and none that opened the last one (`recent`).
 */
export function warmUps(cards, inCourse, lessonKeys, count = WARM_UPS, missed = {}, recent = []) {
  return Object.entries(cards)
    .filter(([key]) => inCourse(key) && !lessonKeys.includes(key) && !recent.includes(key))
    .sort(([k, a], [l, b]) => (missed[l] ?? 0) - (missed[k] ?? 0) || new Date(a.due) - new Date(b.due))
    .slice(0, count)
    .map(([key]) => key);
}

/** Fresh versions of a few of a lesson's items, for its end: `[{ item, source }]`. Not rescheduled. */
export function echoes(subject, items, random = Math.random, count = ECHOES, weight = () => 0) {
  if (!subject.vary) return [];
  return hardFirst(items.filter((i) => marked(i) && (subject.echoable?.(i) ?? true)), random, weight)
    .map((source) => ({ source, item: subject.vary(source, random) }))
    .filter(({ item }) => item)
    .slice(0, count);
}

/** Takes pending echoes out of a session's `queue` from `from` on: all of them, or just `key`'s. */
export function dropEchoes(queue, from, key) {
  for (let i = queue.length - 1; i >= from; i--) if (queue[i].echo && !queue[i].once && (!key || queue[i].key === key)) queue.splice(i, 1);
}

/**
 * After the answer at `at`: a miss drops that item's pending echo (its repeat does that job), and
 * a miss not yet landed comes back at the end as `remake()`, within GOES (`cap`) and RETRIES.
 * `once` entries never come back. True when a miss has run out of goes and is left for review.
 */
export function comeBack(queue, at, entry, clean, remake, cap) {
  if (clean === null || entry.once) return false;
  if (!clean) dropEchoes(queue, at + 1, entry.key);
  const go = nextGo(entry, clean, cap);
  if (go && queue.filter((e) => e.retry).length < RETRIES) {
    queue.push({ ...entry, ...go, retry: true, echo: false, item: remake() });
    return false;
  }
  return !clean;
}

/** A checkpoint's items: a mix from across its unit, fresh where the subject can. */
export const checkpoint = (subject, items, random = Math.random, count = CHECKPOINT, weight = () => 0) =>
  hardFirst(items, random, weight).slice(0, count).map((source) => ({ source, item: fresh(subject, source, random) }));

/** A unit's checkpoint lesson, or nothing for a unit too small to need one. It plays as a mix (`mix`). */
export function withCheckpoint(unit) {
  const items = unit.lessons.flatMap((l) => l.items).filter(marked);
  if (unit.lessons.length < 2 || items.length < CHECKPOINT / 2) return unit;
  return { ...unit, lessons: [...unit.lessons, { id: `${unit.lessons[0].id}-checkpoint`, title: 'Checkpoint', mix: true, items }] };
}
