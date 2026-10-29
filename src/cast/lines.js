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

/** Real help, shown as plain text on the first Calm lesson and after "Not really". */
export const HELP_LINE = "If you're struggling, talk to someone. In Australia, Lifeline is 13 11 14, any time.";
export const HELP_TEL = 'tel:131114';

/** The optional "How do you feel?" answers: [stored value, button label]. Never scored. */
// The stored value reads after "felt" in the habit view: "Breathing · 2 min · felt calmer".
export const FEELS = [['calmer', 'Calmer'], ['about the same', 'About the same'], ['no different', 'Not really']];
