import { face, limb, shadow, svg } from './kit.js';

/**
 * Rosa, the chess teacher: the park champion, a grandmother who has taught half the street.
 * Silhouette hook: short silver curls on a squat barrel of cardigan. Owned colour: green-grey,
 * a pawn pin.
 */
const SKIN = '#C98E6B';
const HAIR = '#CDD2DC';
const HAIR_SHADE = '#A3AABA';
const CARDIGAN = '#3F5E57';
const CARDIGAN_SHADE = '#304943';
const SHIRT = '#F1E9DA';
const SHOES = '#2B2B33';

// Hand positions per mood: [left, right]. Shoulders are fixed; arms are drawn over the body.
const L = [31, 68], R = [69, 68];
const ARMS = {
  teach:      [[26, 92], [84, 66]],   // right palm up, presenting
  think:      [[26, 92], [58, 59]],   // hand to chin
  correct:    [[18, 46], [82, 46]],   // both up
  wrong:      [[17, 84], [83, 84]],   // open, low: "it's fine"
  struggling: [[26, 92], [90, 56]],   // pointing out to the board
  complete:   [[18, 46], [82, 46]],
  sleepy:     [[44, 88], [56, 88]],   // hands folded
};

export function rosa(mood = 'teach') {
  const [lh, rh] = ARMS[mood] || ARMS.teach;
  const arms = limb(L, lh, CARDIGAN, SKIN, 11) + limb(R, rh, CARDIGAN, SKIN, 11);
  return svg('rosa', mood, `
    ${shadow(27)}
    <g data-part="body">
      <ellipse cx="41" cy="108" rx="7" ry="4" fill="${SHOES}"/><ellipse cx="59" cy="108" rx="7" ry="4" fill="${SHOES}"/>
      <g data-part="head">
        <rect x="25" y="8" width="50" height="40" rx="18" fill="${HAIR_SHADE}"/>
        <circle cx="30" cy="42" r="4" fill="${SKIN}"/><circle cx="70" cy="42" r="4" fill="${SKIN}"/>
        <rect x="31" y="17" width="38" height="46" rx="16" fill="${SKIN}"/>
        <path d="M28 37 Q24 5 50 5 Q76 5 72 37 Q70 25 63 24 Q60 31 53 27 Q47 31 42 27 Q35 26 28 37 Z" fill="${HAIR}"/>
        <circle cx="30" cy="48" r="2" fill="#fff"/><circle cx="70" cy="48" r="2" fill="#fff"/>
        ${face(mood, { cx: 50, cy: 39, skin: SKIN, mouthY: 12, lashes: true })}
      </g>
      <path d="M28 70 Q28 58 50 58 Q72 58 72 70 L77 99 Q77 106 69 106 L31 106 Q23 106 23 99 Z" fill="${CARDIGAN}"/>
      <path d="M61 58.6 Q72 60 72 70 L77 99 Q77 106 69 106 L63 106 Z" fill="${CARDIGAN_SHADE}"/>
      <path d="M41 58 L50 68 L59 58 Z" fill="${SHIRT}"/>
      <g data-part="pin"><circle cx="38" cy="73" r="2.6" fill="#F4E6C8"/><path d="M35.2 79.5 L40.8 79.5 L39.5 74.8 L36.5 74.8 Z" fill="#F4E6C8"/></g>
      <g data-part="arms">${arms}</g>
    </g>`);
}
