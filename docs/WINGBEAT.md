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
- **The practice habits are enough.** Their routines repeat and grow by turning up.
- **No new subject is needed** for the name. Every subject in the brief is live.

Short courses matter more now, because each course raises a butterfly (below). A course that ends in
twelve lessons would hand its butterfly over in a fortnight.

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

- [ ] **T1. Butterfly kit.** One pure module that draws the egg, the caterpillar, the chrysalis and
  every species, open and side-on. The species data: name, Latin name, lines, source, and the course
  or habit that raises it. A gallery page. No app wiring.
- [ ] **T2. Switches.** A switch for coach dares. Streak numbers hidden on Calm, Reflect and Wind
  down unless switched on. Learning's 🔥 icon replaced.
- [ ] **T3. Your butterfly.** The wing panels; today's three states on home, the end screen and the
  widget; the flame retired; the intro and tagline; Lumi's flipper-flap. Needs T1.
- [ ] **T4. Course and habit butterflies.** The stages on the path and in the garden, emerged
  butterflies with Lumi, and the field guide. Needs T1.
- [ ] **T5. Lumi's skins**, with a wardrobe to choose from. After T3 and T4.
- [ ] **T6. The cast brief, README and CLAUDE.md** brought up to date. Last.

**Courses**

- [ ] **C1. Japanese.** The rest of hiragana, the sounds that change (が, ぱ), small kana, everyday
  words, greetings and a first sentence. It teaches はばたき, "wingbeat".
- [ ] **C2. Maths.** Six more units.

**Phone**

- [ ] **P1. Coding** played end to end on the emulator.
- [ ] **P2. JavaScript, TypeScript and Test writing.**
- [ ] **P3. Chess, Maths, Japanese, the practice habits,** the new butterfly screens and the live
  site.
