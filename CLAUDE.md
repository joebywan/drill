# Drill — working notes for Claude

A Duolingo-style learning app: lessons that teach, a cast of characters, a streak, review.
Static page, vanilla ES modules, no build step, no server. Chess, maths, Japanese and coding are live;
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

`npm run phone -- [scenario...] [--url <base>] [--avd <name>]` drives Chrome on an Android emulator with real
touches (`adb shell input tap`), for what a desktop browser can't show. Not part of `npm test` or CI.
No scenario runs all of `test/phone/*.js` (one per habit and course, plus onboarding, first-visit, walkthrough, garden, timings, fitting, voice, sync, scan, left, drag); a new one is
a few lines built from the helpers `tools/phone.js` passes in (`seed`, `touch`, `btn`, `dragTo`, `type`,
`shot`, `run`, `check`).

- With no `--url` it serves this checkout on a free port forwarded with `adb reverse`; Chrome opens
  `http://localhost:<port>/`, a secure context, so Wake Lock and the like work as on the real site.
- One run at a time, machine-wide: it takes `/tmp/drill-phone.lock` (its PID inside; a lock whose
  process is gone is taken over) and prints "waiting for the emulator" until it can, and waits the
  same way while any emulator it didn't start is running. Then it boots the AVD (`--avd`, else
  `PHONE_AVD`, default `splendor36`; `--avd daybook_tablet` for a tablet) `-read-only`, shuts it down
  at the end and lets go of the lock, on an error or Ctrl-C too. SDK from `ANDROID_HOME` or `~/Android/Sdk`.
- Screenshots of the whole screen (keyboard included) go to `test-results/phone/<scenario>/NN-name.png`.
- It prints page errors, failed requests, sideways overflow, and the device checks: during Calm,
  Chrome's stream is `state:started` in `dumpsys audio` with an active track in
  `dumpsys media.audio_flinger`, and `dumpsys vibrator_manager` gains Chrome vibrations. It exits
  non-zero on a page error or a failed check.
- Quirks: Chrome's own prompts ("No thanks", "Not now") cover the page and are declined through
  `uiautomator dump`. Taps are real, so the page origin on screen is measured by tapping a blank
  page, not hard-coded. Timed parts run on `page.clock`. The host's PulseAudio may fail to open
  while Android audio still runs, so judge sound by the dumpsys checks. **Only one agent may use
  the emulator at a time:** `npm run phone` waits its turn by itself.

## Architecture

- `src/subjects.js` — the contract. A subject is a course JSON plus `mount(el, item, { say, done })`.
  Adding one is a course file, a mount function and one line there.
- `src/progress.js` — pure: streak, completed lessons, FSRS cards, and `light()`, today's
  bright/soft/ember habit display on each habit's tab. `app.js` owns storage
  (one `localStorage` key, every access in try/catch). Each habit has its own streak
  (`habits.learn`, `habits.calm`, …) and every session goes in `log`, which the habit view
  reads, each with its local `hour`. `finishSession` records Learning, `finishPractice` a practice routine.
  A practice closed part-way goes in `left` instead (`leavePractice`, with the step `ctx.reached`
  last reported), so nothing that reads the log sees it. The object carries `version`; `migrate()`
  validates and upgrades every older shape, on load and on import (the home bar's ⋯ saves and
  loads a file). Bump `VERSION` and extend `migrate()` whenever the shape changes.
- `src/chess/puzzle.js` — pure puzzle rules on chess.js. `src/chess/items.js` — the item types
  (teach, tap, move, true/false, stars, find), their answers and explanations, and `problem()`, the
  rules check every shipped item passes. `src/chess/exercise.js` — the board and buttons.
- **Stars** teach pieces by play: move your piece onto every gold star within a move budget; the
  other side never moves, and kings are optional (chess.js `skipValidation`). A piece's first
  puzzle (`new`, `demo`, `intro`) slides it along a path before input opens. `problem()` proves
  each one solvable in its budget by breadth-first search. Picked-up pieces show legal-move dots.
- **Courses.** Several Learn subjects share the Learning habit; home shows one course's path at a
  time (`courseShown`, the switcher under the tabs, remembered in `drill.course`), and reviews that
  course's cards so its coach runs them. The intro picks courses by course id; `choose()` turns them
  into the Learning tab. A Learn coach's `lines`/`headlines` replace Rosa's in the runner and end screen.
- `src/quiz/` — course-free tap-and-match items any course can use: `teach` (a big glyph or word),
  `pick` (one tap; `listen` plays the sound instead of showing it when there is a voice), `pairs`
  (match two columns), `build` (tap tiles in order). `items.js` is pure (`problem()`), `exercise.js`
  mounts them; `ctx.lang` marks text for the system font and picks the voice (`speak()` in feel.js:
  `speechSynthesis`, and with no voice or Sound muted the reading is shown instead).
- Japanese: `src/data/japanese.json` (hiragana: vowels, k and s rows, first words), coached by Kaede, a red
  panda (`src/cast/kaede.js`, rig-posed). `test/quiz.test.js` checks every answer against its own kana
  table and that no kana is asked before a teach card shows it.
- `src/quiz/` also has `line` (drag a marker on a number line, snapped to its ticks, answered on
  release) and takes a `picture` the course draws through the mount's `ctx.art`, plus `ctx.look`
  for a course's own styling.
- `src/maths/` — the Maths course (`src/data/maths.json`: mental maths, percentages, fractions you
  can see, for adults rusty at maths). Items are written as sums and pictures; `items.js` works every
  answer out (`value()` reads "15% of $60", so 2/4 is right for 1/2) and `toQuiz()` turns each into a
  src/quiz item; `problem()` checks both. `exercise.js` draws the ten frame, bars, 100 grid and a teach card's number line. Coach:
  Ada, an octopus (`src/cast/ada.js`, posed with `rig()`), with `MATHS_LINES` and `MATHS_HEADLINES`.
- `src/cast/` — the characters (`kit.js`, `rosa.js`, `lumi.js`), `coach.js` (a character that
  reacts in place) and `lines.js` (everything the cast says; the guardrail tests lint it).
  `tools/cast.html` renders every mood at 200/96/48 px, light and dark.
- **Coach voice:** each coach's voice sheet and line pools are data, one file each in
  `src/cast/voice/<coach>.json` (`voice`: personality, how they encourage and dare, `never` words;
  `lines` and `dares`: `{ when, lines }` pools keyed by habit, streak band, hour band, light, and the
  moments `first`/`comeback`). `say(coach, state, facts, rng, recent)` in lines.js picks the most
  specific line (filled slots like `{usualHour}` count as more specific; a line with an unknown fact
  is skipped), never one of `recent`, and sometimes a dare: once a day, only while the habit isn't
  done today, never first or after a gap. `moment()` in `src/cast/voice.js` reads state and facts
  from progress (log entries carry `hour`). Home's greeting uses it. New lines are drafted by hand
  with `tools/voice-draft.js` (Claude API, `ANTHROPIC_API_KEY`) into `drafts/voice/` for review,
  never into the pool; the guardrail tests lint every pool line and dare.
- `src/habitview.js` — pure helpers and the wording for the habit view (`habitView()` in app.js),
  opened from the "N-day streak · See your week" line over home's path (or a plant). Days without a session are plain, never missed.
- `src/coding/` — the Coding learn subject, beside chess on the Learning habit. `program.js` is pure: a
  level is rows of text ('S' Fennel, '*' a flower, '#' a rock, 'o' a square of a shape to draw), a program is
  blocks (steps, `{ repeat, do }`, `{ if, then, else }`, `{ until, do }`, `{ define, params, do }`, `{ call, args }`,
  `{ set, to }`, `{ change, by }`, `{ each, in, do }`, `{ go }`), with looks that compare a variable or combine
  with and/or/not. `run()` walks it and records the variables at each square, which the screen shows
  (a loop back on a square and values it looped from ends as 'endless'), and `problem()` proves each
  item answerable. **What ends a run:** one flower, reaching it; several flowers, the blocks running out,
  right if exactly `want` (else all) were picked; a shape, the blocks running out, right if the squares
  stood on are exactly the shape. Items: teach, build (tap tiles into the holes; it runs when the last is
  filled, and any program that meets the goal is right), predict (tap where Fennel stops), bug (a whole program
  that fails: tap a block, a tile replaces it, graded by running). `view: 'js' | 'both'` shows a program as
  JavaScript from `toJS()`; code text is never stored. A new block goes through `slots()` (holes, flips),
  `run()`, `blocks()` and `toJS()`; looks are written once by `writeLook()`. Words in prompts
  and explanations get swapped on a flip, so "right" means a direction only. `exercise.js` draws
  the grid, the blocks and the tiles, and Fennel (`src/cast/fennel.js`, a fennec fox posed with
  `rig()`) walks it. His lines are `CODING_LINES`/`CODING_HEADLINES`, read through the subject's
  `coach.lines`/`coach.headlines`. Home's course switcher (shared with Japanese) shows it.
- `src/calm/` — the Calm practice subject. `routines.js` is pure: each routine is a list of timed
  phases (breathing 4 in, 8 out; the sigh 3 in, 1 top-up, 6 out; the butterfly hug's taps; the body scan feet to head), and `timeline()` plays one on a
  pausable clock. `practice.js` mounts teach cards and the routines with Moss (`src/cast/moss.js`)
  breathing along. `run()` in `app.js` skips meter, runs and review for kind 'practice', and ends on
  a calm screen with an optional "How do you feel?". Course in `src/data/calm.json`. Home shows one
  habit's path at a time (the switcher under the bar, remembered in `drill.habit`). A Calm routine
  opens and closes on a soft bell and can have soft rain under it (`calmSound()`, `rain()` in
  feel.js, both generated): set on the ⋯ screen, both off until turned on, and both silent
  when Sound is muted or under reduced motion.
- `src/reflect/` — the Reflect practice subject: three prompts (good, learned, tomorrow), each
  skippable, self-paced like grounding, with Lumi coaching. What is written goes to
  `progress.journal` via `writeJournal`, never the log; the habit view shows it through the
  subject's `dayDetail` hook. A subject's `again` ({ label, lesson }, in the course JSON) keeps a
  lesson on home once the path is done: "Reflect today", "Take a break", "Breathe". The learner's text is never linted or sent anywhere (a test checks).
- `src/winddown/` — Wind down, a bedtime sequence made only of Calm's pieces: kit.js `sequence()`
  plays a 'sequence' item's parts in turn (its own settle-in steps and goodnight card, then Calm's
  `practise()` routines) and ends once; Calm's `sounded()` puts the bell and rain round the whole.
  The subject's `timings: 'calm'` plays the learner's Calm timings, and `night: true` puts the
  session and end screen in a warm dark palette (`body:has(main.night)` in styles.css).
- `src/move/` — the Move practice subject, built like Calm. `routines.js` is pure: a set of
  exercises becomes timed phases with rests between; a rep exercise counts its reps (`countOf()` in
  `src/practice/timeline.js`). `practice.js` mounts it; the coach demonstrates each pose through one
  `demo()` adapter in `src/practice/kit.js`, which calls the subject coach's own `demo` (Clover,
  `src/cast/clover.js`). The screen break shares it with Mira (`src/cast/mira.js`, a lemur with big
  amber eyes) demonstrating each of its steps; both are posed with `rig()` in `src/cast/kit.js`.
  "How?" opens the step's guidance (`how` in
  `src/break/routines.js`) with the routine paused. Course in `src/data/move.json`:
  Wake up, Strength (reps grow 5, 8, 10), Stretch. Guardrails bar pushing and body or weight
  words, and check the safety line is on the first lesson and after "Not really".
- **Calm is not therapy.** `test/guardrails.test.js` bars health claims, diagnosis words and urgency
  in Calm's text, and checks the Lifeline help line (13 11 14, as plain text) is on the first Calm
  lesson and after "Not really".
- `src/focus/` — the Focus practice subject: "What are you focusing on?" (presets or your own words,
  optional; kept in `progress.journal[date].focus`, never the log, shown by its `dayDetail`), then
  one long `clock` phase (m:ss, `countOf`) with Hazel the beaver (`src/cast/hazel.js`, posed with
  `rig()`) holding her stick. Pause and "I'm done" end it like any other; `stayAwake()` in
  practice/kit.js keeps the screen on. The end screen's question comes from `coach.ask` ("How did it go?").
  Its garden plant is bamboo. Guardrails bar productivity guilt and distraction counting.
- `src/practice/timings.js` — the learner's own timings: `TIMINGS` (each practice habit's settable
  values, ranges, fixed defaults) and `timed(habit, defaults, overrides)`, the one merge every routine
  builder (calm, move, break `routines.js`) goes through; a value out of range falls back to the
  default, and with nothing set the path's own values (cycles, reps rising) hold. Stored in
  `progress.timings` (v8). `timingsView()` in app.js: − and + steppers, the default beside each,
  "Back to defaults", saved on each tap; opened from the habit view, or from home before a first session.
- `src/garden/model.js` — pure: the garden read from progress. Plants grow from `days` (each
  habit's permanent count of dates practised, never the streak); `RULES` is the achievement table
  (one line of data each), `award()` records what is earned in `progress.garden.earned` and never
  removes it; `mood()` maps the habits' lights; `garden()` is all the garden screen needs.
  Each habit earns a butterfly (7 in a row) and a bee (its first session, not Learning), each its
  own species; the whole garden earns `LANDMARKS` (path, bench, birdhouse with birds, a frog at
  Lumi's pond, fence, lanterns, hive with bees, more birds) from `gardenDays()`, every habit's days added
  up. Each landmark is a different piece so every one changes the picture. The old per-habit
  `birds:<habit>` stays in saves but is no longer drawn. app.js gives a save any landmark it had
  already earned, quietly, on load.
- `src/garden/season.js` — pure: `season(date, south)` (meteorological, flipped south) and
  `southern(timeZone)`, a guess (Australia/* is south). `garden()` carries `season`; app.js reads the
  hemisphere from the ⋯ screen's "Southern hemisphere seasons" toggle (`pref('south')`), defaulting to the
  guess. A season only retints the land and adds decoration (`scene(mood, shape, season)`): plants
  never change with it. Lumi lounges in `pond()`, which landmarks.js `layout()` places before any
  landmark (left out when a crowded strip has no room); the pond landmark is a frog joining Lumi.
- `src/garden/art.js` — the garden's drawings, built like the cast: `plant(habit, stage, { flowers,
  closed })` (tree, lavender, sunflower, vine on a trellis, daisies, evening primrose; five stages, scaled by `GROW` so a
  sprout is about a third of full height and a sapling about half; up to 6 blooms that
  never overlap), `sway()`, `visitor(kind, species)`/`animateVisitor()` (butterfly, bee, birds;
  `BUTTERFLIES`, `BEES`, `BIRDS` are the species) and, from `landmarks.js`, `layout()` (the path
  and fence behind the plants, each other piece at the nearest free spot, smaller when crowded),
  `landmark(gift)` and `animateLandmarks()`; and, from
  `scene.js`, `scene(mood, 'strip' | 'tall')`, `slots(shape, n)` and `place()`. Scene colours carry
  their own dark set. `tools/garden.html` renders it all; check it in light and dark.
- The garden screen: `drawGarden(garden(), 'strip' | 'tall')` (art.js) is the strip at the top of
  home (one button into `gardenView()`) and the full view, plants and visitors at `perches()`;
  `liven()` in app.js moves them: a gust (`gust()`, scene.js) rolls left to right every few seconds and
  leans the grass and each plant in turn; `animateScene()` drifts clouds, pulses the sun, twinkles glints
  and stars and wanders fireflies; flies in visitors that just arrived (`data-new`), and pauses offscreen or hidden. A plant or its card opens
  `habitView(id, back)`. Both end screens list what `award()` brought, three lines at most.
- Garden sounds are real files, `assets/sounds/*.wav`, made by `node tools/sounds.js` (plucks,
  bells, chirps, a buzz, all synthesised there, so they are ours to ship). `chime(gift)` in feel.js
  plays one through an `Audio` element (src/ never calls fetch): `plant` when a habit is added, and
  the first arrival's sound when something arrives: its gift (`flower`, `butterfly`, `bee`), or a
  landmark's `sound` (`build`, `birds`, `pond`, `lantern`, `bee`).
- **Self-reported habits** (kind 'log'): no path, one tap a day ("I walked today"). The habit list is
  `habitsFor(progress)` in subjects.js, never HABITS alone: the built-ins, then PRESETS and the
  learner's own from `progress.tracked`. `logToday`/`unlogToday`/`track` in progress.js; the tab's
  panel, the "+ Habit" sheet and the make-your-own form in app.js (`logPanel`, `addHabit`,
  `editHabit`). Learners' habit names are never linted and always escaped.
- Home lists each habit once: one row of tabs (icon, name, streak coloured by `light()`) that
  scrolls inside itself. The bar is just the title, Sound and ⋯, and fits at 360px with every habit.
- `src/fitting.js` — pure: fitting the person from the on-device log (docs/TODO.md "Fitting the
  person"). `usualHours`/`reminderHour` (the log's `hour`s; nothing under five sessions);
  `shouldRemind` thins reminders that are only ever cleared (every other day after 3, every third
  after 5, none after 8; ⋯ then shows one passive "Reminders are paused" line with "Turn back on");
  `dropOff` (this week well under their own usual week) starts a comeback (`progress.comeback`): a
  card on home for a week offering their favourite practice at their usual hour, answered by one
  session of it, which earns the ladybird (`ladybird:<habit>` in garden RULES); `shorter` offers a
  shorter one ("Try a shorter one: 3 breaths") for a lesson left at the same step three times,
  through `timed()` overrides for that session only; `preferred` puts the habits finished most after
  the intro picks, through `ordered()`. `progress.reminders` and `progress.comeback` are optional
  (no version of their own), kept by `migrate()` and so in the file export. The habit view shows
  "You usually practise around 7 pm".
- **The reminder brain** (`window.drill`, set in app.js over the live progress, before
  `tellAndroid`/`passNotes` run): plain functions for the Android wrapper (see Android below).
  `reminderHour()` → 0–23, or null with too little data (then `REMIND_AT`, 18:00, in widget.js);
  `shouldRemind()` → boolean, false after a session today or while reminders are thinned or paused;
  `noteReminder(outcome)` with `'opened'` (tapped) or `'cleared'` (swiped away) for every note shown
  → true, or false for any other value (nothing recorded). Nothing leaves the device.
- **Sync and friends** (`src/sync/`, `server/`), opt-in and off by default: with it off nothing is sent
  and Drill works with no backend. **Feature-flagged off** until the API is deployed: `SYNC` in
  `config.js` gates `available()` (the ⋯ section, every call) and the sync parts of `privacy.html`;
  tests set `window.DRILL_SYNC = true` before load. `keys.js`: the recovery code is the profile's secret, kept on the
  device (`drill.sync`); HKDF gives the AES-GCM key progress is sealed with and the bearer token the
  server knows the profile by (it stores the token's hash). A 6-digit pairing code carries the
  recovery code to a new device, wrapped with PBKDF2. `merge.js` is pure: cards per card (latest
  review wins), log/done/journal/garden as unions, streaks replayed from the merged log with
  `nextStreak`. `sync.js` is the only file in src/ that calls fetch (a guardrails test holds it);
  `config.js` holds the one API constant. `ui.js` is the four ⋯ screens; friends see a card of presets
  and numbers only (`presets.js`, which the worker also imports to check them). `server/` is the
  Cloudflare Worker + D1 (`worker.js`, `migrations/`), tested with Miniflare (`npm test --prefix
  server`); e2e routes the API host to a local worker. Deploying is `server/DEPLOY.md`. `privacy.html`
  is the policy, with delete-by-recovery-code for Play. Inside the Android wrapper
  (`DrillBridge`), which has no internet permission, the ⋯ section is hidden and sync never runs
  (`available()`). The card's name and animal are `progress.look` ({ word, animal, at }), synced, the
  latest pick winning.
- `src/feel.js` — synthesised sounds (mute on the home bar), haptics, and `move()`, which skips
  animation under reduced motion. Lesson moments go through it: `cue(name)` (sound and buzz; the
  sound follows the Sound toggle only, reduced motion skips just the animations) for right, run, wrong, done and unlock;
  `flourish(el, 'pop' | 'shake')` for the answer (under 400 ms, never blocking input); `petals()`,
  the petal-and-leaf confetti on every finished lesson. On home the next node bobs, and after a
  lesson `walkTo()` fills the trail's `.fresh` stretch as the next session's coach hops, then pops the next node open.
- `src/data/chess.json` — generated by `npm run puzzles` from the Lichess CC0 dump; committed.
  `src/data/basics.json` — Chess from zero (board, moves, capturing, check and mate), first on
  the path; `src/data/forks.json` — the hand-written Forks unit after it. Both hand-written.
  `src/data/tactics.json` — hand-written teach cards (lesson id to cards) that `subjects.js` puts in
  front of chess.json's lessons, so regenerating puzzles keeps them. Nothing assumed: a rule goes on
  a card before a question needs it, never first in an `explain` (`test/items.test.js`).

## Android

`android/` is a WebView wrapper (Kotlin, AGP 9 with built-in Kotlin, Gradle needs **Java 17**):
`cd android && JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=~/Android/Sdk ./gradlew assembleDebug`
after `npm ci` at the root. App id `com.joebywan.drill`, locked.

- The web app is not copied into git: `copyWebAssets` syncs index.html, styles.css, src/, assets/ and
  the three import-map packages into the APK, served from `https://appassets.androidplatform.net` by
  WebViewAssetLoader. No INTERNET permission; CI fails the build if one appears.
- `src/widget.js` makes every choice: `look(light, hour)` → background, Lumi pose, line pool
  (`WIDGET_LINES`, linted), and `summary()` a schedule of looks over the next days' boundaries
  (midnight, 5, 12, 18, 22). `save()` passes it to `DrillBridge.summary()`, so Kotlin only renders.
  The page also sends Lumi's poses as PNGs (`art`). In a browser there is no bridge and nothing runs.
- `Daily.kt`: the widget, an inexact alarm at the next look and at the note's hour, a 15-minute
  WorkManager job, `Ticker` re-arming on BOOT_COMPLETED and MY_PACKAGE_REPLACED. The daily note is
  opt-in on the ⋯ screen, low importance, at most once a day, and posts nothing if anything was done
  today. The reminder brain (`window.drill`, feature-detected) sets the hour (`reminderHour()`, null
  → 18:00) and can say not today (`shouldRemind()`), both snapshotted into the summary; whether each
  note was opened or cleared is queued in Kotlin and handed to `noteReminder()` on load. Logcat tags `DrillBridge`, `DrillDaily`. Test path (debug builds only skip the once-a-day guard):
  `adb shell am broadcast -n com.joebywan.drill/.Ticker -a com.joebywan.drill.REMIND --ez force true`.
- The icon is Lumi on the garden green, generated by `node tools/icon.js` from `lumi()`: the adaptive
  icon's foreground and monochrome layers, `assets/icon.svg` (favicon) and `assets/icon-512.png`
  (manifest and Play listing). Rerun it when Lumi changes.
- Releases copy Daybook: `assembleRelease` only, by hand from the **Android release** workflow;
  `-PrequireSigning=true` fails without the key, and `android/tools/verify-apk.sh` fails an
  unsigned, wrong-key or debuggable APK. The key is Joseph's, kept offline. To set it up once: create
  it, put its certificate SHA-256 in `android/release-key.sha256`, and add the repo secrets
  `DRILL_KEYSTORE_BASE64`, `DRILL_KEYSTORE_PASSWORD`, `DRILL_KEY_ALIAS`, `DRILL_KEY_PASSWORD` (or set
  `DRILL_KEYSTORE` etc. as env vars or `-P` properties for a local build).

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
- **Sessions adapt.** `src/adapt.js` reads `progress.answers` (each answer: key, right, ms, on the device, last 400). A miss
  comes back up to `GOES` times, fresh; two misses in a unit's last four answers inserts that unit's second explanation
  (`src/data/help.json`, every Learn unit has one) and a smaller earlier item, once a session; repeats favour what was
  missed; 8 right in a row in a course cuts echoes to 1. Only the first try schedules a card.
- **Sessions drill.** `src/repeat.js`: a lesson opens with up to 2 earlier cards (the closest to slipping), ends
  with up to 3 of its own items again ("Once more", not rescheduled), and each unit ends in a Checkpoint mixing
  it (`mix`). A subject's `vary(item, random)` makes a repeat fresh: Coding flips the map, Chess mirrors a stars
  puzzle, and returning the item means "worth repeating as written" (Maths, Japanese), null means "don't" (a
  real-game puzzle). The card key stays the original's. E2E flows set `window.DRILL_PLAIN` (`test/e2e/fixtures.js`).
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

What is still open: `docs/TODO.md` ("Still open") and `docs/HABITS.md`.

- **Beginners play, they don't pick notation.** Answers are moves on the board or taps on squares;
  text says "Knight to c7", never "Nc7+" (`words()` turns SAN into words). Boards show coordinates.
- **No questions in the way.** A first visit opens a short, skippable intro (`intro()`/`want()` in
  app.js, words in `INTRO_WORDS`): what Drill does, then Learn something / Build habits, each opening
  its list. The picks go in `progress.picked` and home orders its tabs by them through ONE function,
  `ordered()` in subjects.js; picked one-tap habits are switched on with `track()`. Skip is today's
  home (Lumi's welcome line, the garden, every habit). Shown once (`showsIntro`); saves from before
  v7 never see it. The ⋯ menu's "Change what you see" reopens the second step. It never asks placement. Placement is an optional part of a subject: its `placement` (chess has one) shows as a
  "Skip ahead" link by its path; the question then suggests a starting unit, or the learner starts
  from the beginning. Answering or dismissing (×) hides the offer for good (`progress.start`, per
  subject), and so does finishing the subject's first unit; starting a lesson never asks. Units before the start stay open.
