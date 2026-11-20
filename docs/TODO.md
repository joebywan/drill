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

- **A tall program runs under the tray or the verdict** (medium). On a 412x786 page, and worse at 412x533, a long program (`var-3-grow`,
  `fn-3`, `draw-3`, `bug-3`, `param-2`) reaches under the fixed answer tray when asked and under the verdict banner once answered. The page scrolls
  (the `.play` bottom padding), so nothing is lost, but the last blocks and the result of a run are off the visible part
  until you scroll. Fix is a design call: let the program scroll in its own box, as built items already do.
- **Small tap targets** (low): the empty slot in a laid-out answer is 28px wide, a filled block 28 to 30px, and the tray's tiles 38px on a short
  phone. Heights are covered by an invisible 44px target; widths are not.
- **Not played yet:** a real beginner, a real finger, Firefox, and sound with the new motion. The drawing trail and live values were seen only
  in passing.
**Coding: bigger improvements**

- **Fresh numbers.** Done for Coding and Maths (#99, `tools/variants.js`), find-the-bug and the one-offs included. `frac-2-4q` stays
  as written; `bug-2-h`, `list-2-add` and a few other one-offs still only flip.
- **Laying out the structure, the biggest tile and Run: done** (`src/builder.js`, `exact` runs in `program.js`).
- **Events** ("when Fennel reaches a rock"): done in the JavaScript course's Callbacks unit (`onRock`, `onStep`).
- **The JavaScript course like a language course: done, with TypeScript and Test writing** (`src/code/`). Japanese sentences could use the same builder.

**Code courses: to judge by playing**

- **Pacing and tone.** 49 lessons have automated proofs (every item solvable, decoys fail, nothing asked before it is taught, 8 taps at most but
  for a construct's first build) but only six have been played, and only by e2e. Judge whether chips are the right size.
- **Fresh versions in Test writing** mostly rename: its numbers would need the expected answers worked out again.
- **The type checker is a small subset.** It follows strict TypeScript for what the course teaches. A valid but unusual arrangement could be misjudged outside that.
- **Wrong code in a branch that never runs passes.** Graded by running, so an `else` that never runs is not looked at. Any arrangement that does the job is right, by decision; hidden `cases` close it where it matters, and `print` items could run a second input if play shows it matters.

**Repetition engine**

- **A second miss of a mirrored item sees the same mirror.** Chess has only two versions of an item; a third go
  repeats one. Fine at GOES 4 so far; watch it in play. A colour flip as a third was looked at and left: 30 of 55
  authored chess items name a colour, rank or direction (White, up, back rank), so it means rewriting text, not squares.
- **Tune the numbers from real play.** `tools/sessions.js` models a fixed miss rate; nobody has played the new limits
  (2 echoes, 4 goes, 5 repeats a session). "One step back" has only run in tests and an E2E flow.

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

- **A course's own butterfly line goes missing on a busy end screen** (medium). Finishing Maths' eighth or last unit lists its
  flowers first ("A flower opened for Mental maths", two more, "and 6 more in your garden"), so "made its chrysalis" and "is out"
  are folded into "and N more" and never shown. A habit's lines come in time order and show. The creature's line should lead.
- **End screens are crowded on milestone days** (medium). Calm on its 14th day shows the headline, the wingbeat with Lumi and your
  butterfly, a bow tie for Lumi, the chrysalis, a bee, a birdhouse, then three feelings and Continue: the last feeling sits under the
  fixed Continue until scrolled. A Maths checkpoint has three chips, the wingbeat, a skin and four lines. About ten things now grow,
  arrive or unlock, and on these days most of them arrive at once.
- **Home for someone 30 days in** (low, crowding): garden strip, seven tabs, the course and Games rows (Learning), the greeting, the
  butterfly and streak line, the raising line, then the path. The path starts below half the screen.
- **Numbers still show for the other habits** next to a quiet one (by design: only Calm, Reflect and Wind down are quiet), so a
  30-day home reads "Move 30", "Walk 30", "Learning 31" beside Calm's dot. Fine; noted because the plan's "no count" reads wider.
- **No way into the wardrobe from home**: it is in ⋯ (last, under Garden) and on the garden screen. Fine if intended.
- **"Moves need space, so check there's room around you"** shows during Seated march and the other chair moves (low).
- **Sit to stand: Clover stays seated** in the still we caught, and heel raises, side leg lifts and one-leg stand look alike at the
  wall (low; motion may tell them apart).
- **Floss's 🦷 and Music's 🎵 are faint**: white on white on the tab, and the note is dark on the pressed tab's dark green (low).
- **Seven skins**: worn on home (Reflect's path) and on the end screen; in the garden Lumi is in the pond and not dressed, as
  CLAUDE.md says. A skin worn hides the butterfly that sits on Lumi's head in the intro (intro only shows on a first visit).
- **Dark theme** (emulated: `cmd uimode night yes` turns Chrome's bar dark but the page keeps `prefers-color-scheme: light` on
  this emulator, so `looks` tells the page directly). Everything reads, with two weak spots (low): the pressed tab is white text on a
  light green, and the wardrobe's dimmed skins turn into grey blobs on the dark card.
- **Large text not checked**: setting `font_scale 1.3` mid-run closes Chrome's page under Playwright (twice, `LOOKS=large npm run
  phone -- looks`). It needs the setting before Chrome starts, which the runner doesn't offer.
- **Not seen:** a real phone and finger, the widget and daily note, Firefox, the field guide's source links opening in a browser.
