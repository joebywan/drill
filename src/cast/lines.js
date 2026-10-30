/**
 * Everything the cast says, in one place so the guardrail tests can lint it. Lines praise the
 * process, never ability, and never mention absence or loss.
 *
 * Rosa's voice: a retired club champion, sharp and warm and a touch theatrical. She is vain about
 * her own play and her cardigan, never about the learner's mistakes: she teases the move, not
 * the person. Lumi is a baby seal and keeps it short.
 */
export const LINES = {
  correct: [
    'Well spotted.',
    "That's the move. I'd have played it myself.",
    'Ooh. That one had my name on it.',
    'Yes! You checked every target first.',
    'Correct. Write that one down, darling.',
    'There it is. Textbook.',
    'Mm. A move with manners.',
    "That's how I won the club final in '74. Near enough.",
    "Right, and you didn't rush it. Good.",
    'Lovely. You looked before you leapt.',
  ],
  wrong: [
    'Not quite. I played that once too. Once.',
    'Hm. Bold. Wrong, but bold.',
    'Close. Look again, the board is telling you something.',
    "Not this one, love. Read why, then it's yours.",
    'Nope. But that is exactly the mistake worth making today.',
    'Ah. Every opponent I ever beat tried that one.',
    'Not this time. Check what each piece attacks.',
  ],
  run3: [
    "Three in a row. Now you're reading the board.",
    "Three! I'm starting to feel competitive.",
    'Three in a row. Careful, I get jealous.',
  ],
  run5: [
    "Five in a row! That's patient, tidy work.",
    'Five! Somebody fetch my trophy, I may need to defend it.',
    "Five in a row. I haven't seen focus like that since my club final.",
  ],
  tapped: [
    'Take your time. The board will wait. So will I, gorgeously.',
    'Chess is patterns. You are collecting them.',
    'My grandson still has not beaten me. He is getting closer.',
    'Before every move, ask: what does it attack?',
    'Park champion eleven summers running. Ask anyone. Well, ask the pigeons.',
    'Yes, the cardigan is hand-knitted. No, you cannot have it.',
    'Look at what the piece attacks, dear, not at me. I know I am distracting.',
    'I once forked a king and a queen at my own wedding reception.',
    'Lumi thinks the knight is a little seal. I have stopped correcting her.',
    "Don't mind me. I'm admiring my pawn pin.",
  ],
  // The sublines under the end-screen headline, one kind per way a lesson can go (see `finished`).
  complete: [
    'Lesson done. These come back in review, so they stick.',
    'That is the lesson. Short, sharp, done.',
  ],
  perfect: [
    "Every one right first time. That's careful play.",
    'Not a single slip. I checked twice, out of habit.',
    'Right first time, every one. You looked at the whole board.',
  ],
  fast: [
    'Quick and right, every one. That is checking done well.',
    'Fast, and not a guess among them. You looked first.',
  ],
  struggled: [
    'Every miss you fixed is one you will spot next time.',
    'You worked those out. That is where the learning happens.',
    'The tricky ones come back in review. That is the plan, not a penalty.',
  ],
  review: [
    'Review done. Those patterns are sticking.',
    'Recall like that is how the patterns settle in.',
  ],
  relit: ['That review relit your streak. Welcome back to the board.'],
  repair: ['One short review relights your streak'],
  // Lumi, on home for a brand-new learner.
  welcome: ["Hi, I'm Lumi. Pick something to grow."],
  // Lumi, beside Rosa on the end screen.
  lumi: ['Flipper five!', 'Arf arf!', 'High fin!', 'Wheee!', 'Again! Again!'],
};

/**
 * The end-screen headline, by the same kinds as the sublines: Rosa playing to the gallery.
 */
export const HEADLINES = {
  complete: [
    'Lesson done. Short and sweet, like me.',
    'And that is a lesson. Curtain! Flowers to my dressing room.',
  ],
  perfect: [
    'Flawless. I may need to sit down.',
    'Not one slip! Who taught you? Oh, right. Me.',
    'Perfect. Filing that under my finest coaching.',
    'Every one first time. My cardigan is positively glowing.',
  ],
  fast: [
    'You... Wow. Uhh. That was so quick I had no time to prepare a speech.',
    'Done already? My tea is still hot!',
    'Blink and I missed it. Play it again slower so I can take the credit.',
  ],
  struggled: [
    'Ooh, that took some wrestling. And you won the bout.',
    'Messy in the middle, tidy at the end. Just like my 1979 final.',
    'You fought for that one. I respect a fight.',
  ],
  review: [
    'Look at that recall. Somebody has been practising.',
    'Remembered! I am proud, and I am usually only proud of myself.',
    'Review done. Those patterns are moving in to stay.',
  ],
  relit: ['Streak relit! Somebody put the kettle on.', 'There it is, the streak is glowing again.'],
};

/** A line of the given kind; `pick` in [0, 1) chooses which. */
export const line = (kind, pick = Math.random(), from = LINES) => from[kind][Math.floor(pick * from[kind].length)];
export const headline = (kind, pick) => line(kind, pick, HEADLINES);

/**
 * The learning events that earn a celebration: a run of right answers, a lesson right first
 * time all through (quickly or not), a streak relit by a review.
 */
export const CELEBRATIONS = ['run3', 'run5', 'perfect', 'fast', 'relit'];

/** The banner line kind for a right answer, given the run of right answers so far. */
export const rightAnswer = (run) => (run === 5 ? 'run5' : run === 3 ? 'run3' : 'correct');

/** The end-screen kind for a finished session: picks both the headline and the subline. */
export const finished = ({ review, perfect, relit, fast = false, missed = false }) =>
  review ? (relit ? 'relit' : 'review') : perfect ? (fast ? 'fast' : 'perfect') : missed ? 'struggled' : 'complete';

/** End-screen chip labels: the first band whose floor the value reaches. */
const band = (bands, value) => bands.find(([floor]) => value >= floor)[1];
export const ACCURACY = [[100, 'SPOT ON'], [80, 'SOLID'], [0, 'GETTING THERE']];
// Seconds per item, fastest first. ponytail: one flat pace for every item type; weight by type
// (teach items read slower than taps) if the label feels unfair.
export const PACE = [[-8, 'BLAZING'], [-14, 'SWIFT'], [-Infinity, 'STEADY']];
export const accuracyLabel = (percent) => band(ACCURACY, percent);
export const paceLabel = (secondsPerItem) => band(PACE, -secondsPerItem);
export const STREAK_LABEL = 'DAY STREAK';

/**
 * Moss, Calm's coach: a capybara, unhurried and warm, with a little dry humour. Never clinical,
 * never in a rush, no exclamation marks. Calm makes no health claims (the guardrail tests check).
 */
export const CALM_LINES = {
  breatheIn: ['Breathe in…'],
  breatheOut: ['and slowly out'],
  // The double-inhale sigh: in through the nose, a little more, then a long sigh out.
  sighIn: ['In through your nose…'],
  sighTop: ['and a little more'],
  sighOut: ['and one long sigh out'],
  // The butterfly hug, said once as it starts.
  hug: ['Left, then right. Nice and slow.', 'Tap, tap. Breathe slowly while you go.'],
  paused: ['Paused. Take as long as you like. I have nowhere to be.'],
  ground: ['Look around. No rush.', 'Whatever you notice counts.', "Take your time. I'll wait. I'm good at waiting."],
  tapped: [
    'Capybaras invented sitting still. I like to think so, anyway.',
    "A bird sat on my head once for an hour. I didn't mention it.",
    "There's no wrong way to do this. I've checked.",
    'Slow is a perfectly good speed.',
    'I am very relaxed. It took years of lying in warm water.',
  ],
  // The end screen: settled, not a party.
  done: ['That was a few quiet minutes, just for you.', 'Done. Have a moment to notice how you are.', 'Nicely done. Slow and steady.'],
  'calmer': ['Good. Keep a bit of that for later.', "That's nice to hear. The breath is always there when you want it."],
  'about the same': ["That's fine. Some days it's just a pause, and a pause still counts.", 'Fair enough. Thanks for taking the time anyway.'],
  'no different': ["That's alright. Thanks for telling me. Some days are heavy, and that's not on you."],
};

/**
 * Hazel, the Focus coach: a beaver who builds one stick at a time. Steady and unbothered. Never a
 * word about distraction, productivity or time wasted: a wandering mind is normal, and stopping is fine.
 */
export const FOCUS_LINES = {
  ask: ['One thing at a time. What is it today?', 'Pick one, or just start. Either is fine.'],
  go: ['Off you go. I will be here, building.', 'One thing. Stick by stick.', 'If your mind wanders, just come back to it.'],
  paused: ['Paused. Take whatever you need. The dam will keep.'],
  tapped: [
    'Nobody builds a dam in a day. One stick, then the next.',
    'I chew when I think. Mostly I chew.',
    'Tail tap. That means hello.',
    'Water, wood and a bit of quiet. That is my whole plan.',
  ],
  // The end screen: settled, not a party, whenever it finished.
  done: ['That was some time for one thing.', 'Done. Stretch your paws.', 'Nice and steady. One thing at a time.'],
  'focused': ['Good. Hold on to that.', 'Lovely. A bit of quiet goes a long way.'],
  'about the same': ['That is fine. Sitting with one thing still counts.', 'Fair enough. Thanks for giving it a go.'],
  'no different': ["That's alright. Some days are bumpy, and that's not on you."],
};

/**
 * Moss at bedtime, for Wind down: the same capybara, quieter. No exclamation marks, no hurry, no
 * claims about sleep, and nothing about screens or how late it is (the guardrail tests check).
 */
export const WINDDOWN_LINES = {
  paused: ['Paused. Take as long as you like.'],
  tapped: [
    'Capybaras are very good at evenings. We practise a lot.',
    'Warm water, low light, a long sigh. That is my whole evening.',
    'The day is done. You can set it down now.',
    'Nothing else to do tonight. I checked.',
  ],
  // The end screen: settled, not a party.
  done: ['All wound down. Goodnight.', 'Quiet now. Goodnight.', 'That was a soft end to the day.'],
  'settled': ['Good. Take that with you.', 'Lovely. Rest easy.'],
  'about the same': ["That's fine. A quiet few minutes still counts.", 'Fair enough. Thanks for winding down with me.'],
  'no different': ["That's alright. Thanks for telling me. Some nights are heavy, and that's not on you."],
};

/** Calm's optional sounds, set from the ⋯ screen: [preference, label]. */
// The ⋯ screen's season toggle: on when the timezone guesses south, and it can be changed.
export const SOUTH_LABEL = 'Southern hemisphere seasons';
export const CALM_SOUNDS = [['bell', 'A soft bell at the start and end'], ['rain', 'Soft rain while you practise']];

/** Real help, shown as plain text on the first Calm lesson and after "Not really". */
export const HELP_LINE = "If you're struggling, talk to someone. In Australia, Lifeline is 13 11 14, any time.";
export const HELP_TEL = 'tel:131114';
/** Calm's (and Reflect's) help, for the subject's coach: shown on the first lesson and after "Not really". */
export const CALM_HELP = { text: HELP_LINE, tel: HELP_TEL, call: '13 11 14' };

/** The optional "How do you feel?" answers: [stored value, button label]. Never scored. */
// The stored value reads after "felt" in the habit view: "Breathing · 2 min · felt calmer".
export const FEELS = [['calmer', 'Calmer'], ['about the same', 'About the same'], ['no different', 'Not really']];
/** The answers for a habit whose good outcome is `good` ('better', 'refreshed'…). Only the first differs. */
export const feelsFor = (good = 'calmer') => [[good, good[0].toUpperCase() + good.slice(1)], ...FEELS.slice(1)];

/**
 * Mira, the screen break's coach: a lemur who loves a sunny branch and a long look at the trees.
 * Playful and easy. Plain words, no health claims, no hurry, and never a word about how long you
 * have been on a screen.
 */
export const BREAK_LINES = {
  paused: ["Paused. I'll sit here and look at the trees."],
  tapped: ['Big eyes, soft gaze. That is the whole trick.', 'Look far. Further. Is that a mango tree?', 'Tail swish allowed.'],
  done: ['Break done. Back to it, nice and loose.', 'That was a good stretch.', 'Eyes rested, shoulders rolled. Lovely.'],
  'refreshed': ['Nice. Rested eyes, happy lemur.'],
  'about the same': ['That is fine. A short break still counts.'],
  'no different': ['That is alright. Thanks for telling me.'],
};

/** On the first screen break lesson and after "Not really". */
export const SAFETY_LINE = 'Move gently and stop if anything hurts.';

/**
 * Lumi, Reflect's coach: short and warm, as ever, but quiet here. No exclamation marks, no hurry,
 * and nothing that judges what was written (the guardrail tests check). The learner's own lines
 * are never linted: only what Lumi says is.
 */
export const REFLECT_LINES = {
  write: ['Any size is fine.', 'A few words is plenty.', 'Skip it if nothing comes.', 'Whatever comes first.'],
  tapped: [
    'Seals think a lot while floating. I float a lot.',
    'Small things count. Fish are small.',
    "Nobody reads these. Not even me. I can't read.",
    'Take your time. The tide comes back anyway.',
  ],
  // The end screen: settled, not a party.
  done: ['Kept, just for you.', 'That is today, noted.', 'Done. Short and sweet.'],
  'clearer': ['Good. Writing it down can do that.', 'Nice. Keep a bit of that.'],
  'about the same': ['That is fine. The lines are kept either way.', 'Fair enough. Thanks for stopping by.'],
  'no different': ["That's alright. Thanks for telling me. Some days are heavy, and that's not on you."],
};

/**
 * Move's coach: playful and gentle. Never pushes for more, never mentions bodies' shape or size;
 * the count is a guide, not a target (the guardrail tests check).
 */
export const MOVE_LINES = {
  go: ['Copy me, nice and easy.', 'Your pace is the right pace.', 'Smaller is fine. Comfy is the goal.', 'Breathe as you go.'],
  rest: ['Have a breather.', 'Shake it out.', 'Rest. Next one coming up.'],
  paused: ["Paused. Rest as long as you like. I'll stretch while I wait."],
  tapped: [
    'I do these every morning. Well, most mornings.',
    'Wiggle your toes. No reason. It just feels nice.',
    'Stiff is normal. Bodies like moving, a little at a time.',
    'My favourite move is the reach-up. Hello, ceiling.',
  ],
  // The end screen: settled, not a party.
  done: ['A few minutes of moving, just for you.', 'Done. Nice and easy does it.', 'All moved. Have a sip of water.'],
  'better': ['Lovely. Hold on to that for later.', 'Good to hear. Your body says thanks.'],
  'about the same': ["That's fine. Some days it just feels like moving, and that counts.", 'Fair enough. Thanks for moving with me.'],
  'no different': ["That's alright. Thanks for telling me. Go gently today."],
};

/** Safety, shown as plain text on the first Move lesson and after "Not really". */
export const MOVE_SAFETY = 'Move gently and stop if anything hurts. If you have an injury or a health condition, check with a doctor first.';

/**
 * Self-reported habits ("I walked today"): one tap says yes, today. The words stay plain and
 * calm: no counting toward a target, no reminders, nothing about a day it didn't happen. The
 * names learners give their own habits are theirs and are never linted; these words are.
 */
export const LOG_WORDS = {
  hint: 'One tap when it happens. That is all.',
  done: 'Done for today.',
  undo: 'Undo',
  edit: 'Edit',
  add: 'Pick one to keep track of. Each one grows its own plant in your garden.',
  addTab: '+ Habit',
  own: 'Make your own',
  ownTitle: 'Make your own',
  editTitle: 'Edit habit',
  name: 'Name',
  icon: 'Icon',
  plant: 'Plant',
  create: 'Add habit',
  save: 'Save',
  hide: 'Hide this habit',
  hideNote: 'Hiding keeps its days and its plant. Add it again any time from + Habit.',
};

/**
 * The first-visit intro (app.js intro): what Drill does, then what the learner would like out of
 * it. Plain words, every step skippable, and linted like the rest. `does` is keyed by habit id,
 * plus `track` for the one-tap habits.
 */
export const INTRO_WORDS = {
  title: 'What can Drill do for you?',
  does: {
    learn: 'Learn: short lessons, one course at a time.',
    calm: 'Calm: slow breathing and a body scan.',
    move: 'Move: gentle exercises, a few minutes long.',
    reflect: 'Reflect: three lines about your day.',
    break: 'Screen break: rest your eyes and stretch.',
    winddown: 'Wind down: a few quiet minutes before bed.',
    focus: 'Focus: a calm timer for one thing at a time.',
    track: 'Track: one tap for a walk, a book, water or time outside.',
  },
  garden: 'Your habits grow plants in a garden, and nothing ever wilts.',
  privacy: 'Everything stays on this device.',
  next: 'Next',
  skip: 'Skip',
  back: 'Back',
  want: 'What would you like out of Drill?',
  wantSaid: 'Pick as many as you like. You can change this any time from the ⋯ menu.',
  learn: 'Learn something',
  habits: 'Build habits',
  courses: 'Courses',
  habitList: 'Habits',
  soon: 'coming soon',
  soonCourses: [],
  done: 'Show my home',
  first: '{name} is first. Start with the button below.',
  change: 'Change what you see',
};

/**
 * Kaede, the red panda who coaches Japanese. A show-off with a soft centre: she rears up on her
 * hind legs to celebrate, takes a little credit, and talks about bamboo more than is strictly
 * necessary. Same kinds as LINES, so the lesson runner and end screen read hers in Rosa's place.
 */
export const KAEDE_LINES = {
  correct: [
    'Yes! Read like a local.',
    'That one is yours now.',
    'Right. I am standing on my back legs about it.',
    'Correct. You looked at the shape first. Good habit.',
    'Nailed it. I would offer you bamboo, but it is mine.',
    'Exactly that sound.',
  ],
  wrong: [
    'Not that one. These two are twins, almost. Read why.',
    'Nope, but now you have seen the difference.',
    'Close. Look at the little strokes, that is where it hides.',
    'Not quite. Everyone mixes these up on day one. Even me. Once.',
    'Hm, no. The mnemonic is the trick: picture it again.',
  ],
  run3: [
    'Three in a row! My tail is doing the thing.',
    'Three! You are reading, actually reading.',
  ],
  run5: [
    'Five in a row! I am up on my hind legs. This is my big pose.',
    'Five! Somebody fetch me a bamboo trophy.',
  ],
  tapped: [
    'Yes, I am a red panda. No, not that kind of panda. The original one.',
    'Kaede means maple. Look at my fur. I suit it.',
    'Each kana is one sound. Learn the shape, the sound comes with it.',
    'Say it out loud. Your mouth remembers too.',
    'I stand up on my back legs when I am pleased. You will see it a lot.',
    'Hiragana first, then words. Then the menu. Then the world.',
  ],
  complete: [
    'Lesson done. These come back in review, so they stick.',
    'That is the lesson. New shapes, new sounds, all yours.',
  ],
  perfect: [
    'Every one right first time. You read every stroke.',
    'Not one slip. I checked with my whiskers.',
  ],
  fast: [
    'Quick and right, every one. Those shapes are sinking in.',
    'Fast, and not a guess among them.',
  ],
  struggled: [
    'Every mix-up you sorted out is one you will spot next time.',
    'The tricky ones come back in review. That is the plan, not a penalty.',
  ],
  review: [
    'Review done. Those kana are moving in to stay.',
    'Recall like that is how a script settles in.',
  ],
  relit: ['That review relit your streak. Welcome back to the kana.'],
};

/** Kaede's end-screen headlines, by the same kinds as HEADLINES. */
export const KAEDE_HEADLINES = {
  complete: ['Lesson done! Tail up, ears up.', 'And that is a lesson. Bamboo for everyone. Well, for me.'],
  perfect: ['Flawless! I am standing on my hind legs right now.', 'Perfect. I will be taking some credit for this.'],
  fast: ['Done already? I had barely finished my bamboo.', 'Whoosh. That was quick and right.'],
  struggled: ['That took some wrestling, and you won.', 'Messy in the middle, tidy at the end.'],
  review: ['Look at that recall!', 'Remembered! The kana are settling in.'],
  relit: ['Streak relit! Ears up!'],
};

// --- Maths ----------------------------------------------------------------------------------

/**
 * Ada, the maths coach: an octopus who counts on all eight arms and is very pleased about it.
 * Quick, a show-off, fond of a dare; she teases the sum, never the person, and praises the method
 * (making ten, doubling, checking) rather than the learner. Same kinds as LINES, for the runner.
 */
export const MATHS_LINES = {
  correct: [
    'Yes. Eight arms and I could not have done it neater.',
    'Spot on. I would have shown off doing it, but fine.',
    'Correct. I am writing that down. In ink.',
    'That is the one. Tidy working.',
    'Right! One step at a time. Lovely.',
    'Mm. Numbers behaving themselves for once.',
    'Got it. I counted on four arms to check.',
  ],
  wrong: [
    'Not quite. Read the working, then it is yours.',
    'Close. Take it in smaller steps and look again.',
    'Nope, but that is the slip worth making today.',
    'Not this one. I got that wrong for years. Well, minutes.',
    'Hm. The numbers fibbed to you there. Check why.',
    'Not quite. That one comes back at the end, so you get a rematch.',
  ],
  run3: [
    'Three in a row. I may need another arm to keep count.',
    'Three! Bet you can not make it five.',
    'Three in a row. Now you are doing it in your head.',
  ],
  run5: [
    'Five in a row! I am running out of fingers. Which is saying something.',
    'Five! That is steady, careful working.',
    'Five in a row. Fine, I will admit it: that was tidy.',
  ],
  tapped: [
    'Eight arms. Yes, I count on them. No, you may not borrow one.',
    'Tens first. Everything is easier from a ten.',
    'Double, then double again. That is times four, sorted.',
    'Per cent means out of 100. That is all it ever means.',
    'A fraction is just a bar, cut fair and shaded.',
    'I keep a pencil behind my eye. Where else would it go?',
    'Rosa says chess is harder. Rosa is wrong, and has two arms.',
    'Take your time. The numbers are not going anywhere.',
  ],
  complete: [
    'Lesson done. These come back in review, so they stick.',
    'That is the lesson. Short, tidy, done.',
  ],
  perfect: [
    'Every one right first time. Careful working.',
    'Not a single slip. I checked with all eight arms.',
  ],
  fast: [
    'Quick and right, every one. That is mental maths.',
    'Fast, and not a guess among them.',
  ],
  struggled: [
    'Every slip you fixed is one you will spot next time.',
    'You worked those out. That is where the learning happens.',
    'The tricky ones come back in review. That is the plan, not a penalty.',
  ],
  review: [
    'Review done. Those tricks are sticking.',
    'Recall like that is how sums get easy.',
  ],
  relit: ['That review relit your streak. Welcome back to the numbers.'],
};

/** Ada's end-screen headlines, the same kinds as HEADLINES. */
export const MATHS_HEADLINES = {
  complete: [
    'Lesson done. Eight arms up!',
    'And that is a lesson. I would clap, but it takes a while.',
  ],
  perfect: [
    'Flawless. I counted twice to be sure.',
    'Not one slip! I am putting this on the fridge.',
    'Perfect. Even my pencil is impressed.',
  ],
  fast: [
    'Done already? I was still sharpening my pencil.',
    'That was quick. I needed all eight arms to keep up.',
  ],
  struggled: [
    'That took some wrestling, and you came out on top.',
    'Messy in the middle, tidy at the end. That is real working.',
  ],
  review: [
    'Look at that recall. Somebody has been practising.',
    'Remembered! The tricks are moving in to stay.',
  ],
  relit: ['Streak relit! Ink all round.', 'There it is, the streak is glowing again.'],
};

/**
 * The Android home-screen widget and its once-a-day note (src/widget.js picks the pool). Lumi
 * says hello; nothing counts down, nothing is owed, and a day off is just a day.
 */
export const WIDGET_LINES = {
  done: ['Done for today. Nice.', 'That was a good one.', 'All set. Enjoy the rest of the day.'],
  morning: ['Morning. Fancy a lesson?', 'A new day. Pick anything you like.', 'Good morning from Lumi.'],
  day: ['Got a few minutes? I have a puzzle.', 'Lumi is around if you want a lesson.', 'Something small today?'],
  evening: ['A calm few minutes before bed?', 'Evening. One small thing, if you like.', 'Lumi saved you a puzzle.'],
  night: ['Sleep well. See you tomorrow.', 'Lumi is dozing.', 'Rest is good too.'],
  // The once-a-day note, opted into on the ⋯ screen. Posted only on a day with nothing done.
  remind: ['Lumi has a puzzle for you, if you fancy one.', 'A few calm minutes are here when you want them.', 'Something small today? Lumi is around.'],
};
export const REMINDER_WORDS = {
  title: 'Daily note',
  toggle: 'One quiet note in the evening, only on days with nothing done',
};

/**
 * Fennel, the Coding coach: a fennec fox who loves a plan and follows one to the letter, ears
 * first. Earnest, a little proud of his ears, fond of digging. The same kinds as LINES, so the
 * lesson and its end screen read his lines in place of Rosa's (subject `coach.lines`/`headlines`).
 */
export const CODING_LINES = {
  correct: [
    'Exactly right. I did just what the blocks said.',
    'Every step in the right order. Lovely plan.',
    'That works. I can feel it in my ears.',
    "Yes! You read the grid first. That's the trick.",
    'Spot on. You followed every block through.',
  ],
  wrong: [
    'Not quite. I only do what the blocks say, so follow along with me.',
    "Close. Read why, then you'll have it.",
    'Bump! Steps are fussy about order. Look at where I stopped.',
    "That's a useful one to try. Now you can see what the blocks did.",
  ],
  run3: ['Three plans in a row! My ears are tingling.', 'Three in a row. Neat, tidy plans.'],
  run5: ['Five in a row! You think like a programmer: one step at a time.', 'Five! Those plans run like clockwork.'],
  tapped: [
    'Computers are like me: they do the steps exactly, in order. No guessing.',
    'My ears hear sand move. They do not hear what you meant, only what you built.',
    'A loop saves taps. Lazy is good, when it is careful.',
    'I dig for fun. Then I fill the hole back in. Same steps, other way round.',
    'Read a program like a recipe: top to bottom, one line at a time.',
    'Lumi tried to repeat lunch forever. That is called an infinite loop.',
  ],
  complete: ['Lesson done. These come back in review, so they stick.', 'That is the lesson. Plan made, plan run.'],
  perfect: ['Every plan right first time. You followed each step through.', 'Not one bump. You checked every square.'],
  fast: ['Quick and right, every one. You read the grid first.', 'Fast, and every plan reached the flower.'],
  struggled: [
    'Every bump you fixed is a bug you will spot next time.',
    'Finding where a plan goes wrong is most of coding. You did lots of it.',
    'The tricky ones come back in review. That is the plan, not a penalty.',
  ],
  review: ['Review done. Those ideas are sticking.', 'Recall like that is how the ideas settle in.'],
  relit: ['That review relit your streak. Welcome back to the grid.'],
};
export const CODING_HEADLINES = {
  complete: ['Lesson done. The flower thanks you.', 'And that is a lesson. My ears approve.'],
  perfect: ['Flawless! Not a single bump.', 'Every plan perfect. I may frame them.'],
  fast: ['Done already? I had barely started trotting.', 'Zoom! That was a quick little program.'],
  struggled: ['Some bumps, then the flower. That is real coding.', 'You debugged your way through. Proper programmer stuff.'],
  review: ['Look at that recall. The plans are in there.', 'Review done. Steps, loops, ifs: all at home.'],
  relit: ['Streak relit! Ears up.', 'There it is, the streak is glowing again.'],
};
