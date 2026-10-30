import sets from '../data/events.json' with { type: 'json' };

/**
 * Seasonal events: about two weeks a year when the whole garden changes, worked out from the device's
 * date with no server. Pure. A hemisphere is six months apart, so an event always falls in its own
 * season (a Sydney winter festival is in July): the same `south` as season.js, set by the ⋯ screen's toggle.
 *
 * Each has a short set (src/data/events.json) played as an ordinary session through its subject's own
 * mount, with the lesson id `event:<id>`. Finishing it grants the gift, a landmark that stays all year
 * (model.js rules(), landmarks.js ART). Nothing is lost for missing one: it comes round every year,
 * and no screen says when it ends.
 *
 *   EVENTS                     [{ id, season, month, name, about, gift, sound, offer, text, keep, subject, title, items }]
 *                              `month` is the northern one, 1–12: the middle month of `season`
 *   eventOn(date, south) -> one of EVENTS or null, read in local time
 *   lessonOf(event) -> the id progress.done records it under
 */
const FIRST = 8, LAST = 21; // inclusive, the same days of the month every year

const about = (id, season, month, words) => ({ id, season, month, ...words, ...sets[id] });

export const EVENTS = [
  about('spring-market', 'spring', 4, {
    name: 'Spring market', about: 'Bunting over the garden and stalls on the hill. Ada has a few sums to settle.',
    gift: 'stall', sound: 'build', offer: 'Play it and a market stall stays in your garden.', text: 'A market stall stayed on in the garden', keep: 'The stall is yours to keep.',
  }),
  about('summer-tournament', 'summer', 7, {
    name: 'Park tournament', about: 'The lawn is mown in stripes and the boards are out. Rosa has four to play.',
    gift: 'pennant', sound: 'build', offer: 'Play them and a pennant stays in your garden.', text: 'A tournament pennant flies over the garden', keep: 'The pennant is yours to keep.',
  }),
  about('autumn-harvest', 'autumn', 10, {
    name: 'Harvest', about: 'Pumpkins in the grass and hay on the hill. Fennel could use some steps to follow.',
    gift: 'scarecrow', sound: 'build', offer: 'Help him and a scarecrow stays in your garden.', text: 'A scarecrow keeps watch over the garden', keep: 'The scarecrow is yours to keep.',
  }),
  about('winter-festival', 'winter', 1, {
    name: 'Winter festival', about: 'Snow on the hills and lights strung across the garden. Moss is by the lanterns, for five slow breaths.',
    gift: 'snowman', sound: 'lantern', offer: 'Sit a while and a snowman stays in your garden.', text: 'A snowman moved into the garden', keep: 'The snowman is yours to keep.',
  }),
];

export const lessonOf = (event) => `event:${event.id}`;

export function eventOn(date = new Date(), south = false) {
  const day = date.getDate();
  if (day < FIRST || day > LAST) return null;
  const month = date.getMonth() + 1;
  return EVENTS.find((e) => (south ? (e.month + 5) % 12 + 1 : e.month) === month) ?? null;
}
