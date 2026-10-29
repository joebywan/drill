import chessCourse from './data/chess.json' with { type: 'json' };
import basics from './data/basics.json' with { type: 'json' };
import forks from './data/forks.json' with { type: 'json' };
import * as chess from './chess/exercise.js';

/**
 * The contract. A subject is a course plus one `mount(el, item, { say, done })` that plays a
 * single item (see src/chess/exercise.js). Course shape: { id, title, units: [{ title, lessons: [{ id, title, items }] }] },
 * and every item has a stable `id`. Home, lessons, streak and review pick a subject up from
 * this list alone.
 */
// Chess from zero comes first (the board, how pieces move, capturing, check and mate), then the
// hand-written Forks unit, whose Lichess puzzles join it as its last lessons; the other Lichess
// themes follow.
const lichessForks = chessCourse.units.find((u) => u.title === 'Forks');
const forksUnit = {
  ...forks,
  lessons: [...forks.lessons, ...lichessForks.lessons.map((l) => ({ ...l, title: `Real games: ${l.title}` }))],
};
export const subjects = [{
  ...chessCourse,
  units: [...basics.units, forksUnit, ...chessCourse.units.filter((u) => u !== lichessForks)],
  mount: chess.mount,
}];
