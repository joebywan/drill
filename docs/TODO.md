# Drill backlog

Ideas agreed in principle. Most are now built (each section says where); what is genuinely left is
under **Still open** at the end.

## Cross-device profiles and friends

**Done** (#73, #81): src/sync/, server/, privacy.html; see CLAUDE.md. Deploying it, the QR code and
sync inside the Android wrapper are under Still open.

Decided 2026-10-29 as the shape to build, when it's time:

- **No accounts.** A profile is a secret key held on the device. A new device joins with a
  short-lived 6-digit pairing code (or QR) shown on one already linked; a saved recovery code
  restores it if every device is lost. No email, no passwords, no third-party sign-in (Google
  blocks its sign-in inside embedded WebViews, which rules it out for the Android wrapper).
- **The device stays the source of truth.** localStorage is still the record; sync sits on top,
  so Drill works offline and in a browser with no backend at all.
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

**Done** (#78, icon #79): the wrapper, DrillBridge, the widget, the opt-in daily note and the
release checks. The signing key and Play publishing are under Still open.

WebView shell serving the bundled app from `appassets.androidplatform.net` (as Saffron Road),
no internet permission, then a JS bridge passing a session summary, a home-screen widget
(streak flame tinted by today's light; Lumi plus one line) and opt-in local notifications.
Release setup copies Daybook's: one signing key from the first build, `assembleRelease` only,
checks that fail unsigned, wrong-key or debuggable APKs. App id `com.joebywan.drill`.

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

Agreed 2026-10-30: Drill learns from its own on-device log how to fit the person, so it reacts
in a way that suits them. It isn't there to guess their feelings. Fizz logs similar events to a
JSON Lines file but never reads them back; Drill should use them. Needs HABITS.md task 13, and
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
which calls `window.drill.reminderHour()`, `shouldRemind()` and `noteReminder(outcome)`.

## Coach voice

Agreed 2026-10-30: like Duolingo's characters, each coach has lines that encourage and,
sometimes, antagonise or challenge the player to get them to play more ("Moss bets you can't
do three slow breaths before lunch"). A challenge is a dare in character, sent once; it is not
Fizz's escalating run of panicked nags. Drill needs a way to generate these lines either way:
a tool that drafts lines per coach and state with an LLM at authoring time, for review and
committing, with the coach's voice described once per character.

Still open: whether lines are also written live on the device. Fizz writes its mascot's lines
with Bedrock (a cloud model, with built-in lines as the fallback). For Drill, which has no
internet permission:

- **Line pool:** many hand-reviewed lines per state (habit, streak, hour, light, comeback),
  drafted with an LLM at authoring time and shipped in the app, with slots for the person's own
  facts ("your usual evening breathing"). No download, same on web and Android.
- **On-device model:** Gemma 3 (270M or 1B) via Google's LiteRT / MediaPipe LLM runtime runs on
  most phones and on the web with WebGPU, but is a download of several hundred MB; Gemini Nano
  via ML Kit needs a recent flagship. Small models drift off a character's voice, so the pool
  stays as the fallback either way. Check the current options before choosing.

**Done** (#68; plan #61). Shipped: the line pool (`src/cast/voice/*.json`, `say()` in lines.js, `tools/voice-draft.js` for
drafting with Claude at authoring time). The on-device model is still later: Drill has no internet
permission, and the pool stays the fallback even then.

## Ideas from the Duo council

- Ranked suggestions from the 2026-10-30 Duolingo research council, checked against the code: `docs/DUO.md`.

## Still open

- **Joseph's steps.** Sync is built but flagged off (`SYNC` in `src/sync/config.js`) with no
  backend planned for now. To turn it on: deploy the sync API (`server/DEPLOY.md`: Cloudflare account, the DNS move to
  Cloudflare, D1, one deploy), then set `SYNC` to true. Create the Android release key once, put its SHA-256 in
  `android/release-key.sha256` and add the four `DRILL_KEY*` repo secrets (CLAUDE.md, Android).
- **Play publishing.** A workflow that uploads the signed `assembleRelease` AAB/APK to a Play
  track; today the **Android release** workflow only builds and verifies it.
- **Sync on Android.** The wrapper has no internet permission, so sync is hidden there. Adding it
  is a decision (and a CI check to change).
- **QR pairing.** A QR code beside the 6-digit pairing code.
- **On-device model** for coach lines (Coach voice above). The pool stays the fallback.
- **Renaming "Drill"** (HABITS.md, the garden): the app has moved from drilling to growing.
- **Garden seasonal events** that change the whole garden (HABITS.md).
- **More courses:** JavaScript, TypeScript and TS test-writing are planned (CLAUDE.md); the
  test-writing one must grade code independently.
- **Chess promotion picker** (the board always makes a queen; `puzzle.js`).
- **From the 2026-10-30 integration walkthrough** (a design call, not a bug): above a new course's
  path sit five layers: the garden strip, habit tabs, course switcher, the welcome line and the
  "Skip ahead" offer. Nothing overlaps, but the path starts halfway down.

## To test or improve

From the repetition work and the Coding expansion, 2026-10-30. None of it is confirmed as a bug yet.

**Test by playing**

- **Coding end to end, for pacing.** All 47 lessons have never been played through. Later lessons
  have only had automated fit and solvability checks.
- **Session length.** Warm-ups, "Once more" and checkpoints make every Learn session longer. Check
  it still feels like small wins, not a slog. Checkpoints now sit on every path, chess's included.
- **Real touch on a phone** (`npm run phone`, or a real device): tapping the buggy block, dragging
  tiles into holes and into code, and the smaller blocks on phones under 700px tall.
- **Tap size on short phones.** At 640px tall, 5-row maps have cells of about 29px, small for
  predict taps; inner values in programs shrink to 26-28px.
- **Sound and motion in the new units.** Live values and the drawing trail under normal motion were
  only seen in a one-off script: e2e runs with reduced motion.
- **The live site** beyond its start screen, on a phone and from another network.

**Coding: lessons to judge first**

- `if-3` is the most samey lesson; `until-2` reuses the same undo trick.
- `bug-1` and parts of `bug-2`: with only one kind of tile, the tiles nearly give the block away.
- `logic-2`: and/or barely matters on maps this small; `logic-2-count` is contrived.
- `list-2`: plain fill-a-list items, and a look overriding a list is an odd idea.
- `draw-0`: `draw-0-extra2` and `draw-0-line` are very easy.
- `param-0`, `param-1`: many items are just "pick the number".
- `js-0` is mostly easy reading. `js-3` and `js-4` were cut hard to fit, and arrays hold 2 values.

**Coding: bigger improvements**

- **Let the learner lay out the structure.** "Build" means filling holes in a given shape; nobody
  ever places a whole loop or if themselves. This is the biggest gap against real programming; see
  free block-building below.
- **Fresh numbers.** Done for Coding and Maths (#99, `tools/variants.js`). Still only flipped: all 28
  find-the-bug items, and one-offs such as `if-3-two`, `nest-2-zig`, `var-2-order`, `logic-2-*`,
  `param-2-pass2`, `until-2-ok`. Thin pools (2 fresh versions for some items): `var-by`, `draw-ring-list`,
  `draw-spiral`, `read-spiral`, `nest-times`, `nest-sizes`, `rock-round`. `frac-2-4q` stays as written.
- **The biggest tile always wins on counting items.** Fennel stops at the flower, so any big enough
  count is right, and a learner can just tap the largest. Needs "exactly enough" or a rule change.
- **Free block-building with a Run button** (agreed): unscramble, then a palette with a block limit,
  then free build. Run is the one allowed Check, because pressing it is part of programming.
- **Events** ("when Fennel reaches a rock") were left out; they fit the JavaScript course better.
- **A JavaScript course like a language course** (agreed: no typing). Choose word chips and place them,
  as Duolingo does. Graded by running it through a small interpreter for a JavaScript subset, any valid
  arrangement right, Fennel walking the result. One builder for this and the unscramble stage; TypeScript,
  test-writing and Japanese sentences could reuse it.

**Repetition engine**

- **Fresh repeats for the rest of chess.** `tap` and `truefalse` items still repeat as written (only stars, move and
  find mirror). `truefalse` needs its `move` SAN flipped.
- **A second miss of a mirrored item sees the same mirror.** Chess has only two versions of an item; a third go
  repeats one. Fine at GOES 4 so far; watch it in play.
- **Tune the numbers from real play.** `tools/sessions.js` models a fixed miss rate; nobody has played the new limits
  (2 echoes, 4 goes, 5 repeats a session). "One step back" has only run in tests and an E2E flow.

**Chess modes** (order to decide; Mate suggested first, as it exists)

- **Mate:** port Daybook's game (`puzzles/Chess*.kt`, on its origin/main) to JS: mate in 2, 3 or 4 against a best
  defender, with its proven Lichess positions.
- **Capture game:** our own design. Reports of Duolingo's, unconfirmed: 90 seconds, one or two pieces, no king,
  Black hunts your best piece, new pieces can appear. Check in the app before settling on the rules.
- **Play Rosa:** full games at a few levels, with a small engine on chess.js. Not Stockfish (GPL), not Oscar.

**Characters**

- **Practice coaches' first card should name them.** Not a whole "Meet" screen, as a tap before a breathing
  exercise is the wrong friction: one line ("I'm Moss. Breathe in for 4...").

**Layouts from phone testing**

- **Move** got the Screen break's X and header change, but keeps its full-width Pause and has no on-screen how.
  Check whether it should match. Other timed practices too.
- **Screen break on a phone:** check the new layout there. Later sessions have no room-check card, only
  "Next: Stand and stretch".
- **Dark board's ledge shadow** is faint, and a very fast second tap as a piece lands can be dropped.
- **Cast brief** (the Claude Doc) still describes lamps and predates quest markers, the garden and no XP.

**Phone back button**

- Drill has no browser history, so on the web phone's back button leaves the site, and in the wrapper
  `web.canGoBack()` is false, so it closes the app, even mid-lesson. It should step back one screen, as the X
  and ← do. Noted 2026-10-30; to be done with the Android packaging, using `pushState` and `popstate`, so
  the web gets it too.
