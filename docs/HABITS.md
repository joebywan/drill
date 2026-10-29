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
  for practice an optional one-tap "how do you feel"). Tapping a habit's chip opens its view:
  this week as seven days with each day's sessions listed, "N of the last 14 days", and a month
  of filled squares. Days without a session are plain, never marked as missed.

## Tasks, in order

1. [ ] **Habits model.** Progress v2: streaks keyed by habit, a session log, `migrate()` from v1
   (the old streak becomes Learning's; old sessions have no log). Subjects declare their habit
   and kind. Pure, tested with fixed dates.
2. [ ] **Habit chips and the habit view.** One chip per started habit on the home bar, each
   with its own light; the habit view described above.
3. [x] **Practice engine.** A Practice subject's `mount()` runs a timed routine with a coach and
   calls `done()` when finished; the end screen asks "how do you feel?" as one optional tap.
4. [x] **Calm.** Its own coach character; 4-in-8-out breathing, 5-4-3-2-1 grounding and the
   bottom-to-top body scan, each taught once then practised, with cycles growing along the
   path. Guardrail tests: no claims to be therapy, no urgency, and a line pointing to real
   help (Lifeline 13 11 14).
5. [ ] **Move.** Stretching, mobility and bodyweight sets with reps growing along the path.
   Needs a character who demonstrates moves. Guardrails: stop if anything hurts, check with a
   doctor for injuries, never push to do more.
6. [ ] **Reflect.** Three lines a day (one good thing, one thing learned, one for tomorrow),
   kept on the device, never read or scored.
7. [ ] **Eyes and posture break.** A two-minute screen break: look far away, roll the
   shoulders, stand up.
8. [ ] **Self-reported habits.** One tap to log things Drill can't guide (walked, read, drank
   water, went outside), then "add your own habit".

Later: Wind down (a bedtime sequence built from Calm's pieces) and Focus (a timed focus
session with a check-in before and after).

## Kept out

Diet, calories or weight (streaks plus food tracking can feed unhealthy patterns); screen-time
shaming; sleep tracking by numbers (Drill can't measure it honestly).
