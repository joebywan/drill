import chessCourse from './data/chess.json' with { type: 'json' };
import * as chess from './chess/exercise.js';

/**
 * The contract. A subject is a course plus one `mount(el, item, { say, done })` that plays a
 * single item. Course shape: { id, title, units: [{ title, lessons: [{ id, title, items }] }] },
 * and every item has a stable `id`. Home, lessons, XP, streak and review pick a subject up from
 * this list alone.
 */
export const subjects = [{ ...chessCourse, mount: chess.mount }];
