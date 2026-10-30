import { face, limb, rig, shadow, svg } from './kit.js';

/**
 * Clover, the Move coach: a garden rabbit, all spring and stretch. Silhouette hook: two long
 * ears on one chunky mass, plus a cotton tail and big feet. Long round-capped limbs, darker than
 * the body, end in raspberry sweatband hands, so every arm reads at 96 px. Owned colour: fawn
 * and raspberry.
 *
 * Posed with kit.js rig(), as Mira is: a pose moves parts, never redraws them.
 *
 * API (for the practice kit's demo(), which Move and the screen break share):
 *   NAME                       the display name; renaming the character is this one line
 *   MOODS                      ['guide', 'cheer', 'done', 'idle', 'tapped', 'rest']
 *   POSES                      ['squat', 'reach-up', 'side-bend-left', 'side-bend-right',
 *                               'shoulder-roll', 'march', 'lunge', 'wall-push', 'neck-tilt']
 *                              left and right are the learner's, as in a mirror (screen left).
 *   clover(mood, pose?) -> svg string
 *       draw a mood; works with coach(el, clover) like Moss. With `pose`, the limbs hold that
 *       pose (its first phase) and the face keeps the mood: draw this under reduced motion so
 *       the move still shows.
 *   demo(el, pose, seconds, reps = 1) -> Animation[] | null
 *       kit.js rig().demo: from standing to `pose` and back, `reps` times over exactly `seconds`.
 *       Two-sided moves (march, neck-tilt, shoulder-roll, wall-push) pass through both phases
 *       each rep; when it ends the drawn mood shows again. Null under reduced motion.
 */
export const NAME = 'Clover';
export const MOODS = ['guide', 'cheer', 'done', 'idle', 'tapped', 'rest'];

const SKIN = '#C9A27A';
const LIMB = '#A47A50';
const BELLY = '#F4E8D6';
const EAR = '#E8A3A6';
const NOSE = '#D46A78';
const TAIL = '#FBF6EE';
const BAND = '#C2375A';

// Faces in the kit's part settings. Rest is a content pause for breath: eyes closed and smiling.
const FACES = {
  guide:  { eyes: 'open',  lid: 0.2,  brows: [1, 0],    mouth: 'smile' },
  cheer:  { eyes: 'happy',            brows: [3, 0],    mouth: 'open', blush: true },
  done:   { eyes: 'proud',            brows: [1, 0],    mouth: 'big', blush: true },
  idle:   { eyes: 'open',  lid: 0.35, brows: [0, 0],    mouth: 'smile', dx: -1 },
  tapped: { eyes: 'happy',            brows: [3, 0],    mouth: 'open', blush: true },
  rest:   { eyes: 'proud',            brows: [-1, 0],   mouth: 'open', blush: true },
};

// Joints in the 100 x 120 canvas. An arm or leg hangs straight down from its joint and is
// rotated about it: positive turns clockwise, so the left arm lifts outward with +, the right with -.
const J = {
  armL: [33, 57], armR: [67, 57], legL: [41, 88], legR: [59, 88],
  torso: [50, 94], head: [50, 62],
};
const ARM = 29, LEG = 18;

// A pose: per part [rotate, dx, dy, scaleY]; `body` moves the whole upper body (see kit.js rig()).
const STAND = { armL: [16], armR: [-16] };
const ARMS = {
  guide:  { armL: [16], armR: [-64] },          // right hand out, presenting
  cheer:  { armL: [140], armR: [-140] },        // both up, warm
  done:   { armL: [16], armR: [-152] },         // one hand raised
  idle:   STAND,
  tapped: { armL: [54], armR: [-54] },
  rest:   { armL: [-8], armR: [8], body: [0, 2] },   // hands in, a breather
};

// Each pose is a list of phases; a demo rep goes stand -> phases -> stand, each step the same length.
const POSE = {
  'squat': [{ body: [0, 9], armL: [58], armR: [-58], legL: [58, -11, 3], legR: [-58, 11, 3] }],
  'reach-up': [{ body: [0, -3], armL: [162, 0, -8], armR: [-162, 0, -8], head: [0, 0, -1] }],
  'side-bend-left': [{ torso: [-16], body: [2, 0], armL: [10], armR: [-168, 0, -6] }],
  'side-bend-right': [{ torso: [16], body: [-2, 0], armL: [168, 0, -6], armR: [-10] }],
  'shoulder-roll': [
    { armL: [20, 0, -7], armR: [-20, 0, -7], head: [0, 0, 2] },
    { armL: [8, 2, -2], armR: [-8, -2, -2] },
  ],
  'march': [
    { body: [0, -2], legL: [48, -3, -8], armL: [8], armR: [-58] },
    { body: [0, -2], legR: [-48, 3, -8], armL: [58], armR: [-8] },
  ],
  'lunge': [{ body: [-8, 8], armL: [160, 0, -6], armR: [-160, 0, -6], legL: [40, -6, 3], legR: [-56, 0, 2] }],
  'wall-push': [
    // Both hands out to a wall on the right, the far arm from the near shoulder, back leg long.
    { torso: [12], body: [-6, 0], armL: [-100, 24, -8], armR: [-84, -4, 6], legL: [36, -4, 0] },
    { torso: [18], body: [-2, 1], armL: [-108, 24, -8], armR: [-92, -4, 6], legL: [42, -5, 0] },
  ],
  'neck-tilt': [{ head: [-14] }, { head: [14] }],
};
const RIG = rig(J, STAND, POSE);
export const { POSES, demo } = RIG;
const { at } = RIG;

export function clover(mood = 'guide', pose) {
  const m = FACES[mood] ? mood : 'guide';
  const p = RIG.pose(pose, ARMS[m]);
  const arm = ([x, y]) => limb([x, y], [x, y + ARM], LIMB, BAND, 10);
  // A leg ends in a long rabbit foot, toes turned out.
  const leg = ([x, y], side) => limb([x, y], [x, y + LEG], LIMB, LIMB, 11)
    + `<ellipse cx="${x + side * 4}" cy="${y + LEG + 2}" rx="10" ry="5" fill="${LIMB}"/>`;
  const ear = (side) => `<g transform="rotate(${side * 9} ${50 + side * 10} 34)">`
    + `<rect x="${50 + side * 10 - 7}" y="4" width="14" height="34" rx="7" fill="${SKIN}"/>`
    + `<rect x="${50 + side * 10 - 3.5}" y="9" width="7" height="20" rx="3.5" fill="${EAR}"/></g>`;
  return svg(NAME.toLowerCase(), m, `
    ${shadow(30)}
    <g data-part="legs"><g ${at('legL', p)}>${leg(J.legL, -1)}</g><g ${at('legR', p)}>${leg(J.legR, 1)}</g></g>
    <g ${at('body', p)}><g ${at('torso', p)}>
      <circle data-part="tail" cx="76" cy="92" r="8" fill="${TAIL}"/>
      <path d="M50 28 C72 28 77 48 77 70 C77 91 67 99 50 99 C33 99 23 91 23 70 C23 48 28 28 50 28 Z" fill="${SKIN}"/>
      <ellipse cx="50" cy="82" rx="17" ry="14" fill="${BELLY}"/>
      <g ${at('head', p)}>
        <g data-part="ears">${ear(-1)}${ear(1)}</g>
        <ellipse cx="45" cy="56" rx="6" ry="4.5" fill="${BELLY}"/><ellipse cx="56" cy="56" rx="6" ry="4.5" fill="${BELLY}"/>
        ${face(FACES[m], { cx: 50, cy: 42, skin: SKIN, mouthY: 16 })}
        <ellipse cx="50.5" cy="52.5" rx="3.6" ry="2.6" fill="${NOSE}"/>
      </g>
      <g data-part="arms"><g ${at('armL', p)}>${arm(J.armL)}</g><g ${at('armR', p)}>${arm(J.armR)}</g></g>
    </g></g>`).replace('<svg ', `<svg data-pose="${POSE[pose] ? pose : ''}" `);
}

