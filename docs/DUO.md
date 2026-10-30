# What Drill should take from Duolingo

A five-person council (retention, character, pedagogy, UX, and the critics' view) studied Duolingo
on 2026-10-30. This note turns their findings into suggestions for Drill. Every suggestion was
checked against the code on `main` at 11d274b, so none of them describes something Drill already does.

Evidence labels: **measured** means an A/B test or a published metric; **observational** means a
correlation, and selection bias is likely; **claimed** means the company said so but published no
number. Most of Duolingo's single-feature A/B effects are small (0.4–3%). The big multipliers, such
as "3.6× more likely to finish", are correlations. Drill can't A/B test, so these numbers are
priors, not promises.

## 1. The Duo magic, in one page

1. **Keep the people who already show up.** Duolingo modelled DAU as a set of user states. In
   simulation, moving the rate at which current users return the next day (CURR) mattered 5× more
   than any other lever. About 90% of DAU are current users, and CURR reached 84% in Q2 2026.
   *Measured (simulation and filings).*
   [growth model](https://blog.duolingo.com/growth-model-duolingo),
   [Lenny's](https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth),
   [Q2 2026 letter](https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053299/q2fy26duolingo6-30x26share.htm)
2. **A tiny unit keeps the habit, and ambition sits on top.** Duolingo changed the rule so that one
   lesson keeps the streak, instead of hitting the XP goal. That gave D14 retention +3.3%, DAU +1%,
   and +10.5% more learners on a streak. Shorter lessons are a founder claim.
   *Measured* [improving the streak](https://blog.duolingo.com/improving-the-streak).
3. **Continuity with slack and repair.** Two equipped streak freezes gave +0.38% DAU "without
   encouraging more days off". Seven studies show that a broken streak lowers later engagement. The
   drop is bigger when people blame themselves and smaller when the streak can be repaired.
   *Measured*: [streak blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit),
   [Silverman & Barasch, JCR 2023](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions).
4. **The end of a session is a ceremony, and milestones escalate.** One new animation on the
   streak screen at the end of a lesson raised new learners' D7 retention by +1.7%. This is the
   only "juice" with a published number. *Measured*
   [streak blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit),
   [milestone design](https://blog.duolingo.com/streak-milestone-design-animation).
5. **Every answer gets a beat, and a character who notices you.** Duolingo has instant sound,
   right and wrong reactions, and characters who stay in character. All of this is *claimed*; no
   retention number has been published
   ([visemes](https://blog.duolingo.com/world-character-visemes),
   [building character](https://blog.duolingo.com/building-character/)).
   Words are tested like features. Growth-mindset coach copy gave D14 +7.2%, and the "Hi, it's Duo"
   reminder copy gave DAU +5%. *Measured*
   [First Round](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker).
6. **Model forgetting, and keep the session winnable.** Half-life regression (HLR) cut
   recall-prediction error by more than 45% offline, and its A/B test gave +12% daily activity
   retention. Birdbrain picks items near a target success rate; about 70% is the only published
   figure, and "83%" is secondhand. Missed items come back at the end of the same lesson. Explaining
   a rule after a mistake is the default. *Measured* for HLR, and only for engagement.
   [HLR paper](https://aclanthology.org/P16-1174/),
   [IEEE](https://spectrum.ieee.org/duolingo),
   [VentureBeat](https://venturebeat.com/ai/how-duolingo-uses-ai-in-every-part-of-its-app).
7. **Review is forward motion, and there is one obvious next step.** The 2022 path weaves review
   into new lessons, so practice "feels like forward progress". *Claimed*, with no number
   ([home redesign](https://blog.duolingo.com/new-duolingo-home-screen-design)).
   Putting a lesson before the sign-up wall gave about +20% DAU. *Measured*
   ([First Round](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker)).
8. **Treat notifications as a scarce channel, and prefer ambient presence.** Raising notification
   volume needed CEO approval. A bandit that rotates copy, with a penalty for recently seen copy,
   gave DAU +0.5% and new-user retention +2%. Reminders stop when they are ignored. The widget shows
   two facts. *Measured* for the bandit
   ([Yancey & Settles, KDD 2020](https://research.duolingo.com/papers/yancey.kdd20.pdf));
   *observational* for the widget ([widget](https://blog.duolingo.com/widget-feature)).

## 2. Already in Drill

- [x] **Tiny unit:** any lesson or review keeps Learning; any session keeps a practice habit
  (`progress.js`).
- [x] **Slack and blameless repair: Drill is ahead here.** One missed day in seven is forgiven
  automatically, and a gap of up to three days is repaired by one review. The repair is free and
  never framed as "you missed"; the habit view calls a forgiven day "A rest day". The JCR result
  supports exactly this. Duolingo sells repair, and deceptive.design lists that as a dark pattern.
- [x] **Plants grow from days practised, never from the streak**, and never shrink. So when a
  streak ends, the garden still shows everything (`garden/model.js`). This is a free, permanent
  form of Streak Revival.
- [x] **End-of-session ceremony:** a high five, petals and arrivals (`finish()` in `app.js`). The
  practice end is calm on purpose.
- [x] **Every answer gets a beat:** `cue()`, `flourish()`, coach right and wrong moods, a run meter,
  and a soft wrong sound that is "never a buzzer" (`feel.js`).
- [x] **Retry mistakes at the end of the session, and explain on failure.** Every item ships with
  an `explain`, and only the first try is scheduled.
- [x] **FSRS** is a successor to HLR in spirit: per item, per person, and on the device.
- [x] **Value before asks:** no account, a skippable intro, and placement only as an optional
  "Skip ahead" link.
- [x] **Coaches in character:** voice sheets with `never` lists, state-keyed pools, `say()` with
  recency exclusion, dares once a day, and comeback welcomes.
- [x] **Scarce notifications:** one opt-in note that is silent once anything is done. `fitting.js`
  picks the hour from usual practice and thins the note, then stops it, when it is only ever
  cleared. A passive "Reminders are paused" line replaces Duo's farewell.
- [x] **Drop-off comeback** with a ladybird visitor, and a shorter version of a practice that is
  often left part-way.
- [x] **Light social:** opt-in friends with preset cards and one cheer a day, and no free text.

## 3. Suggestions, ranked

Ranked by expected gain in habit-keeping and learning, divided by effort.

### Do next

**1. Show the plant grow on the end screen.**
- **What:** at the end of a session, when a habit crosses a stage in `STAGES` (days 1, 5, 14 and
  30), `finish()` and `finishRoutine()` in `app.js` show that plant growing a stage, with one line
  ("Your tree is a sapling now"). On the days between stages, the bar in `stage().next` fills a
  little. On the practice end screen it is a quiet grow, not a party.
- **Evidence:** the end-of-session animation (+1.7% D7, *measured*) and escalating milestones.
  Today `award()` only reports visitors and flowers, so a stage-up happens unseen.
- **Fits:** growth only, nothing to lose, and it reuses `plant()` from `art.js`.
- **Size:** S. **Confidence:** measured (analogue).

**2. Write the daily note in the coach's voice.**
- **What:** the note picks from three generic Lumi lines (`WIDGET_LINES.remind`). Instead, have
  `summary()` in `widget.js` pass a line from `say()`. The line comes from the coach of the habit the
  person usually does at that hour, with a `note` moment in each voice pool and slots such as
  `{habit}`. Keep the last few sent and exclude them, as home already does.
- **Evidence:** "Hi, it's Duo" copy gave +5% DAU, and rotating copy with a recency penalty gave
  +0.5% DAU (both *measured*).
- **Fits:** still one note, still backed off by `shouldRemind()`. No dares in the note, and the
  guardrail lint covers the new moment.
- **Size:** S. **Confidence:** measured.

**3. Review without debt.**
- **What:** home's chip says "`${due.length}` to review". After a week away that number could be
  80, which reads as a wall of debt. Show "A short review · about 3 min" instead; the session is
  already capped at `REVIEW_SIZE`. Also turn on `enable_fuzz` in `fsrs()` (`progress.js`), so cards
  learned together don't all fall due on the same day.
- **Evidence:** a review backlog is Anki's main cause of burnout, and Anki added a load balancer to
  spread it ([forum](https://forums.ankiweb.net/t/load-balancer-on-fsrs/49433)). Duolingo
  likewise never shows a debt count.
- **Fits:** no guilt or urgency, and it is a one-line change in each place.
- **Size:** S. **Confidence:** plausible.

**4. "Away for a while": rest days you choose.**
- **What:** add a choice in the habit view and on ⋯: "Resting until …". `gap()` in `progress.js`
  treats those dates as kept. `shouldRemind()` returns false, and `dropOff()` doesn't start a
  comeback. Rest ends early when you practise.
- **Evidence:** streak freezes gave +0.38% DAU with no extra days off (*measured*). Habitica's
  users named punishment at bad times as the most common harm
  ([IJHCS 2019](https://epub.ub.uni-muenchen.de/77668)). Its "Inn" is the fix.
- **Fits:** illness and holidays never register as gaps. It is opt-in and has no currency.
- **Size:** M. **Confidence:** measured (freeze analogue).

**5. Weave due cards into new lessons.**
- **What:** `lesson()` in `app.js` appends the 1–2 most-due cards of the course shown to each new
  lesson. They are marked as review and scheduled as review in `finishSession()`. The separate chip
  stays for repair and for days with no new lesson.
- **Evidence:** the 2022 path design (*claimed*), plus HLR's +12% daily activity retention for
  spacing (*measured*, engagement only).
- **Fits:** "Lumi walks the path": review becomes forward motion, not going back.
- **Size:** M. **Confidence:** plausible.

**6. Make the reward moments accessible.**
- **What:** add Motion and Haptics toggles on ⋯. `reducedMotion()` in `cast/kit.js` and `buzz()`
  in `feel.js` read a pref as well as the OS setting. Give the end screen one spoken sentence
  ("Learning: 6 of 7 right first try. Your tree grew to sapling.") instead of bare chips.
- **Evidence:** Duolingo's results screen is read out as numbers without context, and there is no
  in-app motion setting (user reports, [AppleVis](https://www.applevis.com/forum/ios-ipados/accessibility-duolingo)).
  CLAUDE.md lists accessibility as open.
- **Fits:** opt-in and minimum friction.
- **Size:** S. **Confidence:** plausible.

### Worth trying

**7. Start reviews with a win.**
- **What:** `dueKeys()` sorts most-overdue first, so a review opens on the hardest cards. Instead,
  order by FSRS `get_retrievability()`: one likely win first, then mix. If two answers in a row are
  wrong, serve the highest-recall card next.
- **Evidence:** Birdbrain's ease-off when errors cluster, and its ~70% target (*claimed*). This
  reuses FSRS's own prediction rather than adding a model.
- **Size:** S. **Confidence:** plausible.

**8. Show the tip again on the retry.**
- **What:** when a missed item comes back at the end of the session (`entry.retry` in `run()`), a
  "Tip" link on the coach bubble shows the original `explain`.
- **Evidence:** Smart Tips appear after a mistake and can be reopened
  ([grammar post](https://blog.duolingo.com/language-rules-learning-grammar-on-duolingo/)).
- **Size:** S. **Confidence:** plausible.

**9. Judge changes by learning, not taps.**
- **What:** a `tools/learning.js` that reads an exported progress file and reports first-try
  accuracy per unit, recall per review band, and lessons that are often left. Use it before and
  after each change to course content or "juice".
- **Evidence:** every published HLR or Birdbrain win is an engagement number. An insider describes
  a redesign that grew actives but cut learning time
  ([Green Owl](https://personal-website-c5k.pages.dev/duolingo)). Points raise output, not
  competence ([Mekler](https://glassmanlab.seas.harvard.edu/annotated_works/mekler17.pdf)).
- **Fits:** a developer tool on a file you export yourself; nothing is sent.
- **Size:** S. **Confidence:** plausible.

**10. A coach's "no hints" pass on a finished unit.**
- **What:** an optional dare on a finished unit: replay its items with no hint markers and no
  `demo`. Doing it earns a golden flower (one line in the garden `RULES`). There is no timer, and
  failing costs nothing.
- **Evidence:** Legendary doubles as review for people who want proof (*claimed*).
- **Fits:** dares stay a bet in character, never a gate.
- **Size:** M. **Confidence:** speculative.

**11. "Try one now" from the intro.**
- **What:** step 1 of `intro()` gets a button that plays the picked course's first lesson
  straight away, with the picks offered after the first win.
- **Evidence:** moving the sign-up wall behind a lesson gave about +20% DAU (*measured*). Drill
  has no wall, so the gain is smaller.
- **Size:** S. **Confidence:** plausible.

**12. A gentle aim, offered once after the first week.**
- **What:** "How many days a week suits you?" (3, 5 or 7, or skip), stored in `progress.aim`.
  `dropOff()` measures against the aim, and the coach can mention it. It is never shown as a
  shortfall.
- **Evidence:** "Commit to my goal" lifted retention even when the choice wasn't used (*claimed*,
  [Lenny's](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks)).
- **Fits:** asked after the fact, so not "in the way". Days-per-week, so no daily pressure.
- **Size:** S. **Confidence:** speculative.

**13. Put the garden on the widget.**
- **What:** `look()` in `widget.js` picks the best habit's plant at its stage, lit by today's light,
  in place of the flame and number.
- **Evidence:** when GitHub removed its visible streak counter, token "keep-alive" days and
  weekend work fell ([ICSE 2021](https://arxiv.org/pdf/2006.02371v3.pdf)). Duolingo's two-fact
  widget is *observational*.
- **Size:** M. **Confidence:** plausible.

**14. Drop the speed chip.**
- **What:** `finish()` praises pace (BLAZING, SWIFT). Show only accuracy, the streak, and what
  was learned.
- **Evidence:** users rush and farm lessons for XP
  ([HKUST](https://arxiv.org/abs/2203.16175)). Duolingo now tracks "time spent learning well".
- **Size:** S. **Confidence:** plausible.

**15. Coaches who know each other.**
- **What:** today no voice pool mentions another coach. Add a few cross-cast lines per coach
  ("Moss says Ada counted his naps. Twice.").
- **Evidence:** a cast "creates a world" (*claimed*, no number).
- **Size:** S. **Confidence:** speculative.

### Later

**16. A season recap.**
- **What:** when the season changes (`season.js`), show a card of the season's growth, its
  visitors, and a "habit personality". It is drawn on a canvas and shared by the person's own tap
  via `navigator.share`.
- **Evidence:** Year in Review shares and post-view activity are *claimed*.
- **Size:** M. **Confidence:** speculative.

**17. A shared visitor with a friend.**
- **What:** when you and a friend both practise on three of the same days in a week, both gardens
  get a visitor. It is only counted when both are active, so no one carries a quiet partner, and
  it never resets.
- **Evidence:** a third of DAU have a Friend Streak (*observational*); see
  [Friends Quests](https://blog.duolingo.com/friends-quests/).
- **Fits:** sync is opt-in, and the server only needs dates.
- **Size:** L. **Confidence:** speculative.

**18. A toggle to hide streak numbers.**
- **What:** a toggle on ⋯ that hides streak numbers. The garden and the habit view's squares still
  show progress.
- **Evidence:** Headspace offers this toggle
  ([Headspace help](https://help.headspace.com/hc/en-us/articles/215730567-How-does-the-run-streak-feature-work)).
  There is no outcome data.
- **Size:** S. **Confidence:** speculative.

**19. One playful line per lesson.**
- **What:** in Japanese and Maths, one sentence or sum per lesson that stars a coach ("Ada holds
  six umbrellas").
- **Evidence:** silly sentences are *claimed* to aid recall, with no study cited
  ([blog](https://blog.duolingo.com/why-does-duolingo-teach-weird-sentences/)).
- **Size:** S (content). **Confidence:** speculative.

**20. Seed FSRS from item difficulty.**
- **What:** authored tags (a kana that is easy to confuse, a two-step tactic) give a hard item a
  shorter first interval.
- **Evidence:** HLR's per-item features are where its offline gains came from (*measured*).
- **Size:** M. **Confidence:** speculative.

## 4. Deliberately not copying

- **XP, leagues, percentile ranks.** Leagues raised learning time (+17%, *claimed*). The critics'
  lens found no primary source for that figure, so we treat it as unverified. Leagues also bring XP
  farming and "gamification misuse" ([HKUST](https://arxiv.org/abs/2203.16175)). In Fitbit data,
  leaderboards cost already-active users about 630 steps a day
  ([Hydari et al.](https://arxiv.org/abs/2301.02767)).
- **Hearts and Energy.** Duolingo's own earlier move limit was neutral on retention (*measured*).
  Energy draws backlash because it rations practice
  ([Android Authority](https://androidauthority.com/quitting-duolingo-energy-system-3599842)).
- **Gems, paid freezes, paid repair.** Repair is Drill's best idea. Selling it is a catalogued dark
  pattern ([deceptive.design](https://www.deceptive.design/articles/when-a-user-uses-duolingo-on-a-series-of-consecutive-days-this-is-called-a-streak-if-users-miss-a-day-they-can-pay-to-repair-it)).
- **Guilt as tone.** This covers the passive-aggressive reminders, the panicking widget, the
  melting icon and "Duo is dead". No published A/B result shows guilt copy beating neutral copy; the
  "sad Duo gets more opens" claims are folklore. Its farewell line lands as shame for some
  ([Daily Dot](https://www.dailydot.com/irl/duolingo-owl-memes/)). Dead Duo's 1.7B impressions came
  from social reach that Drill doesn't have.
- **Timed boosts and midnight countdowns.** These are ticking-clock stressors
  ([Android Authority](https://androidauthority.com/duolingo-xp-boost-ux-trap-3674572)).
- **Fleet A/B testing and telemetry.** Drill keeps data on the device. Copy the discipline instead:
  a written hypothesis per change, the emulator, and suggestion 9.
- **A strict path with no escape.** The 2022 path cost learners their choice
  ([PiunikaWeb](https://piunikaweb.com/2022/10/13/duolingo-app-update-with-path-ui-faces-backlash-from-users/)).
  Drill keeps earlier lessons open and offers placement.
- **Live AI-written content.** The "AI-first" memo cost trust
  ([Fortune](https://fortune.com/2025/08/18/duolingo-ceo-admits-controversial-ai-memo-did-not-give-enough-context-insists-company-never-laid-off-full-time-employees)).
  Drill drafts lines at authoring time and a person reviews every one.

**Where the memos disagreed, and how it was resolved:**
- **Leagues' +17%.** The retention memo cites it as measured; the pitfalls memo couldn't find a
  primary source. It is marked as claimed, and it doesn't matter, because leagues are out either
  way.
- **The success target.** The figures are 70% (on record) and 83% (secondhand). Suggestion 7 uses
  FSRS's own recall prediction rather than a fixed number.
- **Streak numbers.** The critics say not to headline the count; HABITS.md settled that the numbers
  stay. Numbers stay on the tabs. The widget (13) and the hide toggle (18) are left to Joseph.
- **Commitment framing versus "no questions in the way".** The aim is asked once, after a week,
  and can be skipped (12).
- **The final reminder.** Duolingo's farewell is respectful in intent but reads as passive
  aggression. Drill's existing passive line on ⋯ is the better version, so no farewell note is
  suggested.

## 5. Open questions for Joseph

1. **Widget:** keep the flame and number, or show the plant (13)?
2. **Rest days (4):** should Drill ever offer a rest, for example after a long run of evenings with
   nothing done, or only when the person sets one?
3. **Woven review (5):** should it add 1–2 items to each lesson, or replace 1–2 new ones so
   lessons stay the same length?
4. **Gentle aim (12):** worth asking at all, or does it break "no questions"?
5. **Season recap sharing (16):** is a share button acceptable when the person chooses what
   leaves the device?
