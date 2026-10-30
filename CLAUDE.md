# Drill — working notes for Claude

A Duolingo-style learning app: lessons that teach, a cast of characters, a streak, review.
Static page, vanilla ES modules, no build step, no server. Chess is live; maths, Japanese,
JavaScript, TypeScript and TS test-writing are planned.

**Read the cast brief before building anything:** https://claude.ai/artifact/Td5spDrFgAah2w4PtBc2pn
(a Claude Doc: read it with the docs tools). It holds the cast, the character states, the
guardrails, events/widgets/notifications, and the **First build** plan — the Forks unit as a
complete pilot — which is the next piece of work.

The product is a Duolingo-*style* course, not a Daybook-style puzzle app. Daybook supplies repo
conventions only. Learn Duolingo's functions, never copy its characters: "Oscar" is Duolingo's
chess teacher, so that name and the draft knight are retired.

## Run

```bash
npm install && npm start   # http://localhost:8124
npm test                   # node --test, no framework
npm run e2e                # Playwright; E2E_PORT=8137 npm run e2e for a second worktree
```

## Phone testing

`npm run phone -- [scenario...] [--url <base>]` drives Chrome on an Android emulator with real
touches (`adb shell input tap`), for what a desktop browser can't show. Not part of `npm test` or CI.
No scenario runs all of `test/phone/*.js` (learn, calm, move, break, reflect, scan); a new one is
a few lines built from the helpers `tools/phone.js` passes in (`seed`, `touch`, `btn`, `type`,
`shot`, `run`, `check`).

- With no `--url` it serves this checkout on a free port; Chrome opens `http://10.0.2.2:<port>/`.
- It boots the AVD (`PHONE_AVD`, default `splendor36`) `-read-only` if no emulator is running and
  shuts down only one it started. SDK from `ANDROID_HOME` or `~/Android/Sdk`.
- Screenshots of the whole screen (keyboard included) go to `test-results/phone/<scenario>/NN-name.png`.
- It prints page errors, failed requests, sideways overflow, and the device checks: during Calm,
  Chrome's stream is `state:started` in `dumpsys audio` with an active track in
  `dumpsys media.audio_flinger`, and `dumpsys vibrator_manager` gains Chrome vibrations. It exits
  non-zero on a page error or a failed check.
- Quirks: Chrome's own prompts ("No thanks", "Not now") cover the page and are declined through
  `uiautomator dump`. Taps are real, so the page origin on screen is measured by tapping a blank
  page, not hard-coded. Timed parts run on `page.clock`. The host's PulseAudio may fail to open
  while Android audio still runs, so judge sound by the dumpsys checks. **Only one agent may use
  the emulator at a time.**

## Architecture

- `src/subjects.js` — the contract. A subject is a course JSON plus `mount(el, item, { say, done })`.
  Adding one is a course file, a mount function and one line there.
- `src/progress.js` — pure: streak, completed lessons, FSRS cards, and `light()`, today's
  bright/soft/ember habit display on each habit's tab. `app.js` owns storage
  (one `localStorage` key, every access in try/catch). Each habit has its own streak
  (`habits.learn`, `habits.calm`, …) and every session goes in `log`, which the habit view
  reads. `finishSession` records Learning, `finishPractice` a practice routine. The object carries `version`; `migrate()`
  validates and upgrades every older shape, on load and on import (the home bar's ⋯ saves and
  loads a file). Bump `VERSION` and extend `migrate()` whenever the shape changes.
- `src/chess/puzzle.js` — pure puzzle rules on chess.js. `src/chess/items.js` — the item types
  (teach, tap, move, true/false, stars, find), their answers and explanations, and `problem()`, the
  rules check every shipped item passes. `src/chess/exercise.js` — the board and buttons.
- **Stars** teach pieces by play: move your piece onto every gold star within a move budget; the
  other side never moves, and kings are optional (chess.js `skipValidation`). A piece's first
  puzzle (`new`, `demo`, `intro`) slides it along a path before input opens. `problem()` proves
  each one solvable in its budget by breadth-first search. Picked-up pieces show legal-move dots.
- `src/cast/` — the characters (`kit.js`, `rosa.js`, `lumi.js`), `coach.js` (a character that
  reacts in place) and `lines.js` (everything the cast says; the guardrail tests lint it).
  `tools/cast.html` renders every mood at 200/96/48 px, light and dark.
- `src/habitview.js` — pure helpers and the wording for the habit view (`habitView()` in app.js),
  opened from the "N-day streak · See your week" line over home's path (or a plant). Days without a session are plain, never missed.
- `src/calm/` — the Calm practice subject. `routines.js` is pure: each routine is a list of timed
  phases (breathing 4 in, 8 out; the body scan feet to head), and `timeline()` plays one on a
  pausable clock. `practice.js` mounts teach cards and the routines with Moss (`src/cast/moss.js`)
  breathing along. `run()` in `app.js` skips meter, runs and review for kind 'practice', and ends on
  a calm screen with an optional "How do you feel?". Course in `src/data/calm.json`. Home shows one
  habit's path at a time (the switcher under the bar, remembered in `drill.habit`).
- `src/reflect/` — the Reflect practice subject: three prompts (good, learned, tomorrow), each
  skippable, self-paced like grounding, with Lumi coaching. What is written goes to
  `progress.journal` via `writeJournal`, never the log; the habit view shows it through the
  subject's `dayDetail` hook. A subject's `again` ({ label, lesson }, in the course JSON) keeps a
  lesson on home once the path is done: "Reflect today", "Take a break", "Breathe". The learner's text is never linted or sent anywhere (a test checks).
- `src/move/` — the Move practice subject, built like Calm. `routines.js` is pure: a set of
  exercises becomes timed phases with rests between; a rep exercise counts its reps (`countOf()` in
  `src/practice/timeline.js`). `practice.js` mounts it; the coach demonstrates each pose through one
  `demo()` adapter (Clover, `src/cast/clover.js`). Course in `src/data/move.json`:
  Wake up, Strength (reps grow 5, 8, 10), Stretch. Guardrails bar pushing and body or weight
  words, and check the safety line is on the first lesson and after "Not really".
- **Calm is not therapy.** `test/guardrails.test.js` bars health claims, diagnosis words and urgency
  in Calm's text, and checks the Lifeline help line (13 11 14, as plain text) is on the first Calm
  lesson and after "Not really".
- `src/garden/model.js` — pure: the garden read from progress. Plants grow from `days` (each
  habit's permanent count of dates practised, never the streak); `RULES` is the achievement table
  (one line of data each), `award()` records what is earned in `progress.garden.earned` and never
  removes it; `mood()` maps the habits' lights; `garden()` is all the garden screen needs.
- `src/garden/art.js` — the garden's drawings, built like the cast: `plant(habit, stage, { flowers,
  closed })` (tree, lavender, sunflower, vine on a trellis, daisies; five stages; up to 6 blooms that
  never overlap), `sway()`, `visitor()`/`animateVisitor()` (butterfly, bee, birds) and, from
  `scene.js`, `scene(mood, 'strip' | 'tall')`, `slots(shape, n)` and `place()`. Scene colours carry
  their own dark set. `tools/garden.html` renders it all; check it in light and dark.
- The garden screen: `drawGarden(garden(), 'strip' | 'tall')` (art.js) is the strip at the top of
  home (one button into `gardenView()`) and the full view, plants and visitors at `perches()`;
  `liven()` in app.js sways them and pauses offscreen or hidden. A plant or its card opens
  `habitView(id, back)`. Both end screens list what `award()` brought, three lines at most.
- Home lists each habit once: one row of tabs (icon, name, streak coloured by `light()`) that
  scrolls inside itself. The bar is just the title, Sound and ⋯, and fits at 360px with every habit.
- `src/feel.js` — synthesised sounds (mute on the home bar), haptics, and `move()`, which skips
  animation under reduced motion.
- `src/data/chess.json` — generated by `npm run puzzles` from the Lichess CC0 dump; committed.
  `src/data/basics.json` — Chess from zero (board, moves, capturing, check and mate), first on
  the path; `src/data/forks.json` — the hand-written Forks unit after it. Both hand-written.

## Rules

- **Reuse before you add.** Daybook bloated from copied code; Drill must not. Before writing a
  helper, screen or exercise, look for one to extend: `src/html.js` (esc, chip), `focusOn()`,
  `coach()`, `src/calm/routines.js` (`timeline()` runs any timed routine), the subject contract
  (`coach`, `habit`, `kind`) and `finishRoutine()`, the one end screen for every practice habit.
  A new practice habit is a course file, a mount and a subject entry, not a new session flow.
  If two features need the same thing, extract it once. Review PRs for duplicated blocks.

- **Correct is decided by the rules, not by comparing to the stored answer.** Any checkmate
  solves a puzzle. Keep the stored line for hints.
- **Feedback must not move the board.** Rosa's bubble keeps its height; the answer banner is
  fixed over the bottom of the screen.
- **Every shipped puzzle is replayed in a test.** If the data or `tryMove` drift, it fails.
- **Every shipped item passes `problem()` and has an explanation.** Tap and true/false answers
  are computed from the position, never stored.
- **A missed item comes back once, at the end of the session.** Only the first try is scheduled.
- **The streak forgives.** One missed day in any seven is forgiven automatically; a gap of up
  to three days (or a second miss that week) is repaired by a review. A lesson finished in a
  repairable gap leaves the streak waiting for that review. Rules in `progress.js`, tested with
  fixed dates.
- **Guardrails are tests.** `test/guardrails.test.js` lints every cast line (and what Rosa says
  mid-puzzle) for ability praise and loss or guilt words, and holds celebrations to the
  `CELEBRATIONS` whitelist in `lines.js`: learning events only.
- **No XP or points.** Leagues and boosts are out, so points would only reward activity. The
  summary shows what was learned: right first time, the streak, and items learned so far.
- **Exercises that grade code must grade it independently.** For the planned TS test-writing
  subject, a learner's tests pass against the real implementation and fail against several
  broken ones; don't grade by matching text.
- **Verify by rendering.** Run it in the browser at phone width before calling a UI change done.

## Git

- Never commit to `main`. Branch, PR, merge — I do the merging, not the owner.
- Commits use `4845431+joebywan@users.noreply.github.com`. The personal address must never reach
  a commit or a remote. No `Co-Authored-By: Claude` trailer.

## Settled — do not reopen

- No hearts, no leagues, no currency or shop. Rewards are cosmetic and granted directly.
- No character shows sadness, guilt or urgency about the learner's absence.
- Characters are hand-written SVG animated with CSS and the Web Animations API, not Rive.
- Android home-screen widgets and local notifications are wanted, via a WebView wrapper with a
  JS bridge, as Saffron Road does. Drill is meant to drive people to learn, not to earn.

- **Every streak is a habit's streak** (Learning, Calm, …), each with its own tab and the
  same forgiving rules. Practice subjects are guided routines with no right or wrong. The plan
  and its task list: `docs/HABITS.md`.

## Open

Promotion picker; accessibility. Backlog (sync, friends, Android): `docs/TODO.md`.

- **Beginners play, they don't pick notation.** Answers are moves on the board or taps on squares;
  text says "Knight to c7", never "Nc7+" (`words()` turns SAN into words). Boards show coordinates.
- **First visit asks one placement question** (`PLACEMENT` in `app.js`) and suggests a starting
  unit; the learner can take it or start from the beginning. Units before the start stay open.
