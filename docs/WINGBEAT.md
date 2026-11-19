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
- [ ] **T6. The cast brief, README and CLAUDE.md** brought up to date. Last.

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
- [ ] **P1a. Tall Coding programs** stay clear of the answer tray and the verdict, which P1 found they
  don't on a short screen.
- [ ] **P2. JavaScript, TypeScript and Test writing.**
- [ ] **P3. Chess, Maths, Japanese, the practice habits,** the new butterfly screens and the live
  site.
