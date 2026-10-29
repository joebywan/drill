/**
 * Everything the cast says, in one place so the guardrail tests can lint it. Lines praise the
 * process, never ability, and never mention absence or loss.
 */
export const LINES = {
  correct: ['Well spotted.', "That's it.", 'Exactly right.', 'Nicely found.', 'Good. You checked every target.'],
  wrong: ['Not quite.', 'Close, but not this one.', 'Not this time.'],
  run3: ["Three in a row. You're reading the board."],
  run5: ["Five in a row! That's patient work."],
  tapped: [
    'Take your time. The board will wait.',
    'Chess is patterns. You are collecting them.',
    'My grandson still has not beaten me. He is getting closer.',
    'Before every move, ask: what does it attack?',
  ],
  complete: [
    'Lesson done. These come back in review, so they stick.',
    'That is the lesson. Every miss you fixed is one you will spot next time.',
  ],
  perfect: ["Every one right first time. That's careful play."],
  review: ['Review done. Those patterns are sticking.'],
};

/** A line of the given kind; `pick` in [0, 1) chooses which. */
export const line = (kind, pick = Math.random()) => LINES[kind][Math.floor(pick * LINES[kind].length)];
