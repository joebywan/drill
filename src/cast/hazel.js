import { INK, face, limb, rig, shadow, svg } from './kit.js';

/**
 * Hazel, the Focus coach: a beaver, who builds steadily, one stick at a time. Silhouette hooks: the
 * flat paddle tail behind her and two big buck teeth under a dark nose. While a session runs she
 * holds a stick and looks down at it, quietly busy. Owned colour: chestnut and cream.
 *
 * Posed with kit.js rig(), as Clover and Mira are. The same API:
 *   NAME                       the display name; renaming the character is this one line
 *   MOODS                      ['guide', 'focus', 'done', 'idle', 'tapped', 'rest']
 *   POSES                      ['gnaw', 'build']
 *   hazel(mood, pose?) -> svg string
 *   demo(el, pose, seconds, reps = 1) -> Animation[] | null
 */
export const NAME = 'Hazel';
export const MOODS = ['guide', 'focus', 'done', 'idle', 'tapped', 'rest'];

const FUR = '#9A6038';
const LIMB = '#74462A';
const BELLY = '#E3C29A';
const PAW = '#4E2F1D';
const TAIL = '#4A3426';
const TAIL_LINE = '#65493A';
const TOOTH = '#FFF1CF';
const WOOD = '#B0844F';
const WOOD_END = '#E0C08F';
const LEAF = '#5FA35A';

const FACES = {
  guide:  { eyes: 'open',  lid: 0.2,  brows: [1, 0],    mouth: 'smile' },
  focus:  { eyes: 'open',  lid: 0.3,  brows: [1, 0],    mouth: 'smile', dy: 3 },
  done:   { eyes: 'proud',            brows: [1, 0],    mouth: 'big', blush: true },
  idle:   { eyes: 'open',  lid: 0.3,  brows: [0, 0],    mouth: 'smile', dx: -2 },
  tapped: { eyes: 'happy',            brows: [3, 0],    mouth: 'open', blush: true },
  rest:   { eyes: 'proud',            brows: [-1, 0],   mouth: 'smile', blush: true },
};

// Joints in the 100 x 120 canvas (see kit.js rig()). The stick has no joint: it turns about its
// own centre, and stands at scaleY 0 (put away) until a mood or pose picks it up.
const J = {
  armL: [33, 60], armR: [67, 60], legL: [41, 90], legR: [59, 90],
  torso: [50, 96], head: [50, 62], tail: [64, 96],
};
const ARM = 27, LEG = 15;

const STAND = { armL: [16], armR: [-16], stick: [0, 0, 0, 0] };
// Holding the stick across her tummy, both paws on it.
const HOLD = { armL: [-30], armR: [30], stick: [0, 0, 0, 1] };
const ARMS = {
  guide:  { armL: [16], armR: [-64] },          // right paw out, presenting
  focus:  HOLD,
  done:   { armL: [16], armR: [-152] },         // one paw raised
  idle:   { ...STAND, tail: [4] },
  tapped: { armL: [54], armR: [-54], tail: [-8] },
  rest:   { armL: [-8], armR: [8], body: [0, 2] },
};

const POSE = {
  // The stick comes up to her teeth and she nibbles along it, tail tapping.
  'gnaw': [
    { armL: [-55, 0, -12], armR: [55, 0, -12], stick: [0, 0, -20, 1], head: [0, 0, 3], tail: [6] },
    { armL: [-55, 0, -14], armR: [55, 0, -14], stick: [0, 0, -22, 1], head: [0, 0, 1], tail: [-4] },
  ],
  // Up over her head and onto the dam.
  'build': [{ body: [0, -3], torso: [0, 0, -1, 1.03], armL: [165, 0, -4], armR: [-165, 0, -4], stick: [0, 0, -53, 1], tail: [-6] }],
};
const RIG = rig(J, STAND, POSE);
export const { POSES, demo } = RIG;
const { at } = RIG;

// The paddle tail, with its criss-cross scales.
const tail = `<ellipse cx="78" cy="98" rx="10" ry="18" transform="rotate(-55 78 98)" fill="${TAIL}"/>`
  + [[-6, 0], [0, 0], [6, 0]].map(([d]) => `<path d="M${70 + d} ${92 + d * 0.6} L${86 + d} ${103 + d * 0.6}" stroke="${TAIL_LINE}" stroke-width="1.4" stroke-linecap="round"/>`).join('')
  + [[-6], [0], [6]].map(([d]) => `<path d="M${74 + d} ${108 - d * 0.2} L${82 + d} ${89 - d * 0.2}" stroke="${TAIL_LINE}" stroke-width="1.4" stroke-linecap="round"/>`).join('');

const stick = `<rect x="26" y="80.5" width="48" height="5" rx="2.5" fill="${WOOD}"/>`
  + `<ellipse cx="73" cy="83" rx="1.8" ry="2.5" fill="${WOOD_END}"/>`
  + `<path d="M30 81 Q26 74 31 70 Q34 75 30 81Z" fill="${LEAF}"/>`;

export function hazel(mood = 'guide', pose) {
  const m = FACES[mood] ? mood : 'guide';
  const p = RIG.pose(pose, ARMS[m]);
  const arm = ([x, y]) => limb([x, y], [x, y + ARM], LIMB, PAW, 9);
  const leg = ([x, y], side) => limb([x, y], [x, y + LEG], LIMB, LIMB, 11)
    + `<ellipse cx="${x + side * 3}" cy="${y + LEG + 3}" rx="9" ry="4.5" fill="${PAW}"/>`;
  const ear = (side) => `<circle cx="${50 + side * 19}" cy="28" r="6.5" fill="${FUR}"/><circle cx="${50 + side * 19}" cy="28.5" r="3.2" fill="${LIMB}"/>`;
  return svg(NAME.toLowerCase(), m, `
    ${shadow(30)}
    <g data-part="legs"><g ${at('legL', p)}>${leg(J.legL, -1)}</g><g ${at('legR', p)}>${leg(J.legR, 1)}</g></g>
    <g ${at('body', p)}><g ${at('torso', p)}>
      <g ${at('tail', p)}>${tail}</g>
      <path d="M50 24 C72 24 77 46 77 70 C77 92 67 101 50 101 C33 101 23 92 23 70 C23 46 28 24 50 24 Z" fill="${FUR}"/>
      <ellipse cx="50" cy="83" rx="17" ry="15" fill="${BELLY}"/>
      <g ${at('head', p)}>
        <g data-part="ears">${ear(-1)}${ear(1)}</g>
        <ellipse cx="44" cy="53" rx="7.5" ry="5.5" fill="${BELLY}"/><ellipse cx="56" cy="53" rx="7.5" ry="5.5" fill="${BELLY}"/>
        ${face(FACES[m], { cx: 50, cy: 40, skin: FUR, mouthY: 15 })}
        <path d="M46.5 55 H53.5 V62 Q53.5 63 52.5 63 H47.5 Q46.5 63 46.5 62Z" fill="${TOOTH}"/>
        <path d="M50 55 V63" stroke="#D8C49A" stroke-width="1"/>
        <ellipse cx="50" cy="50" rx="4.2" ry="3" fill="${INK}"/>
      </g>
      <g ${at('stick', p)}>${stick}</g>
      <g data-part="arms"><g ${at('armL', p)}>${arm(J.armL)}</g><g ${at('armR', p)}>${arm(J.armR)}</g></g>
    </g></g>`).replace('<svg ', `<svg data-pose="${POSE[pose] ? pose : ''}" `);
}
