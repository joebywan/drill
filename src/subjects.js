import chessCourse from './data/chess.json' with { type: 'json' };
import basics from './data/basics.json' with { type: 'json' };
import forks from './data/forks.json' with { type: 'json' };
import calmCourse from './data/calm.json' with { type: 'json' };
import reflectCourse from './data/reflect.json' with { type: 'json' };
import * as chess from './chess/exercise.js';
import { rosa } from './cast/rosa.js';
import { moss, NAME as MOSS } from './cast/moss.js';
import { CALM_LINES } from './cast/lines.js';
import { helpHtml } from './calm/practice.js';
import * as calm from './calm/practice.js';
import breakCourse from './data/break.json' with { type: 'json' };
import * as screenBreak from './break/practice.js';
import { lumi } from './cast/lumi.js';
import { BREAK_LINES } from './cast/lines.js';
import * as reflect from './reflect/practice.js';
import { REFLECT_LINES } from './cast/lines.js';

/**
 * The contract. A subject is a course plus one `mount(el, item, { say, done })` that plays a
 * single item (see src/chess/exercise.js). Course shape: { id, title, units: [{ title, lessons: [{ id, title, items }] }] },
 * and every item has a stable `id`. Home, lessons, streak and review pick a subject up from
 * this list alone.
 *
 * Every subject feeds one habit (`habit`, an id from HABITS) and is one of two kinds: 'learn'
 * (teach then test, right or wrong, spaced review) or 'practice' (a guided routine with no right
 * or wrong and no review; finishing it is the point). See docs/HABITS.md.
 *
 * `coach` is who runs the subject's sessions: { draw, name, start, lines?, help? } — the
 * character (rosa, moss…), its name for screen readers, the mood an item starts in, its own
 * lines (default: Rosa's LINES) and, for a practice habit, the help shown after "Not really".
 * Sessions and the practice end screen read everything subject-specific from here.
 *
 * Optional: `again`, the label of a button home shows once the path is done, to run its last
 * lesson again ("Reflect today"); `dayDetail(progress, date)`, extra html under a day's sessions
 * in the habit view (Reflect's own lines).
 */
/** Every habit, in the order the home bar shows them. A habit appears once it has a session (Learning always). */
export const HABITS = [
  { id: 'learn', name: 'Learning', icon: '🔥' },
  { id: 'calm', name: 'Calm', icon: '🌿' },
  { id: 'break', name: 'Screen break', icon: '👀' },
  { id: 'reflect', name: 'Reflect', icon: '📓' },
];

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
  habit: 'learn',
  kind: 'learn',
  coach: { draw: rosa, name: 'Rosa', start: 'think' },
}, {
  ...calmCourse,
  mount: calm.mount,
  habit: 'calm',
  kind: 'practice',
  coach: { draw: moss, name: MOSS, start: 'guide', lines: CALM_LINES, help: helpHtml },
}, {
  ...breakCourse,
  mount: screenBreak.mount,
  habit: 'break',
  kind: 'practice',
  coach: { draw: lumi, name: 'Lumi', start: 'teach', lines: BREAK_LINES, help: screenBreak.safetyHtml },
}, {
  ...reflectCourse,
  mount: reflect.mount,
  dayDetail: reflect.dayDetail,
  habit: 'reflect',
  kind: 'practice',
  coach: { draw: lumi, name: 'Lumi', start: 'teach', lines: REFLECT_LINES, help: helpHtml },
}];
