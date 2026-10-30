# Habits

Agreed with Joseph on 2026-10-30. This is the active plan; `TODO.md` stays the backlog.

## The model

- **Everything in Drill is a habit, and each habit has its own streak.** Learning is one habit
  (any lesson or review in any course keeps it); Calm is the next; more follow.
- **Two kinds of subject feed habits.** A *Learn* subject teaches then tests, with right/wrong
  and spaced review. A *Practice* subject is a guided routine with a timer: no right or wrong,
  no review cards, and its path unlocks by turning up (cycles and reps grow), not by scoring.
- **A habit shows only once it has been started.** No empty streaks on the home bar. Hiding a
  habit keeps its history.
- **Each habit keeps the same forgiving streak rules** (one missed day in seven forgiven; a gap
  of up to three days repaired). Learning is repaired by a review; a practice habit by its
  next session.
- **The streak shows what you did.** Every session is logged (date, habit, what, minutes, and
  for practice an optional one-tap "how do you feel"). Tapping the streak line over a habit's path opens its view:
  this week as seven days with each day's sessions listed, "N of the last 14 days", and a month
  of filled squares. Days without a session are plain, never marked as missed.

## Tasks, in order

1. [x] **Habits model.** Progress v2: streaks keyed by habit, a session log, `migrate()` from v1
   (the old streak becomes Learning's; old sessions have no log). Subjects declare their habit
   and kind. Pure, tested with fixed dates.
2. [x] **Habit chips and the habit view.** One chip per started habit on the home bar, each
   with its own light; the habit view described above.
3. [x] **Practice engine.** A Practice subject's `mount()` runs a timed routine with a coach and
   calls `done()` when finished; the end screen asks "how do you feel?" as one optional tap.
4. [x] **Calm.** Its own coach character; 4-in-8-out breathing, 5-4-3-2-1 grounding and the
   bottom-to-top body scan, each taught once then practised, with cycles growing along the
   path. Guardrail tests: no claims to be therapy, no urgency, and a line pointing to real
   help (Lifeline 13 11 14).
5. [x] **Move.** Stretching, mobility and bodyweight sets with reps growing along the path.
   Needs a character who demonstrates moves. Guardrails: stop if anything hurts, check with a
   doctor for injuries, never push to do more. Clover demonstrates each move.
6. [x] **Reflect.** Three lines a day (one good thing, one thing learned, one for tomorrow),
   kept on the device, never read or scored. Lumi coaches; the lines live in progress v3's
   `journal`, never in the log, and only the habit view (the subject's `dayDetail`) and the file
   export read them.
7. [x] **Eyes and posture break.** A two-minute screen break: look far away, roll the
   shoulders, stand up.
8. [x] **Self-reported habits.** One tap to log things Drill can't guide (walked, read, drank
   water, went outside), then "add your own habit".
   Done: a third kind, 'log', with no path. `habitsFor(progress)` (subjects.js) is the habit list
   everywhere: the built-in HABITS, then the presets and the learner's own from progress v5's
   `tracked`. `logToday()` records a tap through `finishPractice`; `unlogToday()` undoes it the same
   day only, from the streak the entry kept (`was`), and never touches `earned`. The "+ Habit" tab
   opens the presets and "Make your own" (name, icon, plant: tulip, fern, cactus, rose, mushroom).
   Hiding takes a habit off the tabs and keeps its days and its plant.

Later: Wind down (a bedtime sequence built from Calm's pieces) and Focus (a timed focus
session with a check-in before and after).

## The garden (agreed 2026-10-30)

The app's vibe moves from "build knowledge" to "grow yourself", shown as a garden.

- **Each habit is a recognisable plant** in one garden. The suggestions are Learning as a
  tree, Calm as lavender, Move as a sunflower, Reflect as a climbing vine and Screen break as
  daisies; the art decides the final choice, by what reads at a glance.
- **Plants grow from total days practised, never from the current streak.** A plant never
  shrinks, wilts or dies. A missed day just means no growth that day. Five stages: seed,
  sprout, sapling, young, full grown. Later stages take more days, so a next stage is always
  coming.
- **Achievements are things that arrive and stay.** A flower when a unit is finished; a
  butterfly at a 7-day streak; birds at 30 days practised; a bee when a new habit is tried.
  Earned once, kept forever, never taken back. They're cosmetic and granted directly, as
  settled.
- **Today's light becomes the garden's mood.** Done today, it's sunlit and dewy. Not yet,
  it's soft morning light. After a gap, it's evening with the buds closed: resting, never sad.
- **Streak numbers stay** on the habit tabs and in the habit view. The garden is the picture; the
  numbers are the detail.
- **Characters are recognisable animals** (Moss the capybara, Clover the rabbit, Lumi the
  seal). Insects and birds are garden life, not coaches. No owls.
- Later: seasonal events that change the whole garden (blossom, lanterns), Lumi by a pond,
  and reconsidering the name "Drill".

9. [x] **Garden model.** Pure: days practised per habit (kept permanently, not from the
   year-long log), growth stage, achievement rules and an `earned` record, and the garden's
   mood. Progress v4 with `migrate()`.
   Done in `src/garden/model.js`: stages at 0/1/5/14/30 days, the `RULES` table, `award()`
   after each finish in app.js, and `garden()`, the one read model for the screen.
10. [x] **Garden art.** SVG plants per habit across five stages, flowers, visitors and the
    three moods, with a harness like tools/cast.html.
11. [x] **Garden screen.** A garden strip on home and a full garden view. Tapping a plant
    opens its habit view. A quiet "a butterfly arrived" moment on the end screen when
    something is earned.
    Done: `drawGarden()` and `perches()` in art.js draw the whole garden once per render;
    `gardenView()` in app.js; both end screens show `award()`'s `newly` (three lines, then
    "and N more"). Wording (`plantWords`, `moreArrived`) is in model.js and linted.

## Kept out

Diet, calories or weight (streaks plus food tracking can feed unhealthy patterns); screen-time
shaming; sleep tracking by numbers (Drill can't measure it honestly).
