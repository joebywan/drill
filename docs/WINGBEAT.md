# Wingbeat: theme and course plan

Written 20 November 2026, after going through the app against the cast brief and playing it at phone
width. It says what the name change still leaves to do, and whether the courses are enough. One pull
request per task, as with `docs/HABITS.md`: tick a task here in the pull request that finishes it.

## What the review found

### Theme

The name is Wingbeat, but the app still tells its story in the old pictures.

- **Nothing explains the name.** The first-visit intro lists what the app does and ends on the garden.
  The tagline is only in the web manifest.
- **Progress is drawn as fire.** Learning's icon and the end screen's streak chip are 🔥, the widget and
  the daily note use a flame, and coaches say a review "relit" the streak or that it is "glowing again".
- **Butterflies are anonymous.** A habit earns "A butterfly arrived" for seven days in a row: one of
  twelve colourings, with no name. The only other butterfly is on the icon.
- **Lumi and the butterfly never meet** outside the icon.
- **From the brief, not built:** accessories for Lumi, and "every game element can be turned off"
  (coach dares have no switch).

What already fits and stays: the path, the coaches, the forgiving streak, the garden (butterflies need
one), the seasons and events, and `light()` as the model of today (bright, soft, ember).

### Courses

| Course | Units | Lessons | Verdict |
|---|---|---|---|
| Chess | 18 | 69, plus three games | Enough |
| Coding | 13 | 64 | Enough |
| JavaScript | 10 | 39 | Enough |
| TypeScript | 5 | 15 | Short, but it follows JavaScript. Leave for now |
| Test writing | 6 | 14 | Short, but it follows JavaScript. Leave for now |
| Maths | 3 | 12 | Not enough |
| Japanese | 3 | 12 | Not enough |

- **Japanese stops at 15 of the 46 hiragana** and a handful of words: about two weeks of lessons.
  Nobody could greet a grandchild with it.
- **Maths is three topics** (mental maths, percentages, fractions), also about two weeks.
- **The habits have their own review**, below.
- **No new subject is needed** for the name. Every subject in the brief is live.

Short courses matter more now, because each course raises a butterfly (below). A course that ends in
twelve lessons would hand its butterfly over in a fortnight.

### Habits

The habit side was reviewed the same way, by what each habit offers on day 60, not day 6.

| Habit | What it has | Once its path is done | Verdict |
|---|---|---|---|
| Calm | 5 techniques, 11 sessions | "Breathe": six slow breaths, every day | Enough to learn. Needs a way to choose |
| Move | 8 routines from 8 moves | "Move": the morning flow, every day | Not enough |
| Reflect | The same 3 prompts | The same 3 prompts | Not enough |
| Focus | A timer of 10, 15 or 25 minutes | The timer | Enough |
| Wind down | A bedtime sequence in 3 steps | The whole sequence | Enough |
| Screen break | One two-minute routine | The routine | Enough |
| One-tap habits | 4 presets, or your own name, icon and plant | Nothing changes | Works, but bare |

- **A finished path collapses to one routine.** Every other routine is still there, but only by
  scrolling back up the path and tapping an old stop. Nothing offers it.
- **Move has nothing for a stiff back or neck, nothing seated and nothing for balance.**
- **Reflect never changes and never looks back.** What was written shows only day by day, in the week
  view.
- **One-tap habits have no "when".** A habit sticks best when it is tied to something already done
  every day ("after breakfast").
- **The widget and the daily note talk about lessons and puzzles**, even to someone who only breathes
  and walks.
- **The quiet habits still show their count** in the coach's greeting ("20 days of calm in a row") and
  on the end screen's streak chip, though their tabs now hide it.
- **Still open from `docs/HABITS.md`:** counting a guided habit done away from the app.

## Decisions

1. **Lumi stays the guide.** Wings belong to butterflies, never to Lumi or to a bird. A costume with
   arm straps is fine, because it is plainly dress-up.
2. **A wingbeat is one day's practice.** The word is used sparingly: the intro, the first session of a
   day, the widget. Everything else keeps its plain words, and "streak" stays. The tagline is "Small
   beats go a long way."
3. **You have a butterfly of your own**, the one on the icon.
   - Each day practised colours one more of its 14 wing panels, in the colour of that day's first
     habit. Nothing fades.
   - It shows today in place of the flame: flying once today is done (bright), basking until then
     (soft), resting on a flower after a missed day (ember). It is never sad.
4. **Every course and habit raises a butterfly**, a real species each.
   - A Learn course: an egg when it starts, a caterpillar that grows with each finished unit, a
     chrysalis while the last unit is left, and the butterfly when every unit is done.
   - A practice or one-tap habit: the same four stages at its plant's stages (1, 5, 14 and 30 days
     practised).
   - A butterfly that has emerged lives in the garden with Lumi. These replace the anonymous
     seven-day butterfly.
5. **A field guide** has a page for each species: its name, a line or two that are true and checked
   against a named source, and which course or habit raised it.
6. **Lumi has skins**, given at events and milestones and never bought.
7. **The flame goes** from the icons, the end screen, the widget, the daily note and the coaches'
   lines. `light()` and its three states stay as they are.
8. **Maths and Japanese grow** to about 36 and 44 lessons. TypeScript and Test writing wait.
9. **Phone testing runs on the emulator** (`npm run phone`), course by course, in place of waiting
   for a real phone.
10. **No Play launch** until the owner is happy with the app, so no store listing work yet.
11. **A finished habit offers a choice.** Once Calm's or Move's path is done, the big button suggests
    the routine done least recently, and "Something else" lists the rest.
12. **Move grows** by three units: back and neck, seated, and balance.
13. **Reflect varies and looks back.** Its first and last lines stay. The middle one rotates through a
    small pool, and Reflect's home shows one line from a week ago.
14. **One-tap habits get five more presets and an optional "when"** ("after breakfast").
15. **A guided habit done away from the app can be counted** with one tap.
16. **The widget and the daily note follow what the person does**: no puzzle offered to someone who
    only breathes.
17. **A quiet habit's count is hidden on the way in and out**: the tab, the greeting and the end
    screen. The week view still shows it.
18. **Your butterfly stays on Lumi's head whatever she wears**, on top of a hat or a crown. Only the
    butterfly costume goes without it.
19. **An end screen says what matters first, and briefly.** A raised butterfly's stage, then a skin, a
    landmark, a visitor, a flower: three lines at most, two where it asks how you feel, and the rest
    is "and N more in your garden".
20. **The Android app follows the phone**: its font size and its night mode. The widget shows no number
    before there is a streak.
21. **Nothing the learner is working on sits under a fixed bar**, on a short phone too. Fit first (the
    coach, the gaps and the pictures give up room), then that part scrolls in its own box, never the
    page.
22. **Home has no title bar.** The garden starts the page and nothing covers it. ⋯ is pinned at the right
    end of the tabs row, and Sound is a switch on the ⋯ screen.
23. **What a path is raising is a picture, not a row**: its egg, caterpillar or chrysalis, drawn close up
    at the end of the streak row, into the field guide. Once it has emerged it is in the garden, and
    home says nothing more. A one-tap habit keeps the words, where there is room for them.
24. **A hint leaves once it has done its job.** A one-tap habit's "One tap when it happens" goes after
    its first day.
25. **A verdict never takes more than half the screen.** Decision 21 holds against the verdict too. Past
    half the screen it gives way: its headline first (no bigger than the explanation when text is
    larger, two lines at most), then its words scroll in their own box, Continue always in view.
    Whatever fits itself above the verdict gets the other half. While an item is played, what is
    tapped stays where it is; once it is answered, being in view above the verdict comes first (the
    coach's kept room and a map no longer tapped give way before the board or the program does).
    On a page past what the app promises (206px wide, Chrome at 200% zoom) nothing is lost: what
    the verdict covers can be scrolled clear.
26. **Some courses follow another.** TypeScript and Test writing follow JavaScript's first nine units (a
    test works that number out from every word they show). Until those are done, the follow-on's tab
    offers JavaScript first, with one tap to start anyway ("I know JavaScript: start here"). It is an
    order, never a lock.
27. **Home shows what was picked.** In the first-visit list every course and habit has one plain line
    saying what it is, and what the learner picks is all that home shows. The rest is one tap away,
    under + Habit and + Course. Skipping shows everything.
28. **Made for an upright phone.** The installed app stays upright on a phone and turns on a tablet. In
    a browser, a phone on its side shows one line over a lesson or routine asking for it upright, and
    everything is where it was when it is turned back. Home, the garden and the reading screens work
    on their side as they are. A timed routine keeps the screen on while it plays, and its sound rests
    with it.
29. **At larger text a screen gives way for what it is for.** Home is for the next lesson and its
    coach: the bar's second row moves into the page, then the greeting goes, then "See your week". A
    practice's end screen is for "How do you feel?": the pictures go first, then the words get
    briefer. Only as much as it takes, nothing at ordinary text, and nothing at all where it could
    not be enough.
30. **The app brings up a browser's own prompt at most once.** Chrome, Safari and the Android app decide
    by themselves whether to keep a site's storage, so they are asked quietly, as before. Firefox asks
    the person, over the page. There Wingbeat asks once ever, on home, once something is in the log,
    never in a lesson. After that, one line under ⋯ asks again when it is tapped.

Decisions 22 to 24 came out of the pass to take things off home, which the owner asked for; what came
off was chosen in review, and each can go back on its own. Decision 25 came out of looking at the app
with large text in a browser, which the owner asked for; the rule is the review's. Decisions 26 and 27
came out of the blind beginner playthrough (a beginner opened TypeScript on day one, and ticked two
habits and got six); the order, the way past it and hiding what was not picked are the review's
choices. Decision 28 came out of playing the phone on its side, where lessons could not be finished;
laying every lesson out a second time was the other choice, and it was not taken. Decision 29 came out
of the app at the phone's largest text, where the next lesson and the closing question were off the
screen; what gives way, and in what order, is the review's choice. Decision 30 came out of playing Firefox for
Android, which asked on every visit, over a lesson's first answer; once, where and the line under ⋯ are the review's
choices. Kept on purpose: the Games row and the course
chips, because one tap to play or to switch course is worth more than their row.

### Rules for this work

- No butterfly is ever sad, lost or dying, and nothing earned is taken away.
- "Beat" means a rhythm or a wing, never winning.
- A butterfly is never drawn alone as a logo, and never flat, blue and front-on.
- A field-guide line says only what its source says. The source sits beside it in the data.
- Every new line of copy passes the guardrail lint. A new celebration joins `CELEBRATIONS` only if it
  marks learning or practice.
- Reuse first: one butterfly drawer for the icon, the garden, the path, the widget and the guide.
- The app is in alpha, so a change may reset saved progress. No migration work to protect old saves.

## Tasks

**Theme**

- [x] **T1. Butterfly kit.** (#132) One pure module that draws the egg, the caterpillar, the chrysalis and
  every species, open and side-on. The species data: name, Latin name, lines, source, and the course
  or habit that raises it. A gallery page. No app wiring.
- [x] **T2. Switches.** (#131) A switch for coach dares. Streak numbers hidden on Calm, Reflect and Wind
  down unless switched on. Learning's 🔥 icon replaced.
- [x] **T3. Your butterfly.** (#140) The wing panels; today's three states on home, the end screen and the
  widget; the flame retired; the intro and tagline; Lumi's flipper-flap; widget and daily-note lines
  that follow what the person does. Needs T1.
- [x] **T4. Course and habit butterflies.** (#138) The stages on the path and in the garden, emerged
  butterflies with Lumi, and the field guide. Needs T1.
- [x] **T5. Lumi's skins**, (#144) with a wardrobe to choose from. After T3 and T4.
- [x] **T6. The cast brief, README and CLAUDE.md** (#149, #159, #163) brought up to date. The brief's new
  section is "The name".

**Habits**

- [x] **H1. Choose today's routine.** (#142) A finished Calm or Move path suggests the routine done least
  recently and offers the rest. One tap counts a guided habit done away from the app.
- [x] **H2. Move grows.** (#139) Back and neck, seated, and balance. Clover demonstrates every new move.
- [x] **H3. Reflect.** (#137) A middle prompt that rotates, and a line from a week ago on Reflect's home.
- [x] **H4. One-tap habits.** (#143) Five more presets and an optional "when" for any habit.
- [x] **H5. Quiet counts.** (#136) A quiet habit's count leaves the greeting and the end screen.

**Courses**

- [x] **C1. Japanese.** (#135) The rest of hiragana, the sounds that change (が, ぱ), small kana, everyday
  words, greetings and a first sentence. It teaches はばたき, "wingbeat".
- [x] **C2. Maths.** (#133) Six more units.

**Phone**

- [x] **P1. Coding** (#145) played end to end on the emulator. All 64 lessons play; what it found is in
  TODO.md under "Coding: played".
- [x] **P1a. Tall Coding programs** (#150, #157) stay clear of the answer tray and the verdict, and a
  tap lands on the block it is aimed at on a short phone.
- [x] **P2. JavaScript, TypeScript and Test writing.** (#158) All 68 lessons play.
- [x] **P3. Chess, Maths, Japanese, the practice habits,** the new butterfly screens and the live
  site. (#156, #154, #151) Chess's 69 lessons, Maths' 36 and Japanese's 44 all play.
- [x] **P4. The installed Android app** (#152): the icon, a first day, the widget, the daily note, the
  bars, back and the voice.

**Found by playing** (each course's and screen's findings are in TODO.md, under "… played")

- [x] **F1. The end screen, Move, the tabs, the dark theme and Lumi's butterfly.** (#153)
- [x] **F2. The Android app:** the phone's font size, the widget, and night mode confirmed. (#155)
- [x] **F3. Japanese and Maths:** (#160) an answer option that ran off the screen now wraps onto another
  row; sentence builds and fraction bars fit on a short phone.
- [x] **F4. Chess on a short phone:** (#162) the whole board sits above the verdict, and the coach's line
  no longer goes stale once a puzzle is solved.
- [x] **F5. The code courses:** (#161) what a Run printed shows under the goal, tall programs fit, and the
  tray shows whole rows of chips.
- [x] **F6. The emulator crashed on a short phone in the code courses:** (#164) a CSS mask on a box that
  scrolls brought down the emulator's software renderer. A box that scrolls now shows there is more above
  or below with a plain gradient, which Firefox draws too.
- [x] **F7. Code quiz cards on a short phone:** (#166) a "which line" card no longer ends under its answers or
  the verdict; every item starts at the top of the page; and a card that has to give way shortens the coach's
  bubble again (it had been growing since F4).
- [x] **F8. Firefox:** (#167) the browser suite and a walk through the main screens, run in desktop Firefox:
  nothing a person would notice differs. `npm run e2e:firefox` runs it, silently. Firefox for Android itself
  was played later (E22).

**A lighter home**

- [x] **L1. Three things off home.** (#168) The title bar, the "is raising" row and a hint that had done
  its job (decisions 22 to 24). A month in, the first unit of Chess starts at 329px of a 786px page
  where it started at 448, and on a short phone the next lesson is in sight where it was under
  Continue. `npm run phone -- home-days` shows home from day 0 to day 60.

**The emulator is the phone** (2026-11-21; what each found is in TODO.md)

- [x] **E1. The chrysalis on a phone page** (#171): seen at every stage, and redrawn so it reads at that size.
- [x] **E2. Large text in a browser** (#177): a browser's font size reaches the page; Chrome's zoom is toured on the phone.
- [x] **E3. Firefox in CI** (#172): the browser suite passes in Firefox on every pull request.
- [x] **E4. The live site from another network** (#170): GitHub plays it after every deploy.
- [x] **E5. Test writing** (#174): repeats change their values, and every build offers a wrong choice.
- [x] **E6. Phone runs keep one network** (#175): the emulators' shared Wi-Fi dropping could fail a page mid-load.
- [x] **E7. Chess with wrong moves, and its three games** (#179): nothing wrong is accepted; every Rosa reply is legal.
- [x] **E8. What a finger does** (#180): off-centre taps, swipes, the keyboard, links out, long press. A long press no
  longer raises the copy toolbar, and a pull down no longer reloads the page.
- [x] **E9. Chess in plain words** (#176): every chess word taught before it is used, and every real-game puzzle
  says why its line works, proved against its position.
- [x] **E10. The verdict at large text** (#183, decision 25): held to half the screen.
- [x] **E11. The phone as it is held** (#186): put down, locked, called, on its side, offline. What it found is being fixed.
- [x] **E12. The installed app's leftovers** (#187): a release build, no voice, a tablet, the keyboard, a link out.
- [x] **E13. A beginner, played blind** (#185): from screenshots alone. Fourteen stumbles, being fixed.
- [x] **E14. Chess's three games on a short phone** (#188): each fits one screen by the lessons' own rule, with what it
  counts in the session bar.
- [x] **E15. Words that fit what just happened** (#191): a verdict fits how the item was answered, each course's coach
  speaks for its own course, an end screen claims only what the session did, and a butterfly is called one.
- [x] **E16. Course order and the first visit** (#190, decisions 26 and 27): TypeScript and Test writing wait for
  JavaScript, the first-visit list says what each thing is, and home shows what was picked.
- [x] **E17. Lesson feedback a beginner tripped on** (#192): a rock is taught before it is met and a missed run is shown and
  said before the way that works; a chess board never moves from asked to Continue; a missed build shows what was put.
- [x] **E18. Small words** (#194): a coach greets you the first time you open their course, Calm's card states your own
  timings, an example reads the way the course writes code, and a run of five says five of what.
- [x] **E19. The phone in a hand** (#196, decision 28): the screen stays on through a routine and its sound rests with it,
  Mate says when it has no connection, a phone on its side is asked upright, and a voice is offered only where one can be had.
- [x] **E20. The largest text and small targets** (#197, decision 29): home and the end screens give way at the largest
  text, a verdict covers the tray it replaces, a placed word is 40px, and tight Coding blocks reach a thumb's 44px.
- [x] **E21. In view once answered** (#201): an answered chess board at the largest text and an answered Coding program on a
  short phone sit above the verdict, the coach's kept room and the map giving way first; tablet runs calibrate; the browser
  suites keep out of the phone's pictures.
- [x] **E22. Firefox for Android** (#181): played on the emulator through a bridge in the page. Two things stopped it drawing
  for good, the tabs row's mask and the end screen's chips clipping as they came in; both are gone and look the same. The blank
  Meet button was hunted (220 openings, 432 looks) and not seen.
- [x] **E23. Small leftovers** (#203, #205): "both stars"; a coach's aside only where it fits; a sentence card keeps its rows;
  Fennel greets each of his four courses in its own words; on a wide screen the tabs end above ⋯; the tablet's app run and the
  phone-on-its-side run pass, their checks made to say what they mean.
- [x] **E24. Firefox's storage prompt, once** (#200, decision 30): it came up on every visit, over a lesson's first answer,
  and took the next tap. Now once ever, on home, and from a line under ⋯ after that.

**Waiting on the owner** (found by playing, not changed)

- The wardrobe opens from ⋯ and from the garden, not from home itself.

What is still open and small is in TODO.md, in each "played" block.
