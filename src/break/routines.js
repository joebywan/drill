/** The screen break as a timeline (see src/practice/timeline.js, which plays it): about 2 minutes. */

/**
 * Each step: { name, line, seconds, pose, loops, how }. `line` is the short cue Clover says; Clover
 * demonstrates `pose` (src/cast/clover.js) `loops` times over the step (not `reps`, which the count
 * would show as reps); `how` is the plain-words guidance behind "How?". The first is 20 seconds
 * of looking far away (the 20-20-20 idea).
 */
export const STEPS = [
  { name: 'Look far away', seconds: 20, pose: 'look-far', loops: 2, line: 'Find something at least 6 metres away and let your eyes rest on it.', how: [
    'Pick something across the room or out a window, at least 6 metres away.',
    'Let your eyes soften on it. No need to stare.',
    'Glasses on is fine, and blink whenever you like.',
  ] },
  { name: 'Slow blinks', seconds: 15, pose: 'blink', loops: 3, line: 'A few slow blinks. Close, hold a moment, open.', how: [
    'Close your eyes gently, like the start of a nap.',
    'Hold them closed for a slow count of two, then open.',
    'No squeezing. Soft lids, easy face.',
  ] },
  { name: 'Shoulder rolls', seconds: 20, pose: 'shoulder-roll', loops: 4, line: 'Roll your shoulders up, back and down. Slow circles.', how: [
    'Lift both shoulders up towards your ears.',
    'Roll them back, then let them drop down.',
    'Arms can hang loose or rest in your lap.',
  ] },
  { name: 'Neck tilts', seconds: 20, pose: 'neck-tilt', loops: 2, line: 'Tilt your head gently towards one shoulder, then the other.', how: [
    'Ear towards your shoulder, keep the shoulders down, only as far as is comfortable.',
    'Pause there for a breath, then come back to the middle.',
    'Then the other side. Small is fine.',
  ] },
  { name: 'Stand and stretch', seconds: 25, pose: 'reach-up', loops: 3, line: 'Stand up if you can, and reach up high. Big bunny stretch.', how: [
    'Stand up with your feet about hip width apart.',
    'Reach both arms up high, as if picking an apple from a tree.',
    'Staying seated works too: reach up from your chair.',
  ] },
  { name: 'Sit tall', seconds: 20, pose: 'sit-tall', loops: 2, line: 'Sit back down tall. Feet flat, shoulders easy, head balanced.', how: [
    'Sit back with your feet flat on the floor.',
    'Let your back grow long, as if a string lifts the top of your head.',
    'Shoulders easy, chin level. Then just breathe.',
  ] },
];
