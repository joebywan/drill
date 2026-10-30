/**
 * What makes a session drill, pure: a lesson opens with a couple of earlier items, ends with a few
 * of its own again, and each unit ends in a checkpoint mixing the whole unit.
 *
 * A subject's `vary(item, random)` gives a fresh version of an item, so a repeat tests the idea and
 * not the memory of one puzzle. It returns the item itself when repeating it as written is still
 * worth doing (a kana to read) and null when it isn't (a chess puzzle you'd just remember).
 * Everything here leaves the card key alone: a mirrored level still schedules the same card.
 */
export const WARM_UPS = 2;
export const ECHOES = 3;
export const CHECKPOINT = 8;

const shuffled = (list, random) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** A shuffle with the most-missed first (`weight` counts an item's misses). */
const hardFirst = (items, random, weight) => shuffled(items, random).sort((a, b) => weight(b) - weight(a));

export const marked = (item) => item.type !== 'teach';

/** The item to play on any repeat: a fresh version where the subject has one. */
export const fresh = (subject, item, random = Math.random) => subject.vary?.(item, random) ?? item;

/** Which earlier cards open a lesson: the ones missed most, then closest to slipping; none from this lesson. */
export function warmUps(cards, inCourse, lessonKeys, count = WARM_UPS, missed = {}) {
  return Object.entries(cards)
    .filter(([key]) => inCourse(key) && !lessonKeys.includes(key))
    .sort(([k, a], [l, b]) => (missed[l] ?? 0) - (missed[k] ?? 0) || new Date(a.due) - new Date(b.due))
    .slice(0, count)
    .map(([key]) => key);
}

/** Fresh versions of a few of a lesson's items, for its end: `[{ item, source }]`. Not rescheduled. */
export function echoes(subject, items, random = Math.random, count = ECHOES, weight = () => 0) {
  if (!subject.vary) return [];
  return hardFirst(items.filter(marked), random, weight)
    .map((source) => ({ source, item: subject.vary(source, random) }))
    .filter(({ item }) => item)
    .slice(0, count);
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
