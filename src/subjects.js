import chessCourse from './data/chess.json' with { type: 'json' };
import basics from './data/basics.json' with { type: 'json' };
import forks from './data/forks.json' with { type: 'json' };
import calmCourse from './data/calm.json' with { type: 'json' };
import reflectCourse from './data/reflect.json' with { type: 'json' };
import * as chess from './chess/exercise.js';
import { rosa } from './cast/rosa.js';
import { moss, NAME as MOSS } from './cast/moss.js';
import * as calm from './calm/practice.js';
import breakCourse from './data/break.json' with { type: 'json' };
import * as screenBreak from './break/practice.js';
import { STEPS as BREAK_STEPS } from './break/routines.js';
import { lumi } from './cast/lumi.js';
import { BREAK_LINES, CALM_HELP, CALM_LINES, MOVE_LINES, MOVE_SAFETY, REFLECT_LINES, SAFETY_LINE, WINDDOWN_LINES, FOCUS_LINES } from './cast/lines.js';
import winddownCourse from './data/winddown.json' with { type: 'json' };
import * as winddown from './winddown/practice.js';
import * as reflect from './reflect/practice.js';
import moveCourse from './data/move.json' with { type: 'json' };
import * as move from './move/practice.js';
import { clover, demo as cloverDemo, NAME as CLOVER } from './cast/clover.js';
import { mira, demo as miraDemo, NAME as MIRA } from './cast/mira.js';
import japaneseCourse from './data/japanese.json' with { type: 'json' };
import * as quiz from './quiz/exercise.js';
import { kaede, NAME as KAEDE } from './cast/kaede.js';
import { KAEDE_HEADLINES, KAEDE_LINES } from './cast/lines.js';
import focusCourse from './data/focus.json' with { type: 'json' };
import * as focus from './focus/practice.js';
import { hazel, NAME as HAZEL } from './cast/hazel.js';

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
 * lines (default: Rosa's LINES) and, for a practice habit, its help line { text, tel?, call? },
 * shown on a teach card that asks for it and after "Not really" (rendered by practice/kit.js helpHtml),
 * `feel`, the good answer to "How do you feel?" (default 'calmer'; its reply is a key in `lines`), `ask`, that
 * question in the habit's own words (Focus: "How did it go?"),
 * and `demonstrates`, for a coach the learner copies, which is drawn large above their line.
 * A Learn coach's `lines` and `headlines` stand in for Rosa's LINES and HEADLINES (same kinds).
 * Sessions and both end screens read everything subject-specific from here.
 *
 * Optional: `again`, { label, lesson }: once the path is done, home keeps a button with that label
 * which runs that lesson again ("Reflect today", "Breathe"); `dayDetail(progress, date)`, extra html under a day's sessions
 * in the habit view (Reflect's own lines); `placement`, { offer, question, options: [[label, unitTitle]] }:
 * an optional question home offers by the subject's path (`offer` is the link) to start further on;
 * `varied`, { key: [values] }: a timing marked `varies` in TIMINGS, as the routine has it per step.
 * It never stands in the way: answering opens the path at that unit, dismissing it hides the offer.
 * `timings`, another habit's id whose own timings this subject plays by (Wind down plays Calm's);
 * `night`, the session and its end screen in the dim night palette whatever the theme.
 *
 * Several Learn subjects (courses) share the Learning habit: home shows one course's path at a
 * time, with a switcher between them (app.js).
 */
/** The built-in habits, in the order the home bar shows them. `habitsFor(progress)` adds the learner's own. */
export const HABITS = [
  { id: 'learn', name: 'Learning', icon: '🔥' },
  { id: 'calm', name: 'Calm', icon: '🌿' },
  { id: 'break', name: 'Screen break', icon: '👀' },
  { id: 'reflect', name: 'Reflect', icon: '📓' },
  { id: 'move', name: 'Move', icon: '🌱' },
  { id: 'winddown', name: 'Wind down', icon: '🌙' },
  { id: 'focus', name: 'Focus', icon: '⏳' },
];

/**
 * Self-reported habits (kind 'log'): no lessons and no path, one tap says "yes, today". The learner
 * picks presets from PRESETS and makes their own, kept in `progress.tracked` (see progress.js).
 * `did` is the big button, `title` the log entry, `plant` the garden's drawing (art.js).
 */
export const PRESETS = [
  { id: 'walk', name: 'Walk', icon: '🚶', plant: 'tulip', did: 'I walked today', title: 'Walked' },
  { id: 'read', name: 'Read', icon: '📖', plant: 'fern', did: 'I read today', title: 'Read' },
  { id: 'water', name: 'Water', icon: '💧', plant: 'rose', did: 'I drank water today', title: 'Drank water' },
  { id: 'outside', name: 'Outside', icon: '🌤️', plant: 'cactus', did: 'I went outside today', title: 'Went outside' },
];
/** What a habit of the learner's own can look like. The first of each is the default. */
export const OWN_ICONS = ['⭐', '🧘', '🎵', '🎨', '🧹', '🦷', '☕', '💛'];
export const OWN_PLANTS = ['tulip', 'fern', 'cactus', 'rose', 'mushroom'];
export const OWN_DID = 'Done today';

/**
 * Every habit for this learner, in tab order: the built-in HABITS, then each tracked log habit in
 * the order it was added, as { id, name, icon, kind: 'log', plant, did, title, hidden? }. Hidden
 * ones are kept (their plant and history stay); only the tabs leave them out. An entry that is
 * neither a preset nor has a name of its own, or that reuses a built-in id, is skipped.
 */
export function habitsFor(progress) {
  const own = (progress?.tracked || []).filter((t) => !HABITS.some((h) => h.id === t.id)).map((t) => {
    const preset = PRESETS.find((x) => x.id === t.id);
    if (preset) return { ...preset, hidden: !!t.hidden };
    if (!t.name) return null;
    return {
      id: t.id, name: t.name, icon: OWN_ICONS.includes(t.icon) ? t.icon : OWN_ICONS[0],
      plant: OWN_PLANTS.includes(t.plant) ? t.plant : OWN_PLANTS[0], did: OWN_DID, title: t.name, hidden: !!t.hidden, own: true,
    };
  }).filter(Boolean);
  return [...HABITS, ...own.map((h) => ({ ...h, kind: 'log' }))];
}

/**
 * `list` (habitsFor's) with the ids the learner picked in the intro first, in the order picked, then
 * the rest as they were. An id no longer in the list is passed over. The one place home is ordered.
 */
export const ordered = (list, picked = []) => [
  ...picked.map((id) => list.find((h) => h.id === id)).filter(Boolean),
  ...list.filter((h) => !picked.includes(h.id)),
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
  placement: {
    offer: 'Know some chess already? Skip ahead',
    question: 'Have you played chess before?',
    options: [
      ["I've never played", 'The board'],
      ['I know how the pieces move', 'Capturing'],
      ['I play now and then', 'Forks'],
      ['I play often and know some tactics', 'Mate in one'],
    ],
  },
}, {
  // Hiragana from zero, played with the generic tap-and-match items in src/quiz/.
  ...japaneseCourse,
  mount: (el, item, ctx) => quiz.mount(el, item, { ...ctx, lang: japaneseCourse.lang }),
  habit: 'learn',
  kind: 'learn',
  coach: { draw: kaede, name: KAEDE, start: 'think', lines: KAEDE_LINES, headlines: KAEDE_HEADLINES },
  placement: {
    offer: 'Read some kana already? Skip ahead',
    question: 'Can you read hiragana?',
    options: [
      ['Not a single one', 'Vowels'],
      ['I know あいうえお', 'K and S'],
      ['I can read the k and s rows', 'First words'],
    ],
  },
}, {
  ...calmCourse,
  mount: calm.mount,
  habit: 'calm',
  kind: 'practice',
  coach: { draw: moss, name: MOSS, start: 'guide', lines: CALM_LINES, help: CALM_HELP },
}, {
  ...breakCourse,
  mount: screenBreak.mount,
  habit: 'break',
  varied: { seconds: BREAK_STEPS.map((s) => s.seconds) },
  kind: 'practice',
  coach: { draw: mira, demo: miraDemo, name: MIRA, start: 'guide', lines: BREAK_LINES, help: { text: SAFETY_LINE }, feel: 'refreshed', demonstrates: true },
}, {
  ...reflectCourse,
  mount: reflect.mount,
  dayDetail: reflect.dayDetail,
  habit: 'reflect',
  kind: 'practice',
  coach: { draw: lumi, name: 'Lumi', start: 'teach', lines: REFLECT_LINES, help: CALM_HELP, feel: 'clearer' },
}, {
  ...moveCourse,
  mount: move.mount,
  habit: 'move',
  kind: 'practice',
  coach: { draw: clover, demo: cloverDemo, name: CLOVER, start: 'guide', lines: MOVE_LINES, help: { text: MOVE_SAFETY }, feel: 'better', demonstrates: true },
}, {
  ...focusCourse,
  mount: focus.mount,
  dayDetail: focus.dayDetail,
  habit: 'focus',
  kind: 'practice',
  coach: { draw: hazel, name: HAZEL, start: 'guide', lines: FOCUS_LINES, feel: 'focused', ask: 'How did it go?' },
}, {
  ...winddownCourse,
  mount: winddown.mount,
  habit: 'winddown',
  kind: 'practice',
  timings: 'calm',
  night: true,
  coach: { draw: moss, name: MOSS, start: 'sleepy', lines: WINDDOWN_LINES, help: CALM_HELP, feel: 'settled' },
}];
