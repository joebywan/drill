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
- **At 2.0 it is cramped** (being fixed): on Learning about 30px of the first lesson marker shows above a Continue bar 243px tall (its
  "Skip ahead" pill is a second row), and an end screen's "How do you feel?" starts 144 to 252px below the bar. Home and the end screens are
  being made to give way at large text, as lessons already do (decision 25).
- **A release build: played** (#187). `assembleRelease` signed with a throwaway key passes the whole `app` scenario (bundled page, no INTERNET, the bridge, the
  widget, back, the bars, the voice, large text, a link out, the keyboard). `verify-apk.sh` refuses it for the wrong key and for nothing else; with the real
  script it stops earlier, on the missing `android/release-key.sha256` (Joseph's step under Still open). The forced daily note is debug-only, so on a release
  build the scenario checks the once-a-day guard instead. **What the emulator cannot show:** on a retail phone a release build's WebView is closed to a
  debugger; it can be driven here only because this image is debuggable.
- **"Get a Japanese voice": played.** Clearing the speech engine's data keeps the voice, so no offer. With the engine disabled the teach card offers it once,
  and tapping it does nothing, since there is no engine to open (being fixed: offered only when something can answer). The engine's install screen with the
  engine present but no Japanese data cannot be reached on this image.
- **Another device and launcher: played.** The tablet image (`--avd daybook_tablet`, 2560x1600, the Pixel Launcher too) runs the app upright and on its side,
  places the widget, and shows the wide layout (tabs in a column beside the path) with everything fitting at ordinary text. At 2.0 text on its side, ⋯ at the
  end of the tabs column sits under Continue until the column is scrolled (being fixed). No other launcher is on either image.
- **In the app:** a species page's source link opens the phone's browser and Back returns to the same page; the keyboard in Reflect and "Make your own" leaves
  the field in view and what is typed is kept; a pull down does not reload; a long press selects nothing. `privacy.html` is not among the app's bundled files,
  and nothing reaches it there while sync is hidden.

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

What playing has covered and what it hasn't. Every course (281 lessons), the habits, the new butterfly screens and the
installed Android app were played by touch on the emulator in November 2026. Each one's results are in its "played"
block below; the fixes that came out of them are in docs/WINGBEAT.md under "Found by playing".

**Next up** (from Joseph, 2026-11-20: "you have the emulator"; worked through on 2026-11-21)

- **See the chrysalis on a phone page: done** (#171). A seeded learner at each of the five stages (`mathsRaising()` in `test/phone/lib/seed.js`,
  `npm run phone -- chrysalis`, light, dark and a short phone). The egg and the caterpillars read; the chrysalis did not (a thin shape in a mostly
  empty box), so it was redrawn in the kit: a plump body with a bold band and dots, whole from twig to tip.
- **Large text in the browser: done** (#177). Chrome 133 for Android offers Default zoom (whole-page zoom; 200% makes a 412px page 206px) and no
  text scaling, which is why `font_scale` never reached its page. `npm run phone -- zoom` sets it by taps and tours 150% and 200%. A browser's own
  font size now reaches every line (body in rem) and sets `--text-scale`, a minimum font size included; `test/e2e/large-text.spec.js` checks 125% and
  200% text and 320 and 206 wide in both browsers. At 200% text a verdict used to take over half the screen and cover what was asked: it is now held
  to half the screen, its headline giving way and then its words scrolling in their own box (#183, decision 25), and every item is in view above it, in a browser
  and in the app at the phone's largest text. On a 206x393 page (Chrome at 200% zoom, past what the app promises) the board, a ten frame and a program are still partly
  covered once answered, and a build sits under its tray while asked: all of it can be scrolled clear.
- **Home and the end screens at the largest text: done** (#197, decision 29). At text 2.0 the next lesson's node sat under Continue (570 to 698 against a bar
  from 598) and a practice's "How do you feel?" was off the screen (877 against a bar at 733). Each screen now gives way for what it is for, only as far as
  it takes: home moves the bar's second row into the page, then drops the greeting, then "See your week"; an end screen drops its pictures, then says less.
  Nothing changes at ordinary text or at 1.3. The first-visit list and a follow-on course's waiting tab were looked at at 2.0 too. A verdict is now at least
  as tall as the tray it replaces, so no row of answers shows above it. On the tablet, ⋯ keeps to the bottom of the rail where larger text had pushed it
  out of reach.
  **Left:** on a 360-wide phone at 2.0 home and the end screens cannot fit even after giving way, so the page scrolls as before. The first-visit list is 2px
  too wide at 206px. **Being fixed** (two things today's other merges brought, found here): at text 2.0 an answered Chess board sits under the verdict where
  the coach's words are long (a stars item with an introduction, a long puzzle), since the board no longer moves up when her words shorten (#192); and on a
  short phone one Coding item's verdict covers its program (`loops-2-read`).
- **The emulator is the phone.** Each "Not played", "Not covered" and "Not seen" line below is being played on the emulator, or replaced by what
  exactly it cannot show: Firefox for Android itself, a finger (off-centre taps, swipes, the keyboard, links out), device conditions (landscape,
  put down and picked up, screen off, a call, no network), Chess's games and wrong moves, and the Android app's leftovers. Results go in each block
  as they land.

**Test by playing**

- **Blank button label in Firefox for Android.** Joseph has seen it a few times, on the JavaScript Meet screen: the green button at full height with no text. It stayed blank until he left and opened the course again, so it is a stuck draw that a rebuilt screen clears, not a slow one. The text and colour are right, so it isn't being drawn. Not reproduced: 39 runs of the old code in Firefox 159 on the emulator, which renders in software, including scrolling during the entrance and a shorter screen.
- **A beginner, played blind** (#185, `test/phone/hands.js`; log and pictures in `wingbeat-wt/notes/beginner/`). An agent played from screenshots alone, one real
  tap at a time, without reading the course data: the first visit, the first lesson of every course, the second of Chess, Coding and Japanese, a Calm and a Move
  session, a one-tap habit, the garden. With real hesitation and repeats a lesson took 1:37 to 3:40 and 5 to 10 items; Chess, Maths, Japanese, Coding and
  JavaScript's first lesson were small wins with nothing near a slog. What stumbled:
  - **Fixed** (#190, decisions 26 and 27, `npm run phone -- follow-on`): TypeScript and Test writing were open on day one and assume JavaScript
    (`function`, `let`, `===`), the first-visit list was bare names, and the intro's picks only ordered the tabs, so a learner who ticked two habits
    saw six. The two courses now follow JavaScript's first nine units (a test works the number out from every word they show; it also found `false`
    never written on a JavaScript card, a `null` decoy nothing teaches and a union label Test writing never teaches, all fixed). Until then their tab
    offers JavaScript first, with "I know JavaScript: start here" one tap away. Every course and habit in the first-visit list has a line saying what
    it is, and what is picked is all home shows; the rest is under + Habit and a "+ Course" chip. Code to read wraps where it ran off the side of its
    box (30 or more cards across the code courses, by up to 77px).
    **Left (low):** after "start here" a follow-on's own "Skip ahead" is gone (both answers are kept in `progress.start`); a just-opened follow-on is
    greeted "TypeScript is first", the brand-new line.
  - **Fixed** (#192, `npm run phone -- feedback`): in Coding's "Around the rock", walking into a rock ended the run with no word that it had, the rule
    being taught four items later. The lesson's first card now plays it (one step, into the rock, the rest never run), and the first lesson says the
    edge of the grid stops him too. A missed run keeps the learner's own program on screen, the block it stopped on ringed, the steps after it faint and
    the rock ringed, with Fennel saying why, for 2.4 seconds or until a tap; then the way that works takes its place and the reason comes first in the
    verdict. Every way a run can end has its own words (`RUN_ENDS`).
  - **Fixed** (#192): in Chess, after the first move in a stars puzzle the coach's bubble shrank and the board jumped 21px, so the next tap missed (an
    answered true/false jumped 88px). The bubble now keeps the room of the tallest line the item can say, and `test/e2e/board-still.spec.js` holds the
    board's top still from asked to Continue, played right and wrong, at three sizes. A new piece's introduction was gone before it could be read: it
    stays with the prompt until the first move.
  - **Fixed** (#192): a missed Maths or Japanese build showed only the right answer; it now also shows what was put ("You put ~~18~~").
    **Left (low):** the code courses still replace a missed run at once (what it printed is shown, so the miss is not unexplained); a Japanese sentence
    card grows down by a row once its slots fill; tapping Rosa mid-item can show an aside taller than the room kept for her words; "Collect all 2 stars"
    reads oddly.
  - **Fixed** (#191, `npm run phone -- words`): a listening item was answered with advice about looking; every course's coach said its course was done
    today after one lesson of another; end screens overstated ("Plenty of bumps" for one miss in eight); nothing said the Blue Triangle was a butterfly; a
    few lines praised what the learner is. A verdict's words now fit how the item was answered (heard, moved, written, looked at). With Learning done today
    through another course, a coach says today's learning is done, never that its own course is. An end screen with one miss in a good session is "nearly",
    and no line counts misses. Arrivals and the garden's cards say "butterfly". The ability lint also refuses "you are a…", "a natural" and speed as a
    virtue (it caught one more line, Moss's). Calm's circle counts a breath's seconds up, as its card says.
    Then (#194): a coach greets you the first time you open their course (the first meeting followed the Learning habit, so only the first course ever
    opened was greeted), and Calm's first card states the learner's own timings where it said "in for 4 seconds, then out slowly for 8" whatever they were.
    **Left (low):** Calm's lesson titles name a count the learner's own timings can change ("Five slow breaths", "Five long sighs").
  Worth keeping, in its words: Chess's move dots and stars, Coding's arrow blocks, a miss coming back at the lesson's end, Maths showing its working, Japanese's
  memory pictures, JavaScript's one idea a card, Calm's "nothing to get right", the one-tap habit.
  **What this cannot show:** whether a person finds it calming, fun or worth coming back to tomorrow; anything heard (it saw stills, so listening items were
  guesses); and a second day (streaks, review, comebacks).
- **What a finger does: played on the emulator** (#180). Taps that are not dead centre (`PLAY_JITTER=0.85`, seeded: each lands out to 85% of the way to its
  target's edge) played two units of every course, one of them on a short phone: no mis-tap, no covered target. Real swipes (`touch-swipe`, and `PLAY_SWIPE=1` on the
  `*-all` scenarios) over home's long path, the tabs row, the course chips, the garden, the field guide and a week view, and inside the boxes that scroll in
  themselves: the page never moves under a box, the edges are right at each end, Continue stays put, a swipe that starts on a button presses nothing. The phone's keyboard
  (`touch-keyboard`) over Reflect, "Make your own", a habit's "when" and Focus's own words: the field stays above it and what is typed is kept. Links out
  (`touch-links`) open a new tab and the app's tab is as it was. Long press and double tap (`touch-press`) select nothing and answer once.
  Two bugs came out of it, both fixed: a long press on a tile or the board selected its glyph and raised Android's Copy / Share toolbar over the controls; a pull down
  at the top of a screen handed the page to Chrome's pull-to-refresh, which reloaded it and lost the lesson or screen.
  Run the jittered taps again after any change to a tray, tile, button or board size.
  "Make your own" left its Add habit button about 130px under the keyboard until the page was scrolled: it now keeps to the bottom of the page over the
  picks (#197), and on a short phone with the keyboard up (a 412x177 page) the field and the button are both in view (`KEYBOARD_SMALL=1080x1700`).
  **What the emulator cannot show:** a flick with a real finger's inertia (`adb input swipe` is one even stroke), and a hardware keyboard.
- **Coding's drawing trail and live values, seen moving** (#186, `npm run phone -- moving`): bursts of screenshots during `draw-0`, `draw-3`, `var-0` and `var-3`
  show the trail growing behind Fennel, values changing only on the square they belong to, no jump and no flash. **What the emulator cannot show:** whether a
  sound is heard. `dumpsys` cannot tell an open but silent audio stream from sound; only a stream starting and stopping is evidence.
- **The live site** was played on the emulator (first visit, the walkthrough, the butterfly, the garden, the wardrobe, a one-tap habit), and GitHub now plays it from its own network after every deploy (`.github/workflows/live.yml`, `npm run e2e:live`: a first visit, the first Maths lesson to its end, and the served `app.js` and `styles.css` matching the commit; first run passed 2026-11-21).
- **Firefox:** the whole browser suite passes in desktop Firefox and CI runs it on every pull request (`npm run e2e:firefox`, silent; job `e2e-firefox`; #172).
  A walk through the main screens (2026-11-20) showed nothing a person would notice differing from Chromium: no page errors, no missing glyphs, the same layout at
  412x786 and 412x533, light and dark. What does differ, and the specs now allow for: Firefox has no history entry before the first page, so the last back stays on
  home; a click on the board's frame doesn't focus the board (Tab does; mouse-then-arrow-keys on a desktop is the only one a person could meet); `getBBox` is tighter on curves;
  a 2 to 3px strip between two tap targets in a few tight Coding rows.
  **Still to play:** Firefox for Android itself (its fonts, touch scrolling, `vibrate`, wake lock), which is what Joseph uses. It is not on the emulator image; installing it there waits on his say-so.

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
  is long still scrolls in its box at 412x786, as before. Its edges show more above or below with `scrollBox()` (plain gradients; the mask it used first crashed the emulator's software renderer).
- **Small tap targets and mis-taps** (low): every block to tap in a program (Coding and the code courses) gets an invisible target sized by
  `reachOf()` in `src/builder.js`: toward 44px each way into empty space, but only halfway to any other block to tap, so no target lies over
  another's box. Before, on a short phone, `bug-3-sign`'s `<` had the value below's target over its bottom edge, and a tap on it emptied
  "change steps by 1" instead, so the harness got stuck. Most of that was the harness: it aimed every short-phone tap 37 screen px (14 CSS px) low,
  measuring where the page sits before `wm size` moved Chrome's toolbar. It now measures again after the resize, flags a target partly covered by
  another, and flags a tap that a different element took. Short-phone runs before this (`small-u8`, `small-u11`) were aimed low too. A wrong pick in
  find-the-bug was never a trap: tapping another block picks that one instead, and filling the wrong one counts as a miss with the explanation.
  Blocks 28 to 30px wide or tall that sat 0 to 6px from a neighbour got only half the gap. Now (#197) a gap is shared by need (a neighbour already 44px
  across leaves the whole gap to the narrow one) and tight rows have a little more room sideways: at 412x786 and 375x812 every block reaches 44px each way.
  **Left (low):** on a short phone a 36px go block reaches 40 to 42 across, and in `bug-3-count` and `bug-3-sign` a 28px value reaches 35 to 43 up and
  down; wider rows would push those programs past the tray. The harness measures drawn sizes, so it still lists these.
- **Still to play:** Firefox for Android, and the drawing trail and live values seen while they move (both in hand, see "Next up"). A finger's part is under "Test by playing".
**Coding: bigger improvements**

- **Fresh numbers.** Done for Coding and Maths (#99, `tools/variants.js`), find-the-bug and the one-offs included. `frac-2-4q` stays
  as written; `bug-2-h`, `list-2-add` and a few other one-offs still only flip.
- **Laying out the structure, the biggest tile and Run: done** (`src/builder.js`, `exact` runs in `program.js`).
- **Events** ("when Fennel reaches a rock"): done in the JavaScript course's Callbacks unit (`onRock`, `onStep`).
- **The JavaScript course like a language course: done, with TypeScript and Test writing** (`src/code/`). Japanese sentences could use the same builder.

**Code courses: to judge by playing**

- **Pacing and tone: played, see below.** All 68 lessons have now been played on the emulator (JavaScript, TypeScript, Test writing); off-centre taps
  found no chip too small or too close ("Test by playing"), and the courses have no typing. Whether the pace suits a first-time learner is still open.

**Code courses: played** (2026-11, emulator Pixel 6, `CODE_COURSE=javascript|typescript|testing CODE_UNIT=n npm run phone -- code-all`, `tools/play.js`)

All 21 units, 68 lessons (JavaScript 39, TypeScript 15, Test writing 14, checkpoints included, 724 items), by real touch with warm-ups and echoes
on, answers worked out from the item with `src/code/items.js` (`wayOf`, `chipsOf`, `optionsOf`): no wrong verdict for a right answer, no page error,
no failed request, no sideways overflow, nothing untappable. Sessions are 8 to 13 items (checkpoint 8) and about 0:40 to 1:35 at a steady pace;
none near 6 minutes or 20 items. The longest are `jsn-1` and `jsl-3` (~1:35 each; `jsn-1` has the most taps, 59), `jse-2`, `tb-2`
(~1:27, 56 taps) and `ts-1` (~1:25). The estimate is a learner who knows the answer, so real sessions run longer. The short phone
(412x533) played the two longest lessons of each course (`jsn-1`, `jsl-1`, `tsa-1`, `tsi-1`, `tb-2`, `ts-1`) with the same result.

- **What a build printed is hidden under the verdict: fixed.** "It printed" now sits right under "It should print", the two lined up and the
  result's line as tall as the goal's, so a run moves nothing. Every print item shows the goal, the result, the program and the verdict
  together on a 412x786 page; on the short phone the goal and the result come first and the program scrolls in its box.
- **A tall answer runs under the verdict: fixed.** A fill-in program has no blank line between its lines any more (text lines are as close as
  code, a line with a gap as tall as its chip), and the code courses fit their program with Coding's rule, now shared in `src/fit.js`: fit first,
  then the program scrolls in its own box, and once answered the box ends above the verdict with the filled gap or the answer's end in view.
- **The tray shows half a chip: fixed.** It grows to show every chip while there is room above it; when it can't, it ends on a whole row and
  fades at the bottom while there is more, like the program's box. The code under test gets as many whole lines as fit, with the same fade,
  instead of a fixed box. On a short phone both still scroll in `tb-2-7` (six lines of code, two rows of chips): there is not room for all of it.
- **A long answer with its top hidden: fixed.** The answer's box fades at the top once scrolled, so a hidden first line shows as hidden, and
  keeps the line being built in view without moving the page (the builder no longer calls `scrollIntoView`). It opens at its first line.
- **A code card ran under its answers or the verdict: fixed.** The teach, predict and check cards (the quiz, `code-look`) had their code and
  answers capped in vh, and Chrome on a phone measures vh with the address bar hidden, so on a 412x533 page the 8-line check card `tsi-2-4` ended
  11px into the answers' box, and once answered the verdict covered the last lines of many cards (`jsc-2-6`, `jse-3-9`, `tsu-2-5`: 44px). `fitCard()` now fits them like every quiz card:
  the coach and the gaps give way, then the code scrolls in its own box (the answers too, if there are more than leave four lines of code).
  Whether the playthrough reported it varied from run to run with the page's scroll offset when the card was measured, not with the card:
  the page kept whatever offset the last item left it at, which could also cut the ✕ off at the top. Every item now starts at the top of the page (`step()` in `src/app.js`).
- **The coach's bubble grew when a quiz card had to give way: fixed.** Since the Chess fix (#162) the shared rule for a tall screen outranked the quiz's own,
  so a Maths, Japanese or code card that was too tall got a bubble 88px high where it should have been as short as her words. With it right, `tsi-2-4` shows all 8 lines on a 412x533 page.
- **Answers taller than the verdict: fixed** (#197). On a 412x533 page a check card's rows of answers stood taller than a short verdict, so 6 to 28px of them
  (up to 67px on a predict card) showed above it once answered. A verdict is now at least as tall as the tray it replaces.
- **A placed word was 32px high: fixed** (#197). It is 40px, like everything else tapped; the code fit specs pass at 360x582, 360x640, 375x812 and 412x533.
- **Wording: fixed** (#194). "For example `cost({"name":"a"}) gives 0`" wrote the input as JSON (quoted keys) before the course had shown that form: a value
  in prose is now written the way the course writes code (`cost({ name: "a" }) gives 0`). "Five! Those lines run like clockwork." and "Five in a row." did
  not say five of what: every run-of-three and run-of-five line now says what is counted ("Five right in a row…"). A verdict headline cannot grow freely:
  `chess-short.spec.js` holds the longest (a longer Rosa line put a board under the verdict on a short phone).
- **Harness bug found and fixed in passing:** `btn(name)` in `tools/phone.js` ignored `{ exact: true }`, so `btn('Continue', { exact: true })` could hit a
  chip named `continue` and `btn('Run')` a chip named `run(`, stalling `jsl-4` and `jse-1` until the fix.
- **Fresh versions in Test writing** change their values (#174): inputs and the code's edges move together, and what each test expects is worked out by running the real code (48 of 59 items). Eleven still only rename, where the values are the point or the code computes with them (0 and 1, % 2, + 1, one-letter text); the list and the reasons are in `test/test-writing-vary.test.js`. No fresh version in any code course renames a function.
- **Test writing's builds offered no wrong choice: fixed** (#174). Fourteen of its seventeen builds had their wrong chips filed where the tray never shows them, or had none, so "Choose the values with care" had nothing to choose between. Every build now offers a wrong choice, building with it is a miss, and where the prompt says to catch or choose, the miss names the faulty copy that got through (tests hold all three). `jsf-3-5` is the one item with nothing left to vary.
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
moves. Wrong moves and the three games were played afterwards (#179, below).
Short phone (412x533, `CHESS_SMALL=1080x1700`): `mateIn3-1`, `attraction-0`, `forks-0`, `moves-0` played through the same; see the fixes below.

- **Fixed: the board under the verdict on a short phone** (`fitBoard`, `src/chess/exercise.js`; `.tall` rules in `styles.css`). Asked, the coach's
  words and the whole board show together with nothing to scroll (the coach and the gaps give way first, by the same `.tall` rules Coding and the quizzes
  use, then the board, never under 40px a square where it is tapped); answered, the whole board with its file letters sits above the verdict (it
  shrinks, to about 24px a square for a long puzzle on 412x533: readable, not tappable); a teach card's board sits above Continue. A board that already
  fits is left alone, and at 412x786 the board is now clear of the verdict everywhere too. Checked by `test/e2e/chess-short.spec.js`, and on the
  phone: all 18 units at 412x533 with an earlier form of the fix, none flagged; then, on the final code, units 5, 16 and 18 at 412x533 and 1, 5, 11 and 18 at 412x786, none flagged.
- **Fixed: the coach's bubble after an item is done.** A solved or missed puzzle, tap, move or stars item says "That's it." (right) or "Here's how it
  goes." (missed, or solved after the hint) instead of "Good. Keep going" or "Found 2 of 3." A true/false keeps its claim, which the explanation is about.
- **Chess in plain words: done** (#176). Every chess word is on a card before a prompt or an explanation uses it (`src/data/chess-terms.json` lists each
  word with the card that teaches it, or marks it never to be used; a test walks the path in order). The castling card, which showed under "Attraction",
  and the en passant card, under "Discovered attacks", are headed by their own names. Six teach cards that were a bubble and Continue have a board that walks
  through their line. And every real-game puzzle says why its line works (`src/chess/why.js`): the facts are worked out from the position and proved against it
  in a test, 329 of 336 with a sentence of their own and 7 with their theme's general idea. Which wording shows is chosen by measuring the verdict on the page
  (the full sentence, a shorter one, the line alone), so the board is never under it: at 412x533, 291 show the full sentence, 26 the shorter, 14 less.
  **Left:** the hand-written Forks unit keeps its written explanations; under the coach's longest headline a short headline could have fitted a longer wording.
- **Wrong moves, Play Rosa, Mate and Scramble: played** (#179; `chess-wrong-all`, `chess-rosa-all`, `chess-games`, `chess-games-small`; the two `-all` ones run by name only).
  Twelve lessons from eleven units were each answered wrongly first: nothing wrong was accepted, a wrong move snaps back and the second miss marks the piece to move,
  the right square with a piece the line doesn't need is explained and free, and a mate other than the stored line counts. Play Rosa at all four levels, both colours,
  ten or more moves a side: every reply legal, the page still drawing while she thinks (longest gap 136 ms), Hint, Take back and Resign as they should, and one game at
  Warm-up played to checkmate. Mate in 2, 3 and 4 solved with the prover's lines, a wrong first move refused in words, and a Scramble round to the end of its clock with the best kept.
  Fixed: in a puzzle, a move the piece cannot make was counted as a miss; it is explained and free, as in the other items. A stars item's arrows now show the route its
  words name (five items had them differ).
- **The three games fit a short phone: fixed** (#188). At 412x533 Mate's and Play Rosa's boards were cut off at the bottom of the screen, Scramble's clock and
  score scrolled out of sight while playing, and Rosa's end banner sat over her buttons. Each game now mounts through `fitGame()`, which calls the lessons'
  `fitBoard`: there is no second fitter. What a game counts sits in the session bar, where a lesson's meter is (Mate's "Mate in 2 3 4", Scramble's clock, score
  and best, Rosa's level). A board being played keeps 40px squares: the coach's face gives way first, and on a 360px screen the board grows into the gutters. At a
  game's end its buttons go and the whole board sits above the banner. Mate's Explain is said by Rosa. `games.spec.js` holds all of it at 412x533, 360x640 and
  412x786 in both browsers; on the phone `chess-games-small` fails on anything off the screen, and `ROSA_SMALL=1080x1700` plays `chess-rosa-all` on a short phone.
- **Still to play:** Firefox for Android. Whether a first-time learner follows it is the beginner question under "Test by playing".
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
- **Still to play:** Firefox for Android. A finger's part is under "Test by playing".

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
- **Still to play:** Firefox for Android. **What the emulator cannot show:** a voice other than the image's own Google ja-JP one (no other speech engine is on it).

**Device conditions: played** (#186, 2026-11-21; `away`, `away-bare`, `away-bare-app`, `interrupted`, `moving`, and by name `landscape-all`, `landscape-app-all`, `offline-all`; pictures in `wingbeat-wt/notes/device/`)

- **Put down, locked, picked up:** a Maths answer with its verdict up, a Coding program two tiles in and a Chess puzzle one move in were exactly where they
  were after Home and after the lock screen. A Calm or Move routine pauses and its count freezes while away; Focus keeps wall-clock time, by design. Chrome killed
  in the background comes back to home with every finished lesson kept; a lesson in progress is not resumed.
- **A driven page never goes to the background.** The runner's Chrome is started so that it keeps drawing, and the harness holds the screen on, so Home and the
  lock screen do nothing to a page it is attached to. `away-bare` and `away-bare-app` start the routine, let go of the page, put the phone down and look
  again afterwards: use those for anything about being away.
- **Fixed** (#196): Calm, Move, Wind down and the screen break did not keep the screen awake (only Focus did), so the phone locked mid-breath: every timed
  routine now keeps the screen on while it plays and lets go when paused, ended or closed (`away-bare`: on while running, off while away, off when back and
  paused). Calm's rain came back before the paused routine did: sound now rests with the routine until Carry on. With no connection Mate opened an empty
  screen with an unhandled error: Rosa says the boards could not be fetched and a banner offers Try again. With no speech engine the voice offer did
  nothing: it is only made when something on the phone can open the engine's install screen.
- **On its side** (a page 866x308 in Chrome, 866x364 in the app): home, the garden and Settings hold. Lessons did not: Coding's map shrank to a thumbnail under
  the verdict, Maths' picture and number line collapsed and `ten-0` could not be finished, the Chess board was clipped, Calm's circle was cut off.
  **Decided and built** (#196, decision 28): Wingbeat is made for an upright phone. The installed app stays upright on a phone and still turns on a tablet.
  In a browser, a phone on its side shows one line over a lesson or routine ("Turn your phone upright to carry on, right where you were."), a timed routine
  and Scramble's clock hold, and upright again everything is where it was (`landscape-all`, all five courses). "On its side" is read from the screen,
  never the page: the keyboard shrinks the page to wider than tall on a common 360-wide phone, and the first version of this took that for a turned phone
  and covered Reflect while typing (caught in review; `KEYBOARD_SMALL=1080x1700 npm run phone -- touch-keyboard` plays it).
  **Left:** on an iPhone the line never shows (its screen size does not turn with it), so lessons there are as they were, and this cannot be played on the
  emulator. The garden on its side has a plant card the audit cannot reach (medium, there before; `landscape-all` exits 1 on it). On a short phone with the
  keyboard up (a 412x177 page) the field in Make your own, When and Focus sits 15px above the top (low; being fixed with the largest-text work).
  **What the emulator could not show:** a tablet. The runner could not calibrate Chrome on the tablet image in four tries of four ("calibration tap never
  reached the page"), so the tablet with the keyboard up is held by a browser test only. The runner needs fixing there.
- **An incoming call** arrives as a banner and the page is never hidden, so a routine and its rain carry on through it; declining or answering leaves a lesson
  as it was. Whether the rain is heard over the call cannot be told from the emulator.
- **No network, the live site:** the open page carries on and saves. A reload fails; a new tab loads from the browser's cache for ten minutes and then fails too:
  there is no service worker, so the web app does not open offline. The installed app carries its files and works throughout. **Open (a decision):** whether
  the web app should work offline.

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
  **Lighter** (feat/lighter-home): no title bar on home (⋯ pinned at the end of the tabs row, Sound a switch in Settings), what a
  path is raising a close-up picture at the end of the streak row (nothing once it has emerged), and the one-tap hint only before
  the first log.
  At 412x786 a month in, the first unit's title now starts at 329 (Chess) and 263 (Calm), from 448 and 337 (`npm run phone --
  home-days`). Chess at 360x640 is still at about 352 of 640, its Games row the difference.
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
- **Large text in Chrome** is its Default zoom (`npm run phone -- zoom`), not the phone's font size, which Chrome 133 does not pass on to a page. `looks` is the
  dark theme only. The app's WebView does follow the phone's font size (`app`, at 1.3 and 2.0), and a larger font size in a desktop browser is checked by `test/e2e/large-text.spec.js`.
- **The garden's Learning card lists every flower** (low, crowding): a finished Maths adds ten "A flower opened for …" lines, one
  per unit, under the Learning plant, pushing the other plants' cards far down. **Fixed** (fix/walk-findings): past three, one line
  with the number.
- **The live site** (knowhowit.com.au/wingbeat, serving today's `main`: `src/cast/skins.js` and the changed modules match):
  `first-visit`, `walkthrough`, `butterfly`, `garden`, `wardrobe` and `log` all pass with no page error or failed request. The
  first attempt failed at once with `ERR_NAME_NOT_RESOLVED` inside the fresh emulator; the retry was clean.
- The widget and the daily note are played in the installed app ("The Android app: played"); the field guide's source link opens the museum's page in a new tab and
  the app's tab is as it was (`touch-links`, #180). **Still to play:** Firefox for Android.
