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
 *                               'shoulder-roll', 'march', 'lunge', 'wall-push', 'neck-tilt',
 *                               seated on a chair: 'neck-turn', 'chest-stretch', 'twist',
 *                               'seated-march', 'ankle-stretch', 'sit-to-stand',
 *                               a hand on a wall: 'heel-raise', 'side-leg-lift', 'one-leg-stand']
 *                              left and right are the learner's, as in a mirror (screen left).
 *   clover(mood, pose?) -> svg string
 *       draw a mood; works with coach(el, clover) like Moss. With `pose`, the limbs hold that
 *       pose (its first phase) and the face keeps the mood: draw this under reduced motion so
 *       the move still shows.
 *   demo(el, pose, seconds, reps = 1) -> Animation[] | null
 *       kit.js rig().demo: from standing (or sitting, or holding the wall) to `pose` and back,
 *       `reps` times over exactly `seconds`. Two-sided moves (march, neck-tilt, shoulder-roll,
 *       wall-push, and most new ones) pass through both phases each rep; when it ends the drawn mood shows again. Null under reduced motion.
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
const WOOD = '#9A6A43';
const WOOD_TOP = '#C99A6B';
const WALL = '#D9CFC1';
const WALL_EDGE = '#A99A86';

// A plain kitchen chair from the front, behind her: two back posts and a rail, the seat's edge, two legs.
const chair = `<rect x="13" y="50" width="6" height="64" rx="3" fill="${WOOD}"/><rect x="81" y="50" width="6" height="64" rx="3" fill="${WOOD}"/>`
  + `<rect x="11" y="48" width="78" height="8" rx="4" fill="${WOOD_TOP}"/><rect x="8" y="94" width="84" height="9" rx="4.5" fill="${WOOD_TOP}"/>`;

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
// The chair and the wall are props, folded flat (scaleY 0) until a seated or balance pose opens one.
// Every part is named here so every pose, in any of the three rigs below, animates the same parts.
const STAND = { armL: [16], armR: [-16], seat: [0, 0, 0, 0], wall: [0, 0, 0, 0], look: [0], head: [0], torso: [0] };
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

// Seated: a chair (the kit's `seat` prop) behind her, her feet dangling short below its seat.
// Every seated move starts and ends sitting, so its demo never stands her up between reps.
// Sitting, she sinks onto the seat's edge and only her shins and feet show below it.
const SIT = { seat: [0, 0, 0, 1], body: [0, 3], legL: [0, 0, 8, 0.6], legR: [0, 0, 8, 0.6], armL: [10], armR: [-10] };
const CROSS = { armL: [-112, 4, 0], armR: [112, -4, 0] }; // hands on the opposite shoulders
const LEAN = { body: [0, 4], head: [0, 0, 3], armL: [30], armR: [-30] };
const SEATED = {
  'neck-turn': [{ look: [0, -6, 0], head: [-5] }, { look: [0, 6, 0], head: [5] }],
  'chest-stretch': [{ armL: [62, 0, -2], armR: [-62, 0, -2], torso: [0, 0, 0, 1.02], head: [0, 0, 1] }],
  'twist': [
    { ...CROSS, torso: [-5], look: [0, -6, 0] },
    { ...CROSS, torso: [5], look: [0, 6, 0] },
  ],
  'seated-march': [
    { legL: [24, -2, -2, 0.6] },
    { legR: [-24, 2, -2, 0.6] },
  ],
  // One leg out straight, the foot up off the floor. The other leg stays down.
  'ankle-stretch': [{ legL: [70, 0, 4, 1.1] }, { legR: [-70, 0, 4, 1.1] }],
  // Lean forward, stand up tall on long legs in front of the chair, lean, sit: the chair stays put behind her.
  'sit-to-stand': [LEAN, { body: [0, -3], legL: [0, 0, -3, 1.2], legR: [0, 0, -3, 1.2], armL: [16], armR: [-16] },
    { body: [0, -3], legL: [0, 0, -3, 1.2], legR: [0, 0, -3, 1.2], armL: [16], armR: [-16] }, LEAN],
};

// Balance: a wall (the `wall` prop) on her right, her right hand resting on it the whole time.
const HOLD = { wall: [0, 0, 0, 1], armL: [16], armR: [-82, -4, -2] };
const BALANCE = {
  // Up onto the toes: she rises while her feet stay down, so her legs grow long under her.
  'heel-raise': [{ body: [0, -4], legL: [0, 0, -4, 1.18], legR: [0, 0, -4, 1.18], armR: [-86, -4, -4] }, { body: [0, -4], legL: [0, 0, -4, 1.18], legR: [0, 0, -4, 1.18], armR: [-86, -4, -4] }],
  'side-leg-lift': [{ legL: [58, 0, -2], body: [1, 0] }, { legR: [-50, 0, -2], body: [-1, 0] }],
  // One foot up off the floor under her, held, then the other: the lifted foot shows clear of the floor.
  'one-leg-stand': [
    { legL: [16, -2, 0, 0.5] }, { legL: [16, -2, 0, 0.5] },
    { legR: [-20, 3, 0, 0.5] }, { legR: [-20, 3, 0, 0.5] },
  ],
};

// One rig per resting position; a pose is demonstrated by the rig that holds it.
const RIGS = [rig(J, STAND, POSE), rig(J, { ...STAND, ...SIT }, SEATED), rig(J, { ...STAND, ...HOLD }, BALANCE)];
const RIG = RIGS[0];
const of = (pose) => RIGS.find((r) => r.POSES.includes(pose)) ?? RIG;
export const POSES = RIGS.flatMap((r) => r.POSES);
/** Whether `pose` is done sitting on the chair (the seated rig). */
export const seated = (pose) => RIGS[1].POSES.includes(pose);
export const demo = (el, pose, ...rest) => of(pose).demo(el, pose, ...rest);
const { at } = RIG;

export function clover(mood = 'guide', pose) {
  const m = FACES[mood] ? mood : 'guide';
  const p = of(pose).pose(pose, ARMS[m]);
  const arm = ([x, y]) => limb([x, y], [x, y + ARM], LIMB, BAND, 10);
  // A leg ends in a long rabbit foot, toes turned out.
  const leg = ([x, y], side) => limb([x, y], [x, y + LEG], LIMB, LIMB, 11)
    + `<ellipse cx="${x + side * 4}" cy="${y + LEG + 2}" rx="10" ry="5" fill="${LIMB}"/>`;
  const ear = (side) => `<g transform="rotate(${side * 9} ${50 + side * 10} 34)">`
    + `<rect x="${50 + side * 10 - 7}" y="4" width="14" height="34" rx="7" fill="${SKIN}"/>`
    + `<rect x="${50 + side * 10 - 3.5}" y="9" width="7" height="20" rx="3.5" fill="${EAR}"/></g>`;
  return svg(NAME.toLowerCase(), m, `
    ${shadow(30)}
    <g ${at('wall', p)}><rect x="88" y="0" width="14" height="114" fill="${WALL}"/><rect x="86" y="0" width="3" height="114" fill="${WALL_EDGE}"/></g>
    <g ${at('seat', p)}>${chair}</g>
    <g data-part="legs"><g ${at('legL', p)}>${leg(J.legL, -1)}</g><g ${at('legR', p)}>${leg(J.legR, 1)}</g></g>
    <g ${at('body', p)}><g ${at('torso', p)}>
      <circle data-part="tail" cx="76" cy="92" r="8" fill="${TAIL}"/>
      <path d="M50 28 C72 28 77 48 77 70 C77 91 67 99 50 99 C33 99 23 91 23 70 C23 48 28 28 50 28 Z" fill="${SKIN}"/>
      <ellipse cx="50" cy="82" rx="17" ry="14" fill="${BELLY}"/>
      <g ${at('head', p)}>
        <g data-part="ears">${ear(-1)}${ear(1)}</g>
        <g ${at('look', p)}>
        <ellipse cx="45" cy="56" rx="6" ry="4.5" fill="${BELLY}"/><ellipse cx="56" cy="56" rx="6" ry="4.5" fill="${BELLY}"/>
        ${face(FACES[m], { cx: 50, cy: 42, skin: SKIN, mouthY: 16 })}
        <ellipse cx="50.5" cy="52.5" rx="3.6" ry="2.6" fill="${NOSE}"/>
        </g>
      </g>
      <g data-part="arms"><g ${at('armL', p)}>${arm(J.armL)}</g><g ${at('armR', p)}>${arm(J.armR)}</g></g>
    </g></g>`).replace('<svg ', `<svg data-pose="${POSES.includes(pose) ? pose : ''}" `);
}

