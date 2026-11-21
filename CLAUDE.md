# Wingbeat — working notes for Claude

Called Drill until November 2026 (why it changed: `docs/NAMING.md`). The Android app id and Kotlin
package are `com.joebywan.wingbeat`.

A Duolingo-style learning app: lessons that teach, a cast of characters, a streak, review.
Static page, vanilla ES modules, no build step, no server. Chess, maths, Japanese, coding, JavaScript,
TypeScript and TS test-writing are live.

**Read the cast brief before building anything:** https://claude.ai/artifact/Td5spDrFgAah2w4PtBc2pn
(a Claude Doc: read it with the docs tools). It holds the cast, the character states, the
guardrails, and events/widgets/notifications. What's left is in `docs/TODO.md`.

**Then read `docs/WINGBEAT.md`:** the plan for bringing the theme into line with the name and growing
the short courses. The brief was brought up to date with it on 2026-11-20 (its section "The name"); if the two ever
disagree, `docs/WINGBEAT.md` wins.

The product is a Duolingo-*style* course, not a Daybook-style puzzle app. Daybook supplies repo
conventions only. Learn Duolingo's functions, never copy its characters: "Oscar" is Duolingo's
chess teacher, so that name and the draft knight are retired.

## Run

```bash
npm install && npm start   # http://localhost:8124
npm test                   # node --test, no framework
npm run e2e                # Playwright; E2E_PORT=8137 npm run e2e for a second worktree
npm run e2e:firefox        # the same suite in Firefox, silent; first `npx playwright install firefox`. CI runs it too (`e2e-firefox`)
npm run e2e:live           # the deployed site, three smoke tests; GitHub runs it after every deploy (`live.yml`). LIVE_URL=<base> to aim elsewhere
```

**Nothing a test run starts may be heard on this computer.** Chromium's headless shell is mute and the phone emulator
starts with `-no-audio`, but Firefox (and WebKit, or any headed browser) plays sound for real: the app's chimes, and
`speechSynthesis` through the system's speech service, which reads lesson text aloud. Launch Firefox only through
`playwright.firefox.config.js` (no route to the sound server, volume at nothing, Firefox's own silent test voices), or
with the same env and prefs in a one-off script, and check while it runs that `pactl list sink-inputs` shows no stream
from it and no `speech-dispatcher-*` stream with `Corked: no`.

The suite must pass in both browsers. Where Firefox really differs (no history entry before the first page, `getBBox` tighter
on curves, a click on an svg's frame not focusing it), the spec branches on `browserName` and says why in a comment; Chromium's
check stays as strict as it was.

## Phone testing

`npm run phone -- [scenario...] [--url <base>] [--avd <name>]` drives Chrome on an Android emulator with real
touches (`adb shell input tap`), for what a desktop browser can't show. Not part of `npm test` or CI.
A plain `npm run phone` runs every scenario in `test/phone/*.js` but the `*-all` ones. There is one per habit and
course, plus onboarding, first-visit, walkthrough, garden, wardrobe, timings, fitting, voice, sync, scan, left and drag,
and the Wingbeat screens: butterfly, yours, home-states, stages, field-guide, skins, choose, reflect-days, presets and
looks (the dark theme), home-days (home from day 0 to day 60, with where the path starts; `HOME_SMALL=1080x1700` for
a short phone), chrysalis (a learner at each stage of a raised butterfly, light and dark), words (what the coaches say after
a listening item, one miss, a first egg and a lesson in another course), follow-on (a first visit's picks, and
TypeScript's tab before and after JavaScript), feedback (what a beginner meets after a miss: the rock, a still board, a
build shown back; `FEEDBACK_SMALL=1080x1700`) and zoom (Chrome's Default zoom at
150% and 200%, set by real taps on its Accessibility screen and put back). Large text has three routes: the app's WebView
follows the phone's font size (`app`); Chrome for Android has only Default zoom, a whole-page zoom (`zoom`); a larger default
or minimum font size in a desktop browser is `test/e2e/large-text.spec.js`. `test/phone/lib/fits.js` holds what those share
(`misfits`, `textTour`, `uiNode`), and `tools/play.js` exports `scan`, the page check for things clipped, overlapping or covered.
- Scenarios named `*-all` play a whole course through `tools/play.js` and run only by name, one unit at a time:
  `coding-all` (`CODING_UNIT`), `chess-all` (`CHESS_UNIT`), `maths-all` (`MATHS_UNIT`), `japanese-all`
  (`JAPANESE_UNIT`) and `code-all` (`CODE_COURSE=javascript|typescript|testing` with `CODE_UNIT`). Each also takes
  `…_LESSONS` (some lesson ids) and `…_SMALL=1080x1700` (a short phone, a 412x533 page); `PLAY_SHOTS=1` keeps a
  picture of every item, asked and answered, where a run otherwise keeps only the odd ones. The header of
  `test/phone/coding-all.js` explains them; `tools/play-quiz.js` taps Maths' and Japanese's items in.
- `test/phone/app.js` plays the installed Android app (build the debug APK first, see Android; `APP_APK=<path>` for
  another, and with no APK it does nothing): `attach(pkg)` gives a scenario the same helpers for an app's WebView,
  and `screenXml()` the launcher's UI tree.
- A new scenario is a few lines built from the helpers `tools/phone.js` passes in (`seed`, `touch`, `btn`, `dragTo`,
  `swipe`, `press` (a long press), `doubleTap`, `type`, `shot`, `run`, `check`, `calibrate`); shared seeds are in
  `test/phone/lib/seed.js`, and Chess's move-playing (a chess.js game kept in step with the page) in `test/phone/lib/chess.js`.
- What a finger does has its own scenarios: `touch-swipe`, `touch-keyboard`, `touch-links`, `touch-press`. On any `*-all`
  scenario `PLAY_JITTER=0.85` lands each tap at a seeded random point out to that share of the way to its target's edge
  (`PLAY_SEED` varies it) and `PLAY_SWIPE=1` swipes each box that scrolls in itself. Run the jittered taps after changing the
  size of anything tapped. Chess also has `chess-games` and `chess-games-small` (Mate and Scramble; the small one fails on
  anything off the screen), `chess-miss` (a puzzle missed on purpose, to read its explanation; `CHESS_MISS`, `CHESS_SMALL`),
  and by name only `chess-wrong-all` (each lesson answered wrongly first) and `chess-rosa-all` (Play Rosa at every level;
  `ROSA_SMALL=1080x1700` for a short phone).
- The phone as it is held has its own: `away` and `interrupted` (a lesson put down, locked, called), `moving` (bursts of
  screenshots while Fennel draws), and by name `landscape-all`, `landscape-app-all` and `offline-all` (`--url` the live site).
  **A page the runner is attached to never goes to the background** (Chrome is started to keep drawing, and the harness holds
  the screen on), so anything about being away from a routine is played by `away-bare` and `away-bare-app`, which let go of
  the page first. `test/phone/lib/device.js` has `turn`, `putDown`, `screenOff`, `awake`.
- `hands` plays by sight: with `HANDS_DIR` set it saves the screen and waits for one command at a time in a file (tap, swipe,
  type, back), each done with a real touch. It is how a blind playthrough is done (an agent that has not read the answers).

- With no `--url` it serves this checkout on a free port forwarded with `adb reverse`; Chrome opens
  `http://localhost:<port>/`, a secure context, so Wake Lock and the like work as on the real site.
- A few runs at a time, machine-wide (`PHONE_SLOTS`, default 4), each on its own emulator: a run takes the first
  free slot's lock `/tmp/wingbeat-phone-<n>.lock` (its PID inside; a lock whose process is gone is taken over) and
  prints "waiting for the emulator" until it can. Slot n is `emulator-<5554 + 2n>`; one already running there
  that no run started is waited for the same way. Then it boots the AVD (`--avd`, else `PHONE_AVD`, default
  `splendor36`; `--avd daybook_tablet` for a tablet) `-read-only` (which lets one AVD run several times over),
  shuts it down at the end and lets go of the lock, on an error or Ctrl-C too. SDK from `ANDROID_HOME` or `~/Android/Sdk`.
- Screenshots of the whole screen (keyboard included) go to `test-results/phone/<scenario>/NN-name.png`.
- It prints page errors, failed requests, sideways overflow, and the device checks: during Calm,
  Chrome's stream is `state:started` in `dumpsys audio` with an active track in
  `dumpsys media.audio_flinger`, and `dumpsys vibrator_manager` gains Chrome vibrations. It exits
  non-zero on a page error or a failed check.
- Quirks: Chrome's own prompts ("No thanks", "Not now") cover the page and are declined through
  `uiautomator dump`. Taps are real, so the page origin on screen is measured by tapping a blank
  page, not hard-coded. Timed parts run on `page.clock`. The emulator starts with `-no-audio`, so nothing
  it plays reaches this computer's speakers; Android's own audio still runs, so judge sound by the dumpsys checks. **Agents share the
  emulators:** `npm run phone` takes a free slot or waits its turn by itself; never start an emulator by hand or delete a lock.
- What the runner does so a run can be believed: `shot()` waits for two real frames (`window.__frame`, the real
  `requestAnimationFrame` kept before `page.clock` replaces it) and 400 ms, so a screenshot isn't a frame behind on
  the software-rendered emulator. Playwright pins `prefers-color-scheme` to light, so the runner turns that off
  (`emulateMedia({ colorScheme: null })`) and the phone's own night mode shows. After `wm size` (a short phone)
  Chrome's toolbar moves and the page sits elsewhere on screen: `calibrate()` measures it again, and `tools/play.js`
  calls it. `play.js` also flags a tap that another element took, or a target partly under another's.
- **One network that stays put.** The emulators share one simulated Wi-Fi (the emulator's `netsimd`), which drops when
  another emulator starts or stops; Android then moves to mobile data and Chrome fails whatever it is fetching
  (`net::ERR_NETWORK_CHANGED` on the page's own files, or a page that never loads). The runner turns Wi-Fi off and
  stops Android probing the network (`captive_portal_mode 0`), so mobile data is the only network for the whole run.
  The voice and links out still work over it.
- **Judge a run by its exit status, not by looking for FAIL in its log.** When the emulator itself dies, the log
  has no FAIL: it says STUCK and "Target page, context or browser has been closed", and the run exits non-zero.
  `coredumpctl list --since today` then shows a `qemu-system-x86_64-headless` SIGSEGV (in `gles_swiftshader`, the
  software renderer). Treat that as a bug in the page until shown otherwise: bisect the CSS on that screen.

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
  validates and upgrades every older shape, on load and on import (home's ⋯ saves and
  loads a file). Bump `VERSION` and extend `migrate()` whenever the shape changes.
- `src/chess/puzzle.js` — pure puzzle rules on chess.js. `src/chess/items.js` — the item types
  (teach, tap, move, true/false, stars, find), their answers and explanations, and `problem()`, the
  rules check every shipped item passes. `src/chess/exercise.js` — the board and buttons.
  A real-game puzzle's explanation is its line and then why it works: `src/chess/why.js` works the reason out from the
  position by its theme (which two pieces a fork hits, what a pin holds to what, why the king had no square) and
  `test/why.test.js` proves every sentence against its board. `explanation()` returns the wordings best first (the full
  why, a shorter one, the line alone) and `worded()` in exercise.js shows the first whose verdict, measured on the page,
  leaves the board clear. Never choose by counting characters: the font differs from machine to machine. Every chess word
  is taught on a card before it is used (`src/data/chess-terms.json`, held by `test/items.test.js`); a teach card's
  `topic` heads it in place of its unit's title.
- **The board never moves from asked to Continue.** `fitBoard` keeps the coach's bubble at the height of the tallest line the
  item can say (`sayings()`: every line Rosa says mid-item is one constant used by the mount and by `sayings()`), and decides
  `tall` only while asked. `test/e2e/board-still.spec.js` holds the board's top through every move, right and wrong, at three
  sizes. A stars item's `intro` stays with its prompt until the first move; the board is `aria-busy` while a demo plays.
- **Promotion:** `withPromotion()` in exercise.js is the one picker (cm-chessboard's dialog, on every `board()`), used by puzzles, move items, stars, Mate and Play Rosa; Scramble has no pawns of yours. `tryMove()` returns `'piece'` for the right square with a piece the line doesn't need, explained and free; any mate still counts.
- **Stars** teach pieces by play: move your piece onto every gold star within a move budget; the
  other side never moves, and kings are optional (chess.js `skipValidation`). A piece's first
  puzzle (`new`, `demo`, `intro`) slides it along a path before input opens. `problem()` proves
  each one solvable in its budget by breadth-first search. Picked-up pieces show legal-move dots.
- **Courses.** Several Learn subjects share the Learning habit; home shows one course's path at a
  time (`courseShown`, the switcher under the tabs, remembered in `wingbeat.course`), and reviews that
  course's cards so its coach runs them. The intro picks courses by course id; `choose()` turns them
  into the Learning tab. A Learn coach's `lines`/`headlines` replace Rosa's in the runner and end screen.
  A course can follow another (`follows: { course, units }` on the course): until those units are done, `waits()`
  (progress.js) keeps its tab to one line, the other course's button and "I know JavaScript: start here" (a placement
  answer in `progress.start`). An order, never a lock. TypeScript and Test writing follow JavaScript's first 9 units;
  `test/code-courses.test.js` works that number out from every word they show and fails on a word taught nowhere.
- **Chess games** (`src/chess/games.js`, the "Games" row on chess's home, a subject's `games`): replayable modes, each a one-entry session
  for `run()` whose mount never calls `done`, so nothing is scored, scheduled or logged; a `.foot` banner ends a game and its button remounts it.
  Each game mounts through `fitGame()`, which calls the lessons' `fitBoard` (exercise.js; never a second fitter), and puts what it counts in the
  session bar with `inBar()`, where a lesson's meter is. A board being played keeps 40px squares; at a game's end its buttons go and the board sits above the banner.
  **Mate** (`mate.js`, `prover.js`, `prover-worker.js`): Daybook's game. `prover.js` is a port of its mate search on its own small
  board, because chess.js is far too slow to prove a mate in 4; it has no imports so it can run in a Worker (import maps don't reach workers).
  `src/data/mate.json` comes from `node tools/mate-positions.js`, Lichess CC0 (`docs/chess-positions/NOTICE.md`). Lazy-loaded. **Scramble** (`capture.js`): our own
  capture game; pure rules on chess.js, the best on the device in `wingbeat.capture.best`. **Play Rosa** (`engine.js`): alpha-beta on chess.js as a
  generator, run in timer slices so the page stays live; `LEVELS` is its four levels. Words in `GAME_WORDS`, linted.
- `src/quiz/` — course-free tap-and-match items any course can use: `teach` (a big glyph or word),
  `pick` (one tap; `listen` plays the sound instead of showing it when there is a voice), `pairs`
  (match two columns), `build` (tap tiles in order). `items.js` is pure (`problem()`), `exercise.js`
  mounts them; `ctx.lang` marks text for the system font and picks the voice (`speak()` in feel.js:
  `speechSynthesis`, and with no voice or Sound muted the reading is shown instead). A missed build shows what was
  put under the right answer (`.yours`, "You put …", up to the wrong tile); its line is kept from the start, so nothing moves.
- Japanese: `src/data/japanese.json` (all of hiragana, the sounds that change and small kana, everyday words,
  greetings, and a first sentence with は: これは ねこです), coached by Kaede, a red panda (`src/cast/kaede.js`,
  rig-posed). Sentences are `build` items with word tiles. `test/quiz.test.js` checks every answer against its own kana
  table (small kana, and は said "wa" at the end of a part) and that no kana is asked before a teach card shows it.
- `src/fit.js` — the one module for fitting a screen, behind the rule that **nothing the learner is working on sits
  under a fixed bar**: fit first (the coach, the gaps and the pictures give up room), then that part scrolls in its
  own box, never the page. `verdictHeight()` measures the verdict before it comes; `fitter()` gives Coding and the
  code courses `fit`, `settle` and `keep` (the block being run stays in view); `fitCard()` fits a quiz card (Maths,
  Japanese); a box that scrolls ends on a whole row or line. `scrollBox(el)` is the one way to make a box scroll: it
  marks the box `more-above` / `more-below` as it scrolls, resizes or is redrawn, and styles.css lays a plain gradient
  in the box's own colour (`--fade`) over that edge. **Never a CSS mask on a box that scrolls:** it crashes the
  emulator's software renderer (#164), and scroll-driven animations don't run in Firefox. A screen that
  fits is left as it is. On a short phone (a 412x533 page) every course is played this way: `…_SMALL=1080x1700`.
  The verdict gives way too (`giveWay(foot)`): it is at most half the screen (`.foot`, 50dvh); past that its headline is
  held to two lines and to the explanation's size, then its words `scrollBox()`. `verdictHeight()` measures it that way,
  under the coach's longest headline (`longestVerdict()`; tests pin that line with `WINGBEAT_LONGEST`). A program is
  never boxed to under a line: if the verdict would leave less, the coach gives way first.
- `src/quiz/` also has `line` (drag a marker on a number line, snapped to its ticks, answered on
  release) and takes a `picture` the course draws through the mount's `ctx.art`, plus `ctx.look`
  for a course's own styling.
- `src/maths/` — the Maths course (`src/data/maths.json`, nine units: mental maths, times tables you
  can see, sharing and dividing, rounding and estimating, percentages, fractions you can see, decimals
  and money, ratios and better buys, below zero; for adults rusty at maths and for children). Items are
  written as sums and pictures; `items.js` works every answer out (`value()` reads "15% of $60",
  "47 to the nearest 10", "5 for $9" as the price for one, and "-3 °C", so 2/4 is right for 1/2; a pick's
  `goal` can be 'biggest' or 'smallest') and `toQuiz()` turns each into a src/quiz item; `problem()`
  checks both. `exercise.js` draws the ten frame, arrays of dots, bars, 100 grid and a teach card's number line. Coach:
  Ada, an octopus (`src/cast/ada.js`, posed with `rig()`), with `MATHS_LINES` and `MATHS_HEADLINES`.
- `src/cast/` — the characters (`kit.js`, `rosa.js`, `lumi.js`), `coach.js` (a character that
  reacts in place) and `lines.js` (everything the cast says; the guardrail tests lint it).
  `tools/cast.html` renders every mood at 200/96/48 px, light and dark. `butterfly.js` is the
  player's butterfly (wing panels filled in habit colours), so far drawn only on the icon.
- **Lumi's skins** (`src/cast/skins.js`): seven things to wear, each `head` (in her head group, so it nods
  with her), `front`, `back` (the costume's wings: your own butterfly, by the kit) or `arm` (the costume's
  straps, in each `data-arm` group so `flap()` beats them). `lumi(mood, skin, colours)`; `worn(progress)`
  is `progress.skin` once its `skin:<id>` rule (`SKIN_RULES` in garden/model.js) is earned. Arrive through
  `award()` like anything else, listed on an end screen after a raised butterfly's stage; the wardrobe (`wardrobe()` in app.js, from ⋯
  and the garden) wears one with a tap. Worn wherever Lumi is drawn large and in the widget's poses; not
  in the pond (too small to read) nor on the launcher icon. Words: `SKIN_WORDS`. `dressed()` in app.js draws Lumi with the learner's butterfly in her head group (`lumi(mood, skin, colours, perch)`), on top of a hat by the skin's `perch` height, and never with the costume.
- **Coach voice:** each coach's voice sheet and line pools are data, one file each in
  `src/cast/voice/<coach>.json` (`voice`: personality, how they encourage and dare, `never` words;
  `lines` and `dares`: `{ when, lines }` pools keyed by habit, streak band, hour band, light, and the
  moments `first`/`comeback`). `say(coach, state, facts, rng, recent)` in lines.js picks the most
  specific line (filled slots like `{usualHour}` count as more specific; a line with an unknown fact
  is skipped), never one of `recent`, and sometimes a dare: once a day, only while the habit isn't
  done today, never first or after a gap. `moment()` in `src/cast/voice.js` reads state and facts
  from progress (log entries carry `hour`). Home's greeting uses it. For a Learn course `first` is the course's own:
  true until a lesson of that course is in `progress.done`, and it wins over `elsewhere` and `comeback`. New lines are drafted by hand
  with `tools/voice-draft.js` (Claude API, `ANTHROPIC_API_KEY`) into `drafts/voice/` for review,
  never into the pool; the guardrail tests lint every pool line and dare.
- **Words fit what just happened** (lines.js): a verdict pool can be narrowed by how the item was answered, `correct:hear`,
  `wrong:move`, `run3:look`… beside the general `correct`/`wrong` (`doing(item)` → hear, move, write or look; `verdicts()`
  joins the two; a test walks every Learn item). `finished()` picks an end screen's kind from the session's first tries:
  `nearly` is one miss among three or more right, and no `struggled` line counts misses. Learn log entries carry `course`:
  with Learning done today through another course, `moment()`'s state is `elsewhere`, which only `{ "elsewhere": true }`
  pools match, so a coach never says its own course is done when it isn't.
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
  that fails: tap a block, a tile replaces it, graded by running), and three laid out from nothing with the
  tap-only `src/builder.js` and run on **Run** (the one allowed Check, in the thumb zone): unscramble (the right
  blocks in the wrong order), palette (`limit` blocks or fewer, too few for plain steps, which forces a loop) and
  free (any program that gets there; `limit` is what fits). `way` is one program that works, shown after a miss.
  **Overshooting fails:** an item with a number tile or a layout runs `exact`, so reaching the flower with steps
  still to run ends 'spare' ("I got there with steps to spare"). `src/builder.js` knows nothing about Fennel: a tray of chips and
  an ordered tree with a cursor, or part-written text with holes (`start`), set out in lines by `breaks`: the code courses use it, and Japanese sentences could; a teach card marks
  what it introduces with `shows`. `view: 'js' | 'both'` shows a program as
  JavaScript from `toJS()`; code text is never stored. A new block goes through `slots()` (holes, flips),
  `run()`, `blocks()` and `toJS()`; looks are written once by `writeLook()`. Words in prompts
  and explanations get swapped on a flip, so "right" means a direction only. `exercise.js` draws
  the grid, the blocks and the tiles, and Fennel (`src/cast/fennel.js`, a fennec fox posed with
  `rig()`) walks it. His lines are `CODING_LINES`/`CODING_HEADLINES`, read through the subject's
  `coach.lines`/`coach.headlines`. Home's course switcher (shared with Japanese) shows it.
  **A missed run is shown before it is replaced:** the learner's own program stays for `MISS_HOLD_MS` (2.4 s, or until a tap;
  that tap's click never presses the Continue that comes up under it), marked by `markStop()` (`.stopped`, `.unrun`, the
  rock's `.cell.hit`), with Fennel saying `RUN_ENDS[howEnded()]`, one line for each way a run can end. Then the way that
  works takes its place and the reason goes first in the verdict. A rock and the edge are on a card before any item needs them.
- `src/code/` — the JavaScript, TypeScript and Test writing courses, treated like a language course: no typing, word chips placed in
  order, and **right is decided by running**, so any arrangement that does the job passes. `interp.js` is pure and safe: tokens, a parser
  and a tree-walker with a step limit (no eval, no Function, no way to a host prototype), plain-words errors, console.log captured.
  With `ts: true` it also parses annotations, interfaces, aliases and generics. `types.js` is a small checker for what the course teaches,
  strict-flavoured, not the TypeScript compiler. `items.js` holds the items (teach, build, gap, predict, `asks: 'check'`) and goals
  (`print`, `walk`, `returns` with hidden `cases`, `tests`), `grade()`, `problem()` (the way passes, no decoy swapped in passes) and `vary()`
  (names, numbers and words swapped, maps flipped, every version through `problem()`; a declared function keeps its name, and in Test
  writing the values move with the code's edges and what a test expects is worked out again by running `given`). **Chips are chunks at the level of thought:** `coarsened()` (courses/author.js) walks a course in order, a construct's first build (`learns`) is single tokens, and after that `chunksFor()`'s rules make its boilerplate one chip, standing down where a decoy needs a place; a test holds builds to 8 taps but for `learns`. Code is one source string in an item; chips (`chipsOf`),
  lines (`layout`, `pretty`) and answers (printed output, flagged lines) are worked out from it, and prose that says a number must find
  it in the code or set `fixed` (test/code-courses.test.js). `exercise.js` mounts on `src/builder.js`, the quiz's teach and pick, and `src/coding/grid.js`, the
  grid and walker Coding also uses; Fennel's calls map to Coding's `run()`, with `onRock(f)` and `onStep(f)` as his events. Courses are data
  in `src/code/courses/` (`author.js` is the shorthand; ids come from a lesson and its place, so add items at a lesson's end). A test checks
  that nothing is asked before a teach card shows it. **Test writing** grades as the rule below says: `given` is the real code, `mutants` hand-made faulty
  copies with `says` in plain words, and a miss names the one that got through. Guardrails bar "broken" in prose, so they are "faulty copies".
  A value in prose is printed by interp.js's `show(v, false)` (`called()` and `exampleOf()` in items.js): the course's own spelling, never JSON.
- `src/calm/` — the Calm practice subject. `routines.js` is pure: each routine is a list of timed
  phases (breathing 4 in, 8 out; the sigh 3 in, 1 top-up, 6 out; the butterfly hug's taps; the body scan feet to head), and `timeline()` plays one on a
  pausable clock. `practice.js` mounts teach cards and the routines with Moss (`src/cast/moss.js`)
  breathing along. `run()` in `app.js` skips meter, runs and review for kind 'practice', and ends on
  a calm screen with an optional "How do you feel?". Course in `src/data/calm.json`. Home shows one
  habit's path at a time (the switcher under the bar, remembered in `wingbeat.habit`). A Calm routine
  opens and closes on a soft bell and can have soft rain under it (`calmSound()`, `rain()` in
  feel.js, both generated): set on the ⋯ screen, both off until turned on, and both silent
  when Sound is muted or under reduced motion. A teach card states only numbers no timing can change; one that
  can is a slot (`{in}`, `{out}`) filled by `breathWords()` from the same `timed()` merge the routine plays (a test holds it).
- `src/reflect/` — the Reflect practice subject: three prompts, each skippable, self-paced like
  grounding, with Lumi coaching. "One good thing" first and "One thing for tomorrow" last never
  change; the middle one comes from the `middle` pool in `reflect.json`, chosen by the date
  (`middleFor`, the same all day), and its line is kept under `learned` with `asked` (the pool id)
  on the day's entry so the week view labels it right. What is written goes to `progress.journal`
  via `writeJournal`, never the log; the habit view shows it through the subject's `dayDetail`
  hook. The subject's `lookBack` (home: one line from seven days ago, else the newest older one,
  tapping it opens the habit view) and `readBack` (end screen: "Read back your week" once three of
  the last seven days have lines) return html and are the only other readers; our words around the
  lines are `REFLECT_WORDS` in `cast/lines.js`. No prompt asks about a bad feeling, and nothing
  interprets what was written. A subject's `again` ({ label, lesson } or { label, lessons }, in the course JSON) keeps a
  lesson on home once the path is done: "Reflect today", "Take a break". With `lessons` (Calm's longer routines, Move's last of each unit) `nextUp(units, again, log)`
  suggests the one done least recently, never-done first, ties in path order, read from the `lesson` that `finishPractice` puts on each log entry: "Breathe · A slower scan".
  Under that button, "Something else" (`chooseView`) lists every finished routine by unit, and for the guided habits but Reflect ends with "I did it away from the app":
  `logToday(…, 'Away from the app')` through `awayToday()`, so streak, day and wing count and nothing unlocks; once a day, home says so quietly (no count) with an Undo (`unlogToday`).
  Before any routine is finished the link reads "Did it away from the app?" and counts directly. Words: `CHOOSE_WORDS`. The learner's text is never linted or sent anywhere (a test checks).
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
  Both play through `coached()` in kit.js: the step and its time, how to do it (`how`), what's next, and
  a first-step room check, with no tap needed. Every timed routine's pause (`pauseButton`) is round and beside the coach. Course in `src/data/move.json`:
  Wake up, Strength (reps grow 5, 8, 10), Stretch, Back and neck, Seated, Balance. Every move is a
  gentle one public health services publish (NHS sitting, flexibility, strength and balance pages):
  nothing on the floor, no deep bends, no full neck circles, nothing fast, no kit beyond a chair or
  a wall. A new routine is data plus a pose, never a new flow. Clover has three rigs, each with its
  own resting phase: standing, seated (the `seat` prop, a chair; a seated demo never stands her up
  between reps) and balance (the `wall` prop, her right hand on it). Seated is all on a chair and
  Balance keeps a hand on the wall (move.test.js checks both). Guardrails bar pushing, health claims
  and body or weight words, and check the safety line is on every unit's first lesson and after "Not really".
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
  Every Learn course and every other habit raises a butterfly, a real species from the kit
  (`raisers()`, `grown()`, `creatures()`): a course by units finished (egg at its first lesson,
  caterpillar from 1 to n − 2, chrysalis at n − 1, butterfly at n), a habit by days at its plant's
  STAGES (1, 5, 14, 30). Each stage reached is a rule (`egg:`, `hatched:`, `chrysalis:`, `emerged:<id>`),
  so it is an arrival and never goes back; `guide()` feeds the field guide (`src/guide.js`, opened
  from the garden's bar and from home: the picture at the end of the streak row, `raising(c, true)`, drawn close up by
  `lifeBox()`, while a path is still raising its butterfly, and a one-tap habit's "Walk is raising a…" pill). Each habit also earns a bee (its
  first session, not Learning), its own species; the whole garden earns `LANDMARKS` (path, bench, birdhouse with birds, a frog at
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
- `src/garden/events.js` — pure: seasonal events, `eventOn(date, south)`, the 8th to the 21st of its season's middle month, six months apart by hemisphere
  (the same `south` as the season, so Sydney's winter festival is in July). `scene(mood, shape, season, event)` repaints sky and land and dresses the whole scene; the garden
  screen has a card and home's strip a small tag, neither saying when it ends. Its set (`src/data/events.json`) plays as an ordinary session of its subject, lesson id `event:<id>`,
  with no item keys so no review cards; a rule in model.js grants the gift, a landmark kept all year. Nothing is lost for missing one: it returns every year.
- `src/garden/art.js` — the garden's drawings, built like the cast: `plant(habit, stage, { flowers,
  closed })` (tree, lavender, sunflower, vine on a trellis, daisies, evening primrose; five stages, scaled by `GROW` so a
  sprout is about a third of full height and a sapling about half; up to 6 blooms that
  never overlap), `sway()`, `visitor(kind, species)`/`animateVisitor()` (butterfly, bee, birds;
  a butterfly is the kit's species, `BEES` and `BIRDS` the others') and, from `landmarks.js`, `layout()` (the path
  and fence behind the plants, each other piece at the nearest free spot, smaller when crowded),
  `landmark(gift)` and `animateLandmarks()`; and, from
  `scene.js`, `scene(mood, 'strip' | 'tall')`, `slots(shape, n)` and `place()`. Scene colours carry
  their own dark set. `tools/garden.html` renders it all; check it in light and dark.
- The garden screen: `drawGarden(garden(), 'strip' | 'tall')` (art.js) is the strip at the top of
  home (one button into `gardenView()`) and the full view, plants and visitors at `perches()`;
  `liven()` in app.js moves them: a gust (`gust()`, scene.js) rolls left to right every few seconds and
  leans the grass and each plant in turn; `animateScene()` drifts clouds, pulses the sun, twinkles glints
  and stars and wanders fireflies; flies in visitors that just arrived (`data-new`), and pauses offscreen or hidden. A plant or its card opens
  `habitView(id, back)`. `award()` returns `newly` most important first (a raised butterfly's stage, then a skin, a landmark, a visitor, a flower); `listed()` caps what an end screen lists at three lines, two above "How do you feel?", and the rest is "and N more in your garden".
- Garden sounds are real files, `assets/sounds/*.wav`, made by `node tools/sounds.js` (plucks,
  bells, chirps, a buzz, all synthesised there, so they are ours to ship). `chime(gift)` in feel.js
  plays one through an `Audio` element (src/ never calls fetch): `plant` when a habit is added, and
  the first arrival's sound when something arrives: its gift (`flower`, `butterfly`, `bee`), or a
  landmark's `sound` (`build`, `birds`, `pond`, `lantern`, `bee`).
- **Self-reported habits** (kind 'log'): no path, one tap a day ("I walked today"). The habit list is
  `habitsFor(progress)` in subjects.js, never HABITS alone: the built-ins, then PRESETS (Walk, Read, Water,
  Outside, Tidy, Floss, Music, Make, Call; each with its own plant, wing colour and species) and the
  learner's own from `progress.tracked`. `logToday`/`unlogToday`/`track` in progress.js; the tab's
  panel, the "+ Habit" sheet (presets two to a row, so it fits 360x640) and the make-your-own form in app.js
  (`logPanel`, `addHabit`, `editHabit`). Learners' habit names are never linted and always escaped.
- **A habit's "when"** ("After breakfast"): one optional line per habit id, any habit, in `progress.when`
  (`setWhen()`; optional, read leniently by `migrate()`, merged like timings). `whenView()` in app.js asks
  "When will you do it?" (a few picks, or their own words; Skip is one tap) after a one-tap habit is added,
  and from every habit view ("Tie it to your day" / "Change when"). Shown on a one-tap habit's panel and in
  the habit view, never on a guided habit's home. The learner's words: escaped, never linted, never sent
  unsealed. Our words are `LOG_WORDS.when*`.
- Home's top is kept short so the path starts in the top half of the page and the next lesson's node shows without
  scrolling at 360x640 (`layouts.spec.js`): no title bar (the `<h1>` is for screen readers), a cropped garden strip
  that nothing may cover, the courses in one row, the coach's line, then one row for your butterfly, the streak line
  and what the path is raising, and "Skip ahead" in the footer, under Continue. **Before adding a row to home, take
  one off** (docs/WINGBEAT.md, decisions 22 to 24).
- Home lists each habit once: one row of tabs (icon, name, streak coloured by `light()`) that
  scrolls inside itself, with ⋯ (Settings) pinned at its right end. Sound is a switch on the ⋯ screen.
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
- **The reminder brain** (`window.wingbeat`, set in app.js over the live progress, before
  `tellAndroid`/`passNotes` run): plain functions for the Android wrapper (see Android below).
  `reminderHour()` → 0–23, or null with too little data (then `REMIND_AT`, 18:00, in widget.js);
  `shouldRemind()` → boolean, false after a session today or while reminders are thinned or paused;
  `noteReminder(outcome)` with `'opened'` (tapped) or `'cleared'` (swiped away) for every note shown
  → true, or false for any other value (nothing recorded). Nothing leaves the device.
- **QR pairing** (`src/sync/qr.js`, our own small encoder, no licence to carry): the code beside the 6 digits opens `<page>#pair=<code>`. `openPairLink()` reads the fragment (never sent to a server), clears it and fills in Enter a code; linking takes one tap, unlike typed digits, since anyone can make a QR code.
- **Sync and friends** (`src/sync/`, `server/`), opt-in and off by default: with it off nothing is sent
  and Wingbeat works with no backend. **Feature-flagged off** until the API is deployed: `SYNC` in
  `config.js` gates `available()` (the ⋯ section, every call) and the sync parts of `privacy.html`;
  tests set `window.WINGBEAT_SYNC = true` before load. `keys.js`: the recovery code is the profile's secret, kept on the
  device (`wingbeat.sync`); HKDF gives the AES-GCM key progress is sealed with and the bearer token the
  server knows the profile by (it stores the token's hash). A 6-digit pairing code carries the
  recovery code to a new device, wrapped with PBKDF2. `merge.js` is pure: cards per card (latest
  review wins), log/done/journal/garden as unions, streaks replayed from the merged log with
  `nextStreak`. `sync.js` is the only file in src/ that calls fetch (a guardrails test holds it);
  `config.js` holds the one API constant. `ui.js` is the four ⋯ screens; friends see a card of presets
  and numbers only (`presets.js`, which the worker also imports to check them). `server/` is the
  Cloudflare Worker + D1 (`worker.js`, `migrations/`), tested with Miniflare (`npm test --prefix
  server`); e2e routes the API host to a local worker. Deploying is `server/DEPLOY.md`. `privacy.html`
  is the policy, with delete-by-recovery-code for Play. Inside the Android wrapper
  (`WingbeatBridge`), which has no internet permission, the ⋯ section is hidden and sync never runs
  (`available()`). The card's name and animal are `progress.look` ({ word, animal, at }), synced, the
  latest pick winning.
- `src/nav.js` — the phone's back button, on web and in the wrapper with no Kotlin. It watches #app, so
  every screen change goes through it with nothing to call: a screen needs only a back control `BACK`
  matches (`.close`, `.back`, `[data-back]`…), which back presses; a screen with none counts as home,
  and back there leaves the app. An open `<dialog>` closes first. A new screen that isn't home must have one.
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
after `npm ci` at the root. App id `com.joebywan.wingbeat`, locked.

- The web app is not copied into git: `copyWebAssets` syncs index.html, styles.css, src/, assets/ and
  the three import-map packages into the APK, served from `https://appassets.androidplatform.net` by
  WebViewAssetLoader. No INTERNET permission; CI fails the build if one appears.
- `src/widget.js` makes every choice: `look(light, hour)` → background, Lumi pose, line pool
  (`WIDGET_LINES`, linted), and `summary()` a schedule of looks over the next days' boundaries
  (midnight, 5, 12, 18, 22). `save()` passes it to `WingbeatBridge.summary()`, so Kotlin only renders.
  The page also sends Lumi's poses as PNGs (`art`). In a browser there is no bridge and nothing runs.
- `Daily.kt`: the widget, an inexact alarm at the next look and at the note's hour, a 15-minute
  WorkManager job, `Ticker` re-arming on BOOT_COMPLETED and MY_PACKAGE_REPLACED. The daily note is
  opt-in on the ⋯ screen, low importance, at most once a day, and posts nothing if anything was done
  today. The reminder brain (`window.wingbeat`, feature-detected) sets the hour (`reminderHour()`, null
  → 18:00) and can say not today (`shouldRemind()`), both snapshotted into the summary; whether each
  note was opened or cleared is queued in Kotlin and handed to `noteReminder()` on load. Logcat tags `WingbeatBridge`, `WingbeatDaily`. Test path (debug builds only skip the once-a-day guard):
  `adb shell am broadcast -n com.joebywan.wingbeat/.Ticker -a com.joebywan.wingbeat.REMIND --ez force true`.
- **What the WebView lacks:** `speechSynthesis`, so `speak()`/`voice()` in feel.js use `WingbeatBridge.hasVoice`/`speak` (Android's
  TextToSpeech; the manifest's `<queries>` lets it find the engine). With no voice for the course, a teach card offers
  "Get a Japanese voice" once (`offerVoice()`, `wingbeat.voice-offer`), which opens the engine's ACTION_INSTALL_TTS_DATA
  screen (`WingbeatBridge.installVoice`). `navigator.vibrate` needs the VIBRATE permission.
- **System bars follow the page:** on every screen change and theme change app.js hands the body's background to
  `tellBars()` (widget.js), which keeps `<meta name="theme-color">` current and calls `WingbeatBridge.bars(color, light)`,
  so Wind down's night palette darkens the bars in light mode too.
- **Dark theme:** the page and the system bars follow the phone's night mode, live (the activity handles `uiMode`
  itself) and from a cold start. While the WebView loads, the window shows the page's own background
  (`values(-night)/themes.xml`), so the wait isn't a flash.
- **Large text:** the WebView follows the phone's font size (`textZoom` is not pinned). app.js measures it once, and
  when it is above 1 sets `--text-scale`, which the path's rows, nodes and labels and the room under fixed bars
  multiply by. A browser never sets it, so the web app is unchanged. A px `line-height` is already scaled by the text
  zoom, so don't multiply one. In a browser `TEXT` reads the browser's own
  font size too (probes at 6.25rem and .8rem), so a larger default or minimum font size sets `--text-scale`; zoom never does, since it enlarges px as well.
- **The widget** lands one row high (`minHeight` 40dp) and can be stretched taller; Lumi is sized to the space, at
  most 96dp. The launcher's list shows the layout itself (`previewLayout`), with the tagline. A count of 0 is sent as
  null, so there is no number before there is a streak.
- **Back:** home leaves the app, except within a second of a back that landed there (MainActivity), so a quick
  double press out of a routine stops on home.
- The icon is Lumi close up with the butterfly on her crown, on the garden green, generated by
  `node tools/icon.js` from `lumi()` and `butterfly()`: the adaptive icon's foreground and monochrome
  layers (vector drawables converted from the same SVG; the wing panels are clip-path groups and
  the right half a `scaleX="-1"` group), `assets/icon.svg` (favicon) and `assets/icon-512.png`
  (manifest and Play listing). It fails if her face or the butterfly leaves the 66-unit safe circle.
  Rerun it when either changes.
- Play: **Publish to Google Play** (`publish-play.yml`), by hand only, takes the bundle from a release, checks it with `android/tools/verify-aab.sh` and uploads to the internal track. Inert until Joseph's steps in docs/TODO.md.
- Releases copy Daybook: `assembleRelease` only, by hand from the **Android release** workflow;
  `-PrequireSigning=true` fails without the key, and `android/tools/verify-apk.sh` fails an
  unsigned, wrong-key or debuggable APK. The key is Joseph's, kept offline. To set it up once: create
  it, put its certificate SHA-256 in `android/release-key.sha256`, and add the repo secrets
  `WINGBEAT_KEYSTORE_BASE64`, `WINGBEAT_KEYSTORE_PASSWORD`, `WINGBEAT_KEY_ALIAS`, `WINGBEAT_KEY_PASSWORD` (or set
  `WINGBEAT_KEYSTORE` etc. as env vars or `-P` properties for a local build).

## Rules

- **Reuse before you add.** Daybook bloated from copied code; Wingbeat must not. Before writing a
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
- **Sessions adapt.** `src/adapt.js` reads `progress.answers` (each answer: key, right, ms, `hinted?`, `warm?`, on the device,
  last 400). A session finishes on evidence (`nextGo`, `comeBack` in repeat.js): a missed item, echoes included, comes back
  fresh until one right lands it, two in a row if it was missed more than once, within `GOES` (4) goes and `RETRIES` (5)
  repeats a session, then it is left for review with a kind line (`MOVE_ON`). Right first time adds nothing. A miss drops
  that item's pending echo. Two misses in a unit's last four answers (a right after a hint, reported through `done`'s
  `{ hinted }`, counts as a miss and otherwise plays as one) inserts a second explanation (`helpFor`:
  `src/data/lesson-help.json` where a lesson has its own, else `src/data/help.json`, every Learn unit has one) and a smaller
  earlier item, once a session, and drops the remaining echoes; repeats favour what was missed; 8 clean rights in a row in
  a course cuts echoes to 1. Only the first try schedules a card.
- **Sessions drill.** `src/repeat.js`: a lesson opens with up to 2 earlier cards (the closest to slipping, never the ones that
  opened the last lesson, read from the log's `warm`), ends with up to 2 of its own items again ("Once more", not
  rescheduled), and each unit ends in a Checkpoint mixing it (`mix`). A subject's `vary(item, random)` makes a repeat fresh:
  Coding and Maths items with a `family` play a precomputed entry from `src/data/{coding,maths}-variants.json` (written by
  `npm run variants`, `tools/variants.js`: templates work out level, program, tiles and words, fixed seed,
  `test/variants.test.js` checks the bytes; never hand-edit a pool), a count item never with the same number, Coding flipped
  at random too. Without a family, Coding flips the map. Japanese (`src/quiz/vary.js`, works for any script course) asks the
  other way round or by ear, with decoys only from kana taught by that point on the path. Chess mirrors stars, and `move`,
  `find`, `tap` and `truefalse` items where safe (no castling, nor a `name` tap, whose words teach where the square is; never text naming a wing or square colour; `problem()` must pass, else null):
  `echoable` keeps a real-game puzzle out of its own session. Returning the item means "worth repeating as written", null
  means "don't". A new read or build item joins a family only if that family uses nothing taught after it. The card key
  stays the original's. `node tools/sessions.js` prints how long sessions get; `test/sessions.test.js` holds the bound.
  E2E flows set `window.WINGBEAT_PLAIN` (`test/e2e/fixtures.js`).
- **The streak forgives.** One missed day in any seven is forgiven automatically; a gap of up
  to three days (or a second miss that week) is repaired by a review. A lesson finished in a
  repairable gap leaves the streak waiting for that review. Rules in `progress.js`, tested with
  fixed dates.
- **Guardrails are tests.** `test/guardrails.test.js` lints every cast line (and what Rosa says
  mid-puzzle) for ability praise and loss or guilt words, and holds celebrations to the
  `CELEBRATIONS` whitelist in `lines.js`: learning events only.
- **No XP or points.** Leagues and boosts are out, so points would only reward activity. The
  summary shows what was learned: right first time, the streak, and items learned so far.
- **Exercises that grade code must grade it independently.** In Test writing (`src/code/items.js`), a learner's
  tests pass against the real implementation and fail against several broken ones; don't grade by matching text.
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
  JS bridge, as Saffron Road does. Wingbeat is meant to drive people to learn, not to earn.

- **Every streak is a habit's streak** (Learning, Calm, …), each with its own tab and the
  same forgiving rules. Practice subjects are guided routines with no right or wrong. The plan
  and its task list: `docs/HABITS.md`.

## Open

What is still open: `docs/TODO.md` ("Still open") and `docs/HABITS.md`.

- **Beginners play, they don't pick notation.** Answers are moves on the board or taps on squares;
  text says "Knight to c7", never "Nc7+" (`words()` turns SAN into words). Boards show coordinates.
- **No questions in the way.** A first visit opens a short, skippable intro (`intro()`/`want()` in
  app.js, words in `INTRO_WORDS`): what Wingbeat does, then Learn something / Build habits, each opening
  its list, with one line under each thing saying what it is (`INTRO_WORDS.about`; a one-tap habit shows its tap).
  The picks go in `progress.picked` and are what home shows, first (ONE function orders the tabs, `ordered()` in
  subjects.js): everything else is hidden through `tracked` (`{ id, hidden: true }`, for a built-in habit or a course
  too; `habitsFor()` and `coursesFor()` read it), one tap away under + Habit and the course row's + Course.
  Picked one-tap habits are switched on with `track()`. Skip is today's home (Lumi's welcome line, the garden,
  everything shown), and a save from before this shows what it showed. Shown once (`showsIntro`); saves from before
  v7 never see it. The ⋯ menu's "Change what you see" reopens the second step, starting from what home shows. It never asks placement. Placement is an optional part of a subject: its `placement` (chess has one) shows as a
  "Skip ahead" link under Continue; the question then suggests a starting unit, or the learner starts
  from the beginning. Answering or dismissing (×) hides the offer for good (`progress.start`, per
  subject), and so does finishing the subject's first unit; starting a lesson never asks. Units before the start stay open.
