# Wingbeat backlog

Ideas agreed in principle. Most are now built (each section says where); what is genuinely left is
under **Still open** at the end.

## Cross-device profiles and friends

**Done** (#73, #81): src/sync/, server/, privacy.html; see CLAUDE.md. Deploying it and
sync inside the Android wrapper are under Still open.

Decided 2026-10-29 as the shape to build, when it's time:

- **No accounts.** A profile is a secret key held on the device. A new device joins with a
  short-lived 6-digit pairing code (or QR) shown on one already linked; a saved recovery code
  restores it if every device is lost. No email, no passwords, no third-party sign-in (Google
  blocks its sign-in inside embedded WebViews, which rules it out for the Android wrapper).
- **The device stays the source of truth.** localStorage is still the record; sync sits on top,
  so Wingbeat works offline and in a browser with no backend at all.
- **Two things are uploaded:**
  - the full progress, **encrypted on the device** with a key derived from the recovery code
    (WebCrypto, no library). The server stores it but cannot read it. Conflicts are merged on
    the device (FSRS cards per card, latest review wins).
  - a small **public card** in plain form: streak, lessons done, current unit, chosen avatar.
    The server shows it only to accepted friends.
- **Friends** swap short friend codes and see each other's card. One cheer a day from a fixed
  set. Preset names and avatars, no free text, no search, unfriend/block: nothing to moderate.
- **Hosting:** Cloudflare Workers + D1 on the free plan ($0 at thousands of users; past the
  free limits requests fail, nothing is billed). Workers Paid ($5/month) is the next step;
  one D1 database tops out at 10 GB (~200k users at ~50 KB each). The app talks only to our
  own small sync API, so the backend can move without an app change.
- **Domain:** move knowhowit.com.au's DNS from FreeDNS to Cloudflare (free) so the API lives at
  `api.knowhowit.com.au`, an address we own. A CNAME to `workers.dev` does not work.
- **Obligations:** a short privacy policy; delete-my-data in the app and on a web page (Play
  requires both for apps with accounts); export for EU users. Storing no email keeps this small
  and safe for under-13s.

Researched 2026-10-29: Supabase (pauses after a week idle, 2 emails/hour built in), Firebase
(5 sign-in emails/day on free, highest lock-in), Appwrite (deletes idle projects after 90 days)
and a self-hosted PocketBase (~€6/month, own backups) were the alternatives.

## Feel

**Done** (#67, #59, #64).

- More animation and sound throughout lessons and the path. Done: answer pop and shake, petal confetti, the
  path filling as Lumi hops, the next node bobbing, and generated cues for each (`cue()` in feel.js).

## Android wrapper

**Done** (#78, icon #79): the wrapper, WingbeatBridge, the widget, the opt-in daily note and the
release checks. The signing key and Play publishing are under Still open.

WebView shell serving the bundled app from `appassets.androidplatform.net` (as Saffron Road),
no internet permission, then a JS bridge passing a session summary, a home-screen widget
(streak flame tinted by today's light; Lumi plus one line) and opt-in local notifications.
Release setup copies Daybook's: one signing key from the first build, `assembleRelease` only,
checks that fail unsigned, wrong-key or debuggable APKs. App id `com.joebywan.wingbeat`.

Widget and reminder mechanics, from a friend's Android habit app (Fizz) reviewed 2026-10-30:

- **Refresh at the boundaries, not just on a timer.** A 15-minute WorkManager job plus an
  inexact alarm at each point where the widget's look changes (midnight, and any time-of-day
  line pools). Midnight matters most: that's when `light()` can turn soft or ember.
- **One pure function picks the look:** `(light, hour) → background, Lumi pose, line pool`.
  Test it on the JS side and pass the result over the bridge, so the Kotlin side only renders.
- **Re-arm on `BOOT_COMPLETED` and `MY_PACKAGE_REPLACED`.** Android drops alarms on reboot
  and on update; a receiver for both re-schedules reminders and the widget refresh.
- **The reminder checks before it speaks:** if today's session is done, post nothing.
- **Not copied:** Fizz's escalating 19:30 / 21:45 / 23:00 "code red" nudges and panicking
  mascot (guilt, against the guardrails), and `USE_EXACT_ALARM`, which Play reserves for
  alarm and calendar apps. Inexact alarms are fine for a once-a-day reminder.

**The Android app: played** (2026-11-20, emulator Pixel 6 API 36, debug APK, `npm run phone -- app`, `test/phone/app.js`)

Installed and played with real taps through the WebView (`attach()` in `tools/phone.js`). The launcher icon is Lumi close up
with the butterfly on her head; the app opens on the intro ("Small beats go a long way.") 5 to 14 s after the tap on a busy, cold
emulator, on the page's own background colour meanwhile, light or dark, never white; no INTERNET permission; no error from
`WingbeatBridge` or `WingbeatDaily` and no failed request all run. A first day (`butterfly.js` and `calm.js` played in the
app) passes: sound and haptics come through for the app's own package, the end screen shows today's wingbeat with its new
panel, home shows the butterfly. Japanese speaks through the phone's engine (it logs each utterance it starts). The widget
was placed through the launcher (long-press, Widgets, Wingbeat, Add): it lands one row high, stretches to two, shows its own
layout in the launcher's list, and is right in all its states: flying, basking, resting, the streak number for Learning,
none for Calm or Reflect, and none before there is a streak. The daily note posts "Something small today? Lumi is around.",
in the shade under a butterfly seen from the side, opens the app when tapped, and posts nothing on a day with something done,
forced or not. The page and the bars follow the phone's theme, live and from a cold start, and Wind down's night palette.
Back from a routine lands on home, a quick second back stays, a third leaves. The WebView follows the phone's font size
(`textZoom` is no longer pinned): at 1.3 and 2.0 every screen with much text was walked (home for each habit, a lesson in
five courses, a Calm and a Move routine to their end screens, "Your butterfly", the field guide and a species, ⋯, the
wardrobe, "+ Habit") with nothing wider than the page, cut off, out of its node or out of reach under a fixed bar.

- **Dark theme looked broken, and wasn't** (fixed in the runner). Playwright pins `prefers-color-scheme` to light on every
  page it drives; `helpersFor` now lets the phone's own night mode through.
- **Large text** (fixed): the path's rows and nodes, and the room kept under fixed bars, grow with the text (`--text-scale`,
  set by app.js only when text is scaled, so a browser is unchanged).
- **The widget** (fixed): one row on landing, Lumi sized to the space, `previewLayout`, no "0".
- **The Daily note switch showed no On or Off** (low, fixed).
- **At 2.0 it is cramped**: a home screen shows the path's first node and little else above Continue, and an end screen's
  feelings sit under Continue until scrolled. Everything is reachable; whether the fixed bars should shrink at 2.0 is a
  design call.
- **Not checked:** the "Get a Japanese voice" offer (this image has a ja-JP voice); a launcher other than this image's; a
  release build.

## Fitting the person

Agreed 2026-10-30: Wingbeat learns from its own on-device log how to fit the person, so it reacts
in a way that suits them. It isn't there to guess their feelings. Fizz logs similar events to a
JSON Lines file but never reads them back; Wingbeat should use them. Needs HABITS.md task 13, and
the Android wrapper for anything about notifications.

- **Remind when they actually practise.** Learn the hours sessions usually happen and send the
  reminder then. Don't remind early in the day if they never play then.
- **Back off from ignored reminders.** Log each reminder as opened or cleared. If they only ever
  clear them, remind less, or not at all, and say so once as a passive line in settings.
- **Notice a drop-off and offer a comeback.** When sessions per week fall well below their own
  usual, start a personalised comeback event built from what they did most (their favourite
  practice, at their usual hour, with a garden visitor as the reward). Inviting, never guilt.
- **Adjust what's offered.** A practice often left at the same step gets a shorter version
  offered; the ones they finish most come first on the path.
- Everything stays on the device, can be seen in the habit view, and goes in the file export.

**Done** (#80, on #62's log): built in `src/fitting.js` (see CLAUDE.md): the reminders themselves are the Android wrapper's,
which calls `window.wingbeat.reminderHour()`, `shouldRemind()` and `noteReminder(outcome)`.

## Coach voice

Agreed 2026-10-30: like Duolingo's characters, each coach has lines that encourage and,
sometimes, antagonise or challenge the player to get them to play more ("Moss bets you can't
do three slow breaths before lunch"). A challenge is a dare in character, sent once; it is not
Fizz's escalating run of panicked nags. Wingbeat needs a way to generate these lines either way:
a tool that drafts lines per coach and state with an LLM at authoring time, for review and
committing, with the coach's voice described once per character.

Still open: whether lines are also written live on the device. Fizz writes its mascot's lines
with Bedrock (a cloud model, with built-in lines as the fallback). For Wingbeat, which has no
internet permission:

- **Line pool:** many hand-reviewed lines per state (habit, streak, hour, light, comeback),
  drafted with an LLM at authoring time and shipped in the app, with slots for the person's own
  facts ("your usual evening breathing"). No download, same on web and Android.
- **On-device model:** Gemma 3 (270M or 1B) via Google's LiteRT / MediaPipe LLM runtime runs on
  most phones and on the web with WebGPU, but is a download of several hundred MB; Gemini Nano
  via ML Kit needs a recent flagship. Small models drift off a character's voice, so the pool
  stays as the fallback either way. Check the current options before choosing.

**Done** (#68; plan #61). Shipped: the line pool (`src/cast/voice/*.json`, `say()` in lines.js, `tools/voice-draft.js` for
drafting with Claude at authoring time). The on-device model is still later: Wingbeat has no internet
permission, and the pool stays the fallback even then.

## Ideas from the Duo council

- Ranked suggestions from the 2026-10-30 Duolingo research council, checked against the code: `docs/DUO.md`.

## Still open

- **Joseph's steps.** Sync is built but flagged off (`SYNC` in `src/sync/config.js`) with no
  backend planned for now. To turn it on: deploy the sync API (`server/DEPLOY.md`: Cloudflare account, the DNS move to
  Cloudflare, D1, one deploy), then set `SYNC` to true. Create the Android release key once, put its SHA-256 in
  `android/release-key.sha256` and add the four `WINGBEAT_KEY*` repo secrets (CLAUDE.md, Android).
- **Renovate token: waiting on Joseph.** Renovate runs every Monday (`.github/workflows/renovate.yml`), but with the
  default token it can't open update pull requests (the repo doesn't let Actions create them) or change workflow files,
  and CI wouldn't run on its pull requests. Create a classic personal access token with the `public_repo` and `workflow`
  scopes and save it as the repo secret `RENOVATE_TOKEN`.
- **Play publishing: written, parked.** No Play launch until Joseph is happy with the app (his call, 2026-11-20).
  `.github/workflows/publish-play.yml` uploads the signed bundle from a GitHub release to Play's internal track. It runs by hand only and refuses to run without its secret or a bundle signed with
  the pinned key, so nothing happens until these steps are done:
  1. The release key first (Joseph's steps above), then run **Android release** once; the release now carries the `.aab`.
  2. Make a Play Console developer account and create the app, package `com.joebywan.wingbeat`.
  3. Upload that first `.aab` by hand to Internal testing and roll it out: the Play API can't release to an app still in draft.
     Choose Play App Signing with the release key as the upload key; `verify-aab.sh` pins that key.
  4. In Google Cloud make a service account with a JSON key; in Play Console, Users and permissions, invite it with release rights to this app.
  5. Add the JSON as the repo secret `PLAY_SERVICE_ACCOUNT_JSON`.
  6. Run **Publish to Google Play** from the Actions tab. Each later upload needs a higher version code, which the release's run number gives.
- **Sync on Android.** The wrapper has no internet permission, so sync is hidden there. Adding it
  is a decision (and a CI check to change).
- **On-device model** for coach lines (Coach voice above). The pool stays the fallback.

## To test or improve

From the repetition work and the Coding expansion, 2026-10-30. None of it is confirmed as a bug yet.

**Test by playing**

- **Blank button label in Firefox for Android.** Joseph has seen it a few times, on the JavaScript Meet screen: the green button at full height with no text. It stayed blank until he left and opened the course again, so it is a stuck draw that a rebuilt screen clears, not a slow one. The text and colour are right, so it isn't being drawn. Not reproduced: 39 runs of the old code in Firefox 159 on the emulator, which renders in software, including scrolling during the entrance and a shorter screen.
- **Session length, on a real phone and a real beginner.** The emulator played all 64 Coding lessons (see "Coding: played" below), but at an
  idealised pace. Check a first-time learner still feels small wins, not a slog, with warm-ups, "Once more" and checkpoints in.
  Chess, Maths, Japanese and the code courses haven't had the same pass: `tools/play.js` is the harness.
- **Real touch on a real phone:** the emulator covered tapping, drag and the small-phone size for Coding; a real finger and a real keyboard still haven't.
- **Sound and motion in the new units.** Live values and the drawing trail under normal motion were
  only seen in a one-off script: e2e runs with reduced motion.
- **The live site** beyond its start screen, on a phone and from another network.

**Coding: played** (2026-11, emulator Pixel 6, `CODING_UNIT=n npm run phone -- coding-all`, `tools/play.js`)

All 13 units, 64 lessons (checkpoints included), by real touch with warm-ups and echoes on: no wrong answer from the course's own
`way`s, no page error, no failed request, no sideways overflow, nothing untappable. Sessions are 8 to 13 items (checkpoint 8) and about
1 to 2.2 minutes at a steady pace; none near 6 minutes or 20 items. The longest are `bug-3` (13 items, ~2:14), `loops-4` (~2:09),
`bug-1` (~2:08) and `draw-3` (~2:04, 59 to 67 taps, the most). The estimate is a learner who reads and knows the answer, so real
sessions run longer. A quarter to a third of every session is repeats (2 warm-ups, 1 to 2 echoes).
`js-0` is the lightest in taps (25 for 12 items: mostly reading) but not slow. The other named lessons (`if-3`, `until-2`, `bug-1`,
`bug-2`, `logic-2`, `list-2`, `draw-0`, `param-0`, `param-1`, `js-3`, `js-4`) play like their neighbours.

- **A tall program under the tray or the verdict: fixed on a 412x786 page** (`fit()` in `src/coding/exercise.js`). A program that would reach
  under the tray, or under the verdict to come (measured with the item's own explanation), gets room from the coach (as on a short phone), the gaps
  and then the map, down to 28px squares (36px where a square is tapped). `var-3`, `param-2`, `draw-3` and `bug-3` now play with no `overlap` or
  `verdict covers` and nothing to scroll. Where it still can't fit, the program scrolls in its own box (fading out while there is more below), the
  block being run is kept in view, and once answered the box ends above the verdict with the block where the run stopped (or the fix) in view.
  **Left:** on a 412x533 page the verdict takes most of the screen, so an answered tall program shows in a box 27 to 120px high (part of a row to a few
  rows, the block that matters among them); the program reads whole while asked, short of 3 to 4px in `var-3-grow`, `bug-3-count` and `bug-3-sign`. A laid-out answer (palette, free) that
  is long still scrolls in its box at 412x786, as before. The fade uses scroll-driven animation, which Firefox lacks (there it just scrolls).
- **Small tap targets and mis-taps** (low): every block to tap in a program (Coding and the code courses) gets an invisible target sized by
  `reachOf()` in `src/builder.js`: toward 44px each way into empty space, but only halfway to any other block to tap, so no target lies over
  another's box. Before, on a short phone, `bug-3-sign`'s `<` had the value below's target over its bottom edge, and a tap on it emptied
  "change steps by 1" instead, so the harness got stuck. Most of that was the harness: it aimed every short-phone tap 37 screen px (14 CSS px) low,
  measuring where the page sits before `wm size` moved Chrome's toolbar. It now measures again after the resize, flags a target partly covered by
  another, and flags a tap that a different element took. Short-phone runs before this (`small-u8`, `small-u11`) were aimed low too. A wrong pick in
  find-the-bug was never a trap: tapping another block picks that one instead, and filling the wrong one counts as a miss with the explanation.
  Still narrow: blocks 28 to 30px wide or tall that sit 0 to 6px from a neighbour get only half the gap, so a tight row on a short phone gives
  a thumb less than 44px; that needs more room between rows, a layout change. The harness measures drawn sizes, so it still lists these.
- **Not played yet:** a real beginner, a real finger, Firefox, and sound with the new motion. The drawing trail and live values were seen only
  in passing.
**Coding: bigger improvements**

- **Fresh numbers.** Done for Coding and Maths (#99, `tools/variants.js`), find-the-bug and the one-offs included. `frac-2-4q` stays
  as written; `bug-2-h`, `list-2-add` and a few other one-offs still only flip.
- **Laying out the structure, the biggest tile and Run: done** (`src/builder.js`, `exact` runs in `program.js`).
- **Events** ("when Fennel reaches a rock"): done in the JavaScript course's Callbacks unit (`onRock`, `onStep`).
- **The JavaScript course like a language course: done, with TypeScript and Test writing** (`src/code/`). Japanese sentences could use the same builder.

**Code courses: to judge by playing**

- **Pacing and tone: played, see below.** All 68 lessons have now been played on the emulator (JavaScript, TypeScript, Test writing); a real
  beginner, a real finger and a real keyboard have not. Judging whether the chips are the right size still wants one.

**Code courses: played** (2026-11, emulator Pixel 6, `CODE_COURSE=javascript|typescript|testing CODE_UNIT=n npm run phone -- code-all`, `tools/play.js`)

All 21 units, 68 lessons (JavaScript 39, TypeScript 15, Test writing 14, checkpoints included, 724 items), by real touch with warm-ups and echoes
on, answers worked out from the item with `src/code/items.js` (`wayOf`, `chipsOf`, `optionsOf`): no wrong verdict for a right answer, no page error,
no failed request, no sideways overflow, nothing untappable. Sessions are 8 to 13 items (checkpoint 8) and about 0:40 to 1:35 at a steady pace;
none near 6 minutes or 20 items. The longest are `jsn-1` and `jsl-3` (~1:35 each; `jsn-1` has the most taps, 59), `jse-2`, `tb-2`
(~1:27, 56 taps) and `ts-1` (~1:25). The estimate is a learner who knows the answer, so real sessions run longer. The short phone
(412x533) played the two longest lessons of each course (`jsn-1`, `jsl-1`, `tsa-1`, `tsi-1`, `tb-2`, `ts-1`) with the same result.

- **What a build printed is hidden under the verdict** (medium). The "What it printed" line sits just above the tray, and the verdict banner covers
  the same place, so after Run the learner never sees the result they made (49 lessons, every print item; the goal "It should print" stays in view
  above, and a miss says what it printed). Coding's last-line problem, in another part. Fix: put the printed line above the answer, or in the verdict.
- **A tall answer runs under the verdict** (medium). Fill-in (gap) programs set every line with a blank line between, so a 7-line function is as tall as
  the screen: `tsi-2-5` loses its closing `}`, `tb-2-5` its last `});`, `jse-3-7` the same. Same fix as Coding's: scroll inside the box, or
  tighter lines.
- **The tray scrolls in a small box and shows half a chip** (medium, short phone worse). Test writing items with 8 or more long chips (`tb-2-4`, `tb-2-7`,
  `ts-1-3`, `te-1-9`, `tsi-1-9`) fill the tray's space, so the last row is cut in half under Run and only a thin scrollbar says there is more. On
  a short phone the code under test (`band(n)` in `tb-2-7`) also shows 4 lines in a scrolling box, so the function being tested is partly out of sight.
- **A long answer scrolls inside its own box with its top hidden** (low). `jse-1-8` shows the lines after `function run(f) {`; the first line is
  scrolled out. The page does not scroll, so nothing is lost, but it looks as if the chip was not placed.
- **A filled block is 32px high** (low): a placed word in the answer (`button.block`); the tray's chips are all 40 or more.
- **Wording** (low): "For example `cost({"name":"a"}) gives 0`" writes the input as JSON (quoted keys) before the course has shown that form;
  "Five! Those lines run like clockwork." and "Five in a row." appear on a streak with no mention of what the five are.
- **Harness bug found and fixed in passing:** `btn(name)` in `tools/phone.js` ignored `{ exact: true }`, so `btn('Continue', { exact: true })` could hit a
  chip named `continue` and `btn('Run')` a chip named `run(`, stalling `jsl-4` and `jse-1` until the fix.
- **Fresh versions in Test writing** mostly rename: its numbers would need the expected answers worked out again.
- **The type checker is a small subset.** It follows strict TypeScript for what the course teaches. A valid but unusual arrangement could be misjudged outside that.
- **Wrong code in a branch that never runs passes.** Graded by running, so an `else` that never runs is not looked at. Any arrangement that does the job is right, by decision; hidden `cases` close it where it matters, and `print` items could run a second input if play shows it matters.

**Chess: played** (2026-11, emulator Pixel 6, `CHESS_UNIT=n npm run phone -- chess-all`, `tools/play.js`)

All 18 units of the Chess course as the app builds it (the brief said 14; `src/subjects.js` gives basics 4 + forks + 13 themes), 69 lessons with
their checkpoints, by real touch with warm-ups and echoes on. Answers come from `src/chess/items.js` and `puzzle.js` (`answer`, `solutions`,
`starPath`, and `tryMove` for the puzzles' own lines), nothing stored. No wrong verdict for a right answer, no page error, no failed request,
no sideways overflow, nothing untappable, nothing under 40px. Each unit's first move was made by dragging (17 of 17 worked); every
other move by tapping the piece, then the square. Sessions are 7 to 12 items, 24 to 78 taps, about 0:44 to 2:07 at a steady pace; none near 6
minutes or 20 items. Longest: `mateIn3-1` and `attraction-0` (~2:07), `backRankMate-2` and `promotion-2` (~2:04; `promotion-2` has the most taps, 78),
`attraction-2`, `skewer-2` (~2:00). The Lichess lessons ("Real games", the theme lessons) are the long ones: a puzzle is 2 to 4 of your own
moves. Not tested: a puzzle accepting a move it shouldn't (every move played was the line or a mate), and "Play Rosa".
Short phone (412x533, `CHESS_SMALL=1080x1700`): `mateIn3-1`, `attraction-0`, `forks-0`, `moves-0` played through the same; see the fixes below.

- **Fixed: the board under the verdict on a short phone** (`fitBoard`, `src/chess/exercise.js`; `.tall` rules in `styles.css`). Asked, the coach's
  words and the whole board show together with nothing to scroll (the coach and the gaps give way first, by the same `.tall` rules Coding and the quizzes
  use, then the board, never under 40px a square where it is tapped); answered, the whole board with its file letters sits above the verdict (it
  shrinks, to about 24px a square for a long puzzle on 412x533: readable, not tappable); a teach card's board sits above Continue. A board that already
  fits is left alone, and at 412x786 the board is now clear of the verdict everywhere too. Checked by `test/e2e/chess-short.spec.js`, and on the
  phone: all 18 units at 412x533 with an earlier form of the fix, none flagged; then, on the final code, units 5, 16 and 18 at 412x533 and 1, 5, 11 and 18 at 412x786, none flagged.
- **Fixed: the coach's bubble after an item is done.** A solved or missed puzzle, tap, move or stars item says "That's it." (right) or "Here's how it
  goes." (missed, or solved after the hint) instead of "Good. Keep going" or "Found 2 of 3." A true/false keeps its claim, which the explanation is about.
- **A teach card without a board is a big empty page** (low): `mate2-teach`, `promotion-teach` and the like are a bubble and Continue.
- **Wording for a beginner** (low): the Attraction unit opens with "One more rule, castling" in a card that is not about castling; explanations
  say "h-pawn", "a-file", "the far side" before any lesson names them (they are taught in the board unit, but the Lichess lessons use them
  freely); every puzzle explanation is a bare line ("Queen to a5, check. King to e8.") with no word on why it works.
- **Not played:** a real beginner, a real finger, Firefox, the engine's mates beyond what the puzzles check, and sound.
**Repetition engine**

- **A second miss of a mirrored item sees the same mirror.** Chess has only two versions of an item; a third go
  repeats one. Fine at GOES 4 so far; watch it in play. A colour flip as a third was looked at and left: 30 of 55
  authored chess items name a colour, rank or direction (White, up, back rank), so it means rewriting text, not squares.
- **Tune the numbers from real play.** `tools/sessions.js` models a fixed miss rate; nobody has played the new limits
  (2 echoes, 4 goes, 5 repeats a session). "One step back" has only run in tests and an E2E flow.

**Maths: played** (2026-11, emulator Pixel 6, `MATHS_UNIT=n npm run phone -- maths-all`, `tools/play.js`, `tools/play-quiz.js`)

All 9 units, 36 lessons (checkpoints included), by real touch with warm-ups and echoes on, answers worked out from each sum or picture
with `toQuiz`: no wrong verdict for a right answer, no page error, no failed request, no sideways overflow, nothing untappable, no tap
target under 40px. Sessions are 7 to 14 items (checkpoint 8) and 0:36 to 1:25 at a steady pace; none near 6 minutes or 20 items. The longest
are `ten-2` (13 items, ~1:25), `ten-0` (~1:21) and `ten-1` (12 items, 37 taps, the most). A right drop on a number line leaves one marker
everywhere it was checked, below zero included (`neg-0-line`, `neg-1-drop`, `neg-1-rise`, `neg-2-line`; 52 checks pass, units 1 and 2 not checked
this way). Looked at by eye: ten frames, arrays, the 100 grid, single and stacked fraction bars, lines 0 to 1, 0 to 0.1 and -10 to 10,
money and long sums (1480 to the nearest 100): all drawn cleanly, centred and readable. Every sum and explanation in the 36 lessons was
read: none wrong.

- **Stacked bars under the verdict on a short phone: fixed** (`fitCard` in `src/fit.js`, `test/e2e/quiz-layout.spec.js`). At 412x533 all three bars of `frac-1-biggest` now sit above the verdict; the bars and their gaps shrink first. `frac-1` played again at 412x533 with no flag.
- **Short phone, otherwise clean:** `ten-1`, `ten-2` and `neg-0` at 412x533 had no flag.
- **Not covered:** a real finger, and Firefox.

**Japanese: played** (2026-11, emulator Pixel 6, `JAPANESE_UNIT=n npm run phone -- japanese-all`, `tools/play.js`, `tools/play-quiz.js`)

All 11 units, 44 lessons (checkpoints included), by real touch with warm-ups and echoes on: every answer right, no page error, no failed
request, no sideways overflow, nothing untappable. Sessions are 8 to 16 items (checkpoint 8) and 0:29 to 1:33; none near 6 minutes or 20
items. The longest are `s1` (16 items, ~1:33), `wn` (~1:29), `y1` (~1:27), `se3` (~1:26, 57 taps, the most) and `k1`. Sound: of 145 cards
that carry a sound, every one called `speechSynthesis.speak` with its text when shown, and 142 were also caught with an audio stream
`state:started` in `dumpsys audio` (the 3 missed were the first card of the first run, a slow start). Looked at by eye: kana are about
110px and sharp; a small っ is plainly smaller and raised against つ, in the card, in a word and among the tiles (ゃ against や likewise);
が, ぱ and the rest of the changed sounds read clearly; the first-sentence unit (これは ねこです, five-word builds) fits and wraps by word.

- **Long romaji options cut off: fixed.** A pick's options wrap onto another row when they don't fit side by side, each at full size, in `styles.css` (`.quiz-pick`), for every pick in Japanese and Maths. All 11 units played again at 412x786 with nothing off the side or clipped.
- **Sentence builds on a short phone: fixed.** At 412x533 the slots sit above the tray while building and above the verdict once answered (`se1` to `se3` and their checkpoint played again at 412x533). The card gives up its spare room, then the coach shrinks, then the slots and the sentence above them; if that were not enough, pictures shrink, then the card scrolls in its own box.
- **Empty build slots: fixed.** An empty slot is an outlined dashed box the height of a tile (as the Coding builder's), solid once filled.
- **Matched pairs go under the verdict** (low, left as it is). A 5-pair item has 5 rows; once answered the verdict hides the lower rows, so the last matches turning green are not seen.
- **Typo fixed:** the explanations of `se1-pairs-323`, `se2-pairs-330` and `se3-pairs-337` read "This is a cat., ..." and ended "tea..". No other content problem found.
- **Not covered:** a real finger, Firefox, and a voice other than the emulator's.

**Layouts from phone testing**

- **Play Rosa's top level gets shallower on a slow CPU.** It always answers in its 3 s budget and the page stays live (worst frame
  gap 28 ms), but the depth it finishes falls (CDP `Emulation.setCPUThrottlingRate`, desktop Chromium): unthrottled it completes depth 3
  in the opening and middlegame (depth 4 takes 15-46 s there, so "depth 4" is only reached in simple endgames); at 4x and 6x
  depth 3 takes 5-9 s, so it plays its depth-2 move (after 1 e4 it plays d5 instead of e5; at 6x a middlegame's depth 2 took 3.3 s,
  so it fell back to depth 1). Throttled, the top level plays about like level 2. Not broken; if slow phones need it, search
  on fewer positions per node (chess.js `moves()` is the cost) or run it in a Worker, rather than raising the budget.

**Habits and the new screens: played** (2026-11-20, emulator Pixel 6, `npm run phone`; notes and screenshots in `wingbeat-wt/notes/walk/`)

Every scenario but the `-all` ones, on `main` as of #146, in three runs: no page error, no failed request, no sideways overflow. The
only failures were `japanese`'s two speech checks (`speechSynthesis.speaking` after "Hear it again", and no TTS stream in dumpsys),
on an emulator whose Japanese voice is installed, and once `calm`'s haptics check on a busy machine (it passed on `main`). New
scenarios fill what the old ones missed: `home-states` (30 days in: the butterfly flying, basking and resting, what each path is
raising, Walk's "when", the quiet dot, the switch on ⋯), `yours` (0, 1, 7 and 14 panels), `stages` (every stage on Maths' path and
Move's plant, and the end-screen line as each arrives), `field-guide` (all 27 species emerged, each page drawn with its source a
link), `skins` (nothing given, all seven, each worn on home, in the garden and on an end screen), `choose` (Move's finished path),
`reflect-days` (three dates, the line from a week ago, "Read back your week"), `presets` (the five newest; a "when" set, changed and
cleared) and `looks` (dark theme, large text); `move` now shoots every move of the new units. Shared seeds are in `test/phone/lib/seed.js`.

Fixed in the same pull request:

- **The butterfly basked after a missed day** for anyone who never opened Learning: `best()` (widget.js) counted the never-started
  Learning habit, whose light is always soft. Now only habits with a session count, so a day off rests it, as the widget says.
- **A quiet habit's greeting still counted days** ("31 days of slow breaths") once today was done: the streak was hidden but `days`
  was not. `moment()` now leaves both out (voice.test.js).
- **Rosa "beat" people**: "Every opponent I ever beat" and "has not beaten me". Reworded; the guardrail lint now catches beating someone.

Found, not fixed (design calls or bigger than a few lines):

- **A creature's line can fall into "and N more"** (low). `arrivals()` shows skins, then the first three garden lines; the creature's
  stage isn't put first. In real play a unit's flower and its creature arrive together, so both show (seen); only a save that earns
  many things at once (a placement, an import) folds the creature's line into "and N more in your garden". A first pass reported
  this as medium from a seed that hadn't awarded earlier units; with what those units earned, the lines show.
  **Fixed** (fix/walk-findings): `award()` returns what arrived most important first (a raised butterfly's stage, then a skin,
  a landmark, a visitor, a flower) and `listed()` caps an end screen at three lines (two above "How do you feel?"); the sound follows the first.
- **End screens are crowded on milestone days** (medium). Calm on its 14th day shows the headline, the wingbeat with Lumi and your
  butterfly, a bow tie for Lumi, the chrysalis, a bee, a birdhouse, then three feelings and Continue: the last feeling sits under the
  fixed Continue until scrolled. A Maths checkpoint has three chips, the wingbeat, a skin and four lines. About ten things now grow,
  arrive or unlock, and on these days most of them arrive at once. **Fixed** (fix/walk-findings): two lines and "and N more" on a
  practice end screen, and its coach drawn smaller and higher, so all three feelings sit above Continue at 412x786.
- **Home for someone 30 days in** (low, crowding): garden strip, seven tabs, the course and Games rows (Learning), the greeting, the
  butterfly and streak line, the raising line, then the path. The path starts below half the screen.
- **Numbers still show for the other habits** next to a quiet one (by design: only Calm, Reflect and Wind down are quiet), so a
  30-day home reads "Move 30", "Walk 30", "Learning 31" beside Calm's dot. Fine; noted because the plan's "no count" reads wider.
- **No way into the wardrobe from home**: it is in ⋯ (last, under Garden) and on the garden screen. Fine if intended.
- **"Moves need space, so check there's room around you"** shows during Seated march and the other chair moves (low).
  **Fixed** (fix/walk-findings): left off a routine done all on a chair (`needsRoom()`).
- **Sit to stand: Clover stays seated** in the still we caught, and heel raises, side leg lifts and one-leg stand look alike at the
  wall (low; motion may tell them apart). **Fixed** (fix/walk-findings): sampled across a rep, Clover barely rose or lifted a foot.
  She now sits lower on a lower seat and stands up on long legs, rises tall onto her toes, lifts a leg well out, and holds a foot
  clear of the floor.
- **Floss's 🦷 and Music's 🎵 are faint**: white on white on the tab, and the note is dark on the pressed tab's dark green (low).
  **Fixed** (fix/walk-findings): 🪥 and 🎸, which read on a light, a dark and a pressed tab.
- **Seven skins**: worn on home (Reflect's path) and on the end screen; in the garden Lumi is in the pond and not dressed, as
  CLAUDE.md says. A skin worn hides the butterfly that sits on Lumi's head in the intro (intro only shows on a first visit).
  **Fixed** (fix/walk-findings): the learner's butterfly rides on Lumi's head wherever she is drawn dressed, on top of a hat or the
  crown, in every skin but the costume.
- **Dark theme** (emulated: `cmd uimode night yes` turns Chrome's bar dark but the page keeps `prefers-color-scheme: light` on
  this emulator, so `looks` tells the page directly). Everything reads, with two weak spots (low): the pressed tab is white text on a
  light green, and the wardrobe's dimmed skins turn into grey blobs on the dark card. **Fixed** (fix/walk-findings): the pressed
  tab's words measure 6.6:1 (5.0:1 in light); its quiet dot, 2.3:1 on the green, now has a ring of the page round it. A skin not yet
  given keeps its shape and full tone, its colour muted (Lumi 3.9:1 on the dark card; it was faded to grey).
- **Large text not checked**: setting `font_scale 1.3` mid-run closes Chrome's page under Playwright (twice, `LOOKS=large npm run
  phone -- looks`). It needs the setting before Chrome starts, which the runner doesn't offer.
- **The garden's Learning card lists every flower** (low, crowding): a finished Maths adds ten "A flower opened for …" lines, one
  per unit, under the Learning plant, pushing the other plants' cards far down. **Fixed** (fix/walk-findings): past three, one line
  with the number.
- **The live site** (knowhowit.com.au/wingbeat, serving today's `main`: `src/cast/skins.js` and the changed modules match):
  `first-visit`, `walkthrough`, `butterfly`, `garden`, `wardrobe` and `log` all pass with no page error or failed request. The
  first attempt failed at once with `ERR_NAME_NOT_RESOLVED` inside the fresh emulator; the retry was clean.
- **Not seen:** a real phone and finger, the widget and daily note, Firefox, the field guide's source links opening in a browser.
