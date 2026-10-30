import { INK, face, limb, rig, shadow, svg } from './kit.js';

/**
 * Mira, the screen break coach: a ring-tailed lemur, the one who sits in the sun and gazes into
 * the trees. The hook is her eyes: big round amber eyes in a dark mask on a pale face, because the
 * break is about resting yours. Silhouette hook: the long black-and-white ringed tail curling up
 * beside her. Owned colour: ash grey and amber.
 *
 * Posed with kit.js rig(), as Clover is. The API matches Clover's, for the practice kit's demo():
 *   NAME                       the display name; renaming the character is this one line
 *   MOODS                      ['guide', 'cheer', 'done', 'idle', 'tapped', 'rest']
 *   POSES                      ['look-far', 'blink', 'shoulder-roll', 'neck-tilt', 'reach-up',
 *                               'sit-tall']; left and right are the learner's, as in a mirror.
 *   mira(mood, pose?) -> svg string
 *       draw a mood; works with coach(el, mira). With `pose`, she holds that pose (its first
 *       phase) and the face keeps the mood: draw this under reduced motion so the move still shows.
 *   demo(el, pose, seconds, reps = 1) -> Animation[] | null
 *       kit.js rig().demo: from standing to `pose` and back, `reps` times over exactly `seconds`.
 */
export const NAME = 'Mira';
export const MOODS = ['guide', 'cheer', 'done', 'idle', 'tapped', 'rest'];

const FUR = '#A8A4A6';
const LIMB = '#7C777B';
const PALE = '#F3F0EA';
const MASK = '#36303A';
const HAND = '#2B262E';
const AMBER = '#F2A31B';
const WOOD = '#9A6A43';
const WOOD_TOP = '#C99A6B';

// Faces in the kit's part settings, with her own eyes (size, iris, line in mira()).
const FACES = {
  guide:  { eyes: 'open',  lid: 0,    brows: [1, 0],    mouth: 'smile' },
  cheer:  { eyes: 'happy',            brows: [3, 0],    mouth: 'open', blush: true },
  done:   { eyes: 'proud',            brows: [1, 0],    mouth: 'big', blush: true },
  idle:   { eyes: 'open',  lid: 0,    brows: [0, 0],    mouth: 'smile', dx: -2, dy: 1 },
  tapped: { eyes: 'open',  lid: 0,    brows: [3, 0],    mouth: 'open', blush: true },
  rest:   { eyes: 'proud',            brows: [-1, 0],   mouth: 'smile', blush: true },
};

// Joints in the 100 x 120 canvas (see kit.js rig()). The tail turns about its root and the seat,
// a stump drawn at scaleY 0, grows up from the floor when she sits.
const J = {
  armL: [34, 60], armR: [66, 60], legL: [41, 90], legR: [59, 90],
  torso: [50, 96], head: [50, 62], tail: [66, 94], seat: [50, 112],
};
const ARM = 27, LEG = 16;

const STAND = { armL: [16], armR: [-16] };
const ARMS = {
  guide:  { armL: [16], armR: [-64] },          // right hand out, presenting
  cheer:  { armL: [140], armR: [-140], tail: [-6] },
  done:   { armL: [16], armR: [-152] },         // one hand raised
  idle:   { ...STAND, tail: [4] },
  tapped: { armL: [54], armR: [-54], tail: [-8] },
  rest:   { armL: [-8], armR: [8], body: [0, 2] },
};

// The paw goes up and out, never across the face, and rests above the brow the whole time she
// looks away into the distance; her gaze drifts further on the held phases.
const SHADE = { head: [-8, -3, -2], eyes: [0, -2, -1], armR: [-198, 4, -16], tail: [6] };
const CLOSED = { head: [0, 0, 1], eyes: [0, 0, 0, 0.05], lids: [0, 0, 0, 1], tail: [-5] };
// Sitting: a log comes up, the body drops onto it and the legs dangle short in front.
const SIT = { seat: [0, 0, 0, 1], body: [0, 6], legL: [0, 0, 8, 0.6], legR: [0, 0, 8, 0.6] };
const TALL = { ...SIT, torso: [0, 0, -2, 1.04], head: [0, 0, -2], armL: [6], armR: [-6] };
const POSE = {
  'look-far': [...Array(3).fill(SHADE), ...Array(4).fill({ ...SHADE, eyes: [0, -4, -2] })],
  'blink': [CLOSED, CLOSED, CLOSED, {}, {}],
  'shoulder-roll': [
    { armL: [20, 0, -7], armR: [-20, 0, -7], head: [0, 0, 2] },
    { armL: [8, 2, -2], armR: [-8, -2, -2] },
  ],
  'neck-tilt': [{ head: [-14], tail: [6] }, { head: [14], tail: [-6] }],
  'reach-up': [{ body: [0, -3], armL: [162, 0, -8], armR: [-162, 0, -8], head: [0, 0, -1], tail: [-8] }],
  // Sits tall, sags into a slouch, then visibly straightens up through the crown and holds.
  // Tall comes first so the still drawing (reduced motion) is the goal, not the slouch.
  'sit-tall': [
    TALL,
    { ...SIT, torso: [0, 0, 0, 0.86], head: [0, 0, 6], armL: [-6, 3, 3], armR: [6, -3, 3], tail: [5] },
    TALL, TALL,
  ],
};
const RIG = rig(J, STAND, POSE);
export const { POSES, demo } = RIG;
const { at } = RIG;

// The ringed tail: pale, then dark rings over it along the same curve, ending in a dark tip.
const TAIL = 'M66 94 C88 96 96 78 90 60 C85 44 90 26 82 12';
const tail = `<path d="${TAIL}" fill="none" stroke="${PALE}" stroke-width="10" stroke-linecap="round"/>`
  + `<path d="${TAIL}" fill="none" stroke="${HAND}" stroke-width="10" stroke-dasharray="7 7" stroke-dashoffset="-4"/>`
  + `<circle cx="82" cy="12" r="5" fill="${HAND}"/>`;

export function mira(mood = 'guide', pose) {
  const m = FACES[mood] ? mood : 'guide';
  const p = RIG.pose(pose, ARMS[m]);
  const arm = ([x, y]) => limb([x, y], [x, y + ARM], LIMB, HAND, 9);
  const leg = ([x, y], side) => limb([x, y], [x, y + LEG], LIMB, LIMB, 11)
    + `<ellipse cx="${x + side * 3}" cy="${y + LEG + 2}" rx="8" ry="4.5" fill="${HAND}"/>`;
  // Pointed ears, pale tufted inside.
  const ear = (side) => `<path d="M${50 + side * 12} 30 L${50 + side * 25} 12 L${50 + side * 26} 34 Z" fill="${FUR}"/>`
    + `<path d="M${50 + side * 15} 29 L${50 + side * 23} 18 L${50 + side * 23.5} 31 Z" fill="${PALE}"/>`;
  // A dark teardrop round each eye, leaning in towards the muzzle, with pale fur between them.
  const patch = (side) => `<ellipse cx="${50 + side * 11.5}" cy="42" rx="10.5" ry="13" transform="rotate(${side * 28} ${50 + side * 11.5} 42)" fill="${MASK}"/>`;
  const lid = (x) => `<ellipse cx="${x}" cy="40" rx="9" ry="10" fill="${MASK}"/>`
    + `<path d="M${x - 7} 41 Q${x} 42.5 ${x + 7} 41" fill="none" stroke="${PALE}" stroke-width="2.4" stroke-linecap="round"/>`
    + [-4, 0, 4].map((d) => `<path d="M${x + d} 42 L${x + d * 1.3} 45" stroke="${PALE}" stroke-width="1.6" stroke-linecap="round"/>`).join('');
  return svg(NAME.toLowerCase(), m, `
    ${shadow(30)}
    <g ${at('seat', p)}><rect x="10" y="96" width="80" height="16" rx="8" fill="${WOOD}"/><ellipse cx="18" cy="104" rx="6" ry="7.5" fill="${WOOD_TOP}"/><ellipse cx="18" cy="104" rx="2.5" ry="3" fill="${WOOD}"/></g>
    <g data-part="legs"><g ${at('legL', p)}>${leg(J.legL, -1)}</g><g ${at('legR', p)}>${leg(J.legR, 1)}</g></g>
    <g ${at('body', p)}><g ${at('torso', p)}>
      <g ${at('tail', p)}>${tail}</g>
      <path d="M50 24 C70 24 76 46 76 70 C76 92 67 101 50 101 C33 101 24 92 24 70 C24 46 30 24 50 24 Z" fill="${FUR}"/>
      <ellipse cx="50" cy="84" rx="16" ry="14" fill="${PALE}"/>
      <g ${at('head', p)}>
        <g data-part="ears">${ear(-1)}${ear(1)}</g>
        <path d="M50 24 C66 24 72 34 72 44 C72 56 60 66 50 66 C40 66 28 56 28 44 C28 34 34 24 50 24 Z" fill="${PALE}"/>
        ${patch(-1)}${patch(1)}
        <path d="M47 44 L53 44 L54 56 Q50 58.5 46 56 Z" fill="${MASK}"/>
        <ellipse cx="50" cy="55.5" rx="3.6" ry="2.4" fill="${INK}"/>
        ${face(FACES[m], { cx: 50, cy: 40, skin: MASK, mouthY: 20, size: 1.35, iris: AMBER, line: AMBER })
          .replace('data-part="eyes"', at('eyes', p))}
        <g ${at('lids', p)}>${lid(39)}${lid(61)}</g>
      </g>
      <g data-part="arms"><g ${at('armL', p)}>${arm(J.armL)}</g><g ${at('armR', p)}>${arm(J.armR)}</g></g>
    </g></g>`).replace('<svg ', `<svg data-pose="${POSE[pose] ? pose : ''}" `);
}
