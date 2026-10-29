import chessCourse from './data/chess.json' with { type: 'json' };
import forks from './data/forks.json' with { type: 'json' };
import * as chess from './chess/exercise.js';

/**
 * The contract. A subject is a course plus one `mount(el, item, { say, done })` that plays a
 * single item (see src/chess/exercise.js). Course shape: { id, title, units: [{ title, lessons: [{ id, title, items }] }] },
 * and every item has a stable `id`. Home, lessons, XP, streak and review pick a subject up from
 * this list alone.
 */
// Forks leads: it is the hand-written pilot unit; the Lichess themes follow it.
export const subjects = [{ ...chessCourse, units: [forks, ...chessCourse.units], mount: chess.mount }];
