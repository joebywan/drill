import { INK, MOODS as KIT_MOODS, face, limb, rig, shadow, svg } from './kit.js';

/**
 * Fennel, the Coding coach: a fennec fox, the desert's tinkerer, who loves a plan and follows
 * one to the letter. Silhouette hook: two enormous ears, taller than the head, and a bushy
 * dark-tipped tail. Owned colour: sand and terracotta (a little scarf).
 *
 * A teacher like Rosa, so every kit.js mood (teach, think, correct...) works with coach(el, fennel).
 * Posed with kit.js rig(), as Clover and Mira are:
 *   NAME, MOODS (the kit's), POSES ['walk']
 *   fennel(mood, pose?) -> svg string
 *   demo(el, pose, seconds, reps = 1) -> Animation[] | null   steps on the spot; the grid moves him
 */
export const NAME = 'Fennel';
export const MOODS = KIT_MOODS;

const SAND = '#DDA45E';
const LIMB = '#C08442';
const CREAM = '#FBEBD3';
const EAR_IN = '#F0AE9A';
const TIP = '#5B4334';
const SCARF = '#C4553A';

const J = {
  armL: [35, 70], armR: [65, 70], legL: [42, 94], legR: [58, 94],
  torso: [50, 100], head: [50, 64], tail: [64, 98],
};
const ARM = 20, LEG = 11;

const STAND = { armL: [14], armR: [-14] };
const ARMS = {
  teach:      { armL: [14], armR: [-70] },             // right paw out, presenting
  think:      { armL: [14], armR: [-150], head: [-5] }, // paw to chin
  correct:    { armL: [150], armR: [-150], tail: [-10] },
  wrong:      { armL: [40], armR: [-40] },             // open, low: "it's fine"
  struggling: { armL: [14], armR: [-100], tail: [5] }, // pointing out to the grid
  complete:   { armL: [150], armR: [-150], tail: [-10] },
  sleepy:     { armL: [-12], armR: [12], head: [6] },
};
// A trot on the spot: legs and arms swing in turn, the tail flicks and the body bobs.
const POSE = {
  walk: [
    { legL: [22], legR: [-18], armL: [-10], armR: [30], tail: [8], head: [-3], torso: [0, 0, 0, 1.02], body: [0, -2] },
    { legL: [-18], legR: [22], armL: [36], armR: [-6], tail: [-8], head: [3], torso: [0, 0, 0, 0.98], body: [0, 0] },
  ],
};
const RIG = rig(J, STAND, POSE);
export const { POSES, demo } = RIG;
const { at } = RIG;

export function fennel(mood = 'teach', pose) {
  const m = ARMS[mood] ? mood : 'teach';
  const p = RIG.pose(pose, ARMS[m]);
  const arm = ([x, y]) => limb([x, y], [x, y + ARM], LIMB, TIP, 8);
  const leg = ([x, y], side) => limb([x, y], [x, y + LEG], LIMB, LIMB, 10)
    + `<ellipse cx="${x + side * 2}" cy="${y + LEG + 3}" rx="7" ry="4" fill="${TIP}"/>`;
  // The ears: tall, leaning out, pink inside.
  const ear = (s) => `<path d="M${50 + s * 6} 40 L${50 + s * 37} 8 L${50 + s * 26} 50 Z" fill="${SAND}" stroke="${SAND}" stroke-width="4" stroke-linejoin="round"/>`
    + `<path d="M${50 + s * 13} 40 L${50 + s * 32} 16 L${50 + s * 25} 44 Z" fill="${EAR_IN}"/>`;
  return svg(NAME.toLowerCase(), m, `
    ${shadow(26)}
    <g data-part="legs"><g ${at('legL', p)}>${leg(J.legL, -1)}</g><g ${at('legR', p)}>${leg(J.legR, 1)}</g></g>
    <g ${at('body', p)}><g ${at('torso', p)}>
      <g ${at('tail', p)}>
        <path d="M60 98 C84 102 94 86 90 70 C88 62 82 60 80 66 C82 80 74 90 60 92 Z" fill="${SAND}"/>
        <path d="M90 70 C88 62 82 60 80 66 C81 70 82 73 81 76 C85 76 89 74 90 70 Z" fill="${TIP}"/>
      </g>
      <path d="M50 58 C66 58 72 74 72 86 C72 98 64 104 50 104 C36 104 28 98 28 86 C28 74 34 58 50 58 Z" fill="${SAND}"/>
      <ellipse cx="50" cy="90" rx="12" ry="12" fill="${CREAM}"/>
      <path d="M34 66 Q50 76 66 66 L64 72 Q50 81 36 72 Z" fill="${SCARF}"/>
      <g ${at('head', p)}>
        <g data-part="ears">${ear(-1)}${ear(1)}</g>
        <ellipse cx="50" cy="48" rx="22" ry="18" fill="${SAND}"/>
        <path d="M30 50 Q38 66 50 66 Q62 66 70 50 Q62 56 50 56 Q38 56 30 50 Z" fill="${CREAM}"/>
        <ellipse cx="50" cy="55" rx="3.4" ry="2.4" fill="${INK}"/>
        ${face(m, { cx: 50, cy: 45, skin: SAND, mouthY: 14 })}
      </g>
      <g data-part="arms"><g ${at('armL', p)}>${arm(J.armL)}</g><g ${at('armR', p)}>${arm(J.armR)}</g></g>
    </g></g>`).replace('<svg ', `<svg data-pose="${POSE[pose] ? pose : ''}" `);
}
