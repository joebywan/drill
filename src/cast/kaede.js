import { INK, face, limb, rig, shadow, svg } from './kit.js';

/**
 * Kaede, the Japanese coach: a red panda, named for the maple whose leaves match her fur. She has
 * attitude: when something goes well she rears up on her hind legs with both arms high, the red
 * panda's "look how big I am" stance, and she is not above taking credit. Silhouette hook: a
 * wide round head with white-rimmed ears, and a fat ringed tail curling up beside her. Owned
 * colour: maple red with a white face mask.
 *
 * Answers every kit MOOD, so she works with coach(el, kaede) in a Learn lesson. Posed with
 * kit.js rig(), as Mira and Clover are, so a mood is a change of transforms, not a new drawing.
 */
export const NAME = 'Kaede';

const FUR = '#C4502A';
const RING = '#8A3317';
const PALE = '#FBF1E4';
const DARK = '#3A211C';

const J = { armL: [35, 66], armR: [65, 66], legL: [42, 94], legR: [58, 94], torso: [50, 100], head: [50, 64], tail: [64, 98] };
const ARM = 22, LEG = 11;

const STAND = { armL: [18], armR: [-18] };
const ARMS = {
  teach:      { armL: [18], armR: [-72] },                           // paw out, presenting
  think:      { armL: [18], armR: [118], head: [-6], tail: [4] },      // paw to chin
  correct:    { armL: [128], armR: [-128], body: [0, -3], tail: [-8] }, // up on her hind legs, arms high
  wrong:      { armL: [42], armR: [-42], head: [6] },                  // open paws: "eh, it happens"
  struggling: { armL: [18], armR: [-98], head: [-4] },                 // pointing at the card
  complete:   { armL: [140], armR: [-140], body: [0, -4], tail: [-10] },
  sleepy:     { armL: [-12], armR: [12], head: [10, 0, 2], tail: [8] },
};
const RIG = rig(J, STAND, {});
const { at } = RIG;

// The tail: a thick maple stroke with darker rings along the same curve, curling up on her right.
const TAIL = 'M64 98 C86 102 96 84 90 66 C86 54 88 42 80 34';
const tail = `<path d="${TAIL}" fill="none" stroke="${FUR}" stroke-width="15" stroke-linecap="round"/>`
  + `<path d="${TAIL}" fill="none" stroke="${RING}" stroke-width="15" stroke-dasharray="6 9" stroke-dashoffset="-6"/>`;

export function kaede(mood = 'teach') {
  const m = ARMS[mood] ? mood : 'teach';
  const p = RIG.pose(null, ARMS[m]);
  const arm = ([x, y]) => limb([x, y], [x, y + ARM], DARK, DARK, 10);
  const leg = ([x, y], side) => limb([x, y], [x, y + LEG], DARK, DARK, 12) + `<ellipse cx="${x + side * 2}" cy="${y + LEG + 3}" rx="7.5" ry="4" fill="${DARK}"/>`;
  // Wide-set pointed ears, white rimmed with a dark middle.
  const ear = (side) => `<path d="M${50 + side * 10} 30 Q${50 + side * 18} 6 ${50 + side * 30} 10 Q${50 + side * 34} 22 ${50 + side * 30} 38 Z" fill="${PALE}"/>`
    + `<path d="M${50 + side * 15} 29 Q${50 + side * 20} 13 ${50 + side * 27} 15 Q${50 + side * 29} 24 ${50 + side * 26} 34 Z" fill="${DARK}"/>`;
  return svg(NAME.toLowerCase(), m, `
    ${shadow(28)}
    <g data-part="legs"><g ${at('legL', p)}>${leg(J.legL, -1)}</g><g ${at('legR', p)}>${leg(J.legR, 1)}</g></g>
    <g ${at('body', p)}><g ${at('torso', p)}>
      <g ${at('tail', p)}>${tail}</g>
      <path d="M50 58 C68 58 74 74 74 86 C74 100 64 106 50 106 C36 106 26 100 26 86 C26 74 32 58 50 58 Z" fill="${FUR}"/>
      <path d="M50 70 C60 70 63 80 63 90 C63 100 58 104 50 104 C42 104 37 100 37 90 C37 80 40 70 50 70 Z" fill="${DARK}"/>
      <g ${at('head', p)}>
        <g data-part="ears">${ear(-1)}${ear(1)}</g>
        <ellipse cx="50" cy="44" rx="29" ry="23" fill="${FUR}"/>
        <ellipse cx="38" cy="27" rx="7" ry="4.5" fill="${PALE}"/><ellipse cx="62" cy="27" rx="7" ry="4.5" fill="${PALE}"/>
        <path d="M30 50 Q34 60 50 63 Q66 60 70 50 Q64 46 58 52 Q50 48 42 52 Q36 46 30 50 Z" fill="${PALE}"/>
        <path d="M36 46 Q35 52 38 58" stroke="${RING}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M64 46 Q65 52 62 58" stroke="${RING}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <ellipse cx="50" cy="51" rx="4" ry="2.8" fill="${INK}"/>
        ${face(m, { cx: 50, cy: 40, skin: FUR, mouthY: 16 })}
      </g>
      <g data-part="arms"><g ${at('armL', p)}>${arm(J.armL)}</g><g ${at('armR', p)}>${arm(J.armR)}</g></g>
    </g></g>`);
}
