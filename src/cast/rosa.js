import { face, limb, shadow, svg } from './kit.js';

/**
 * Rosa, the chess teacher: the park champion, a grandmother who has taught half the street.
 * Silhouette hook: a cloud of silver curls. Owned colour: green-grey cardigan, a pawn pin.
 */
const SKIN = '#C98E6B';
const HAIR = '#D9DCE3';
const HAIR_SHADE = '#B9BFCB';
const CARDIGAN = '#3F5E57';
const CARDIGAN_SHADE = '#34504A';
const SHIRT = '#F1E9DA';
const TROUSERS = '#4A4A58';
const SHOES = '#2B2B33';

// Arm end points per mood: [left hand, right hand]. Shoulders are fixed.
const L = [36, 70], R = [64, 70];
const ARMS = {
  teach:      [[31, 91], [80, 62]],   // right palm up, presenting
  think:      [[31, 91], [57, 63]],   // hand to chin
  correct:    [[25, 50], [75, 50]],   // both up
  wrong:      [[26, 85], [74, 85]],   // open, low: "it's fine"
  struggling: [[31, 91], [86, 55]],   // pointing out to the board
  complete:   [[25, 50], [75, 50]],
  sleepy:     [[40, 88], [60, 88]],   // hands folded
};

// The curls: back layer behind the head, a fringe in front of it.
const BACK = [[29, 33, 9], [33, 21, 10], [45, 14, 11], [58, 14, 11], [69, 22, 10], [73, 34, 9], [26, 45, 6], [75, 46, 6]];
const FRONT = [[37, 20, 7], [49, 16.5, 8], [61, 19, 7]];
const curls = (list, fill) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');

export function rosa(mood = 'teach') {
  const [lh, rh] = ARMS[mood] || ARMS.teach;
  // Hands raised above the shoulders are drawn in front of the body; resting ones behind it.
  const arms = limb(L, lh, CARDIGAN, SKIN) + limb(R, rh, CARDIGAN, SKIN);
  return svg('rosa', mood, `
    ${shadow(26)}
    <g data-part="body">
      ${limb([43, 98], [42, 111], TROUSERS, TROUSERS)}${limb([57, 98], [58, 111], TROUSERS, TROUSERS)}
      <ellipse cx="40" cy="113" rx="6" ry="3.5" fill="${SHOES}"/><ellipse cx="60" cy="113" rx="6" ry="3.5" fill="${SHOES}"/>
      <path d="M34 70 Q36 63 50 63 Q64 63 66 70 L70 98 Q70 104 64 104 L36 104 Q30 104 30 98 Z" fill="${CARDIGAN}"/>
      <path d="M57 64 Q64 64 66 70 L70 98 Q70 104 64 104 L58 104 Z" fill="${CARDIGAN_SHADE}"/>
      <path d="M44 63 L50 79 L56 63 Z" fill="${SHIRT}"/>
      <circle cx="50" cy="86" r="1.6" fill="${SHIRT}"/><circle cx="50" cy="95" r="1.6" fill="${SHIRT}"/>
      <g data-part="pin"><circle cx="40" cy="72" r="2.2" fill="#F4E6C8"/><path d="M37.6 77.5 L42.4 77.5 L41.3 73.6 L38.7 73.6 Z" fill="#F4E6C8"/></g>
      <g data-part="arms">${arms}</g>
      <g data-part="head">
        ${curls(BACK, HAIR_SHADE)}
        <circle cx="26.5" cy="41" r="4" fill="${SKIN}"/><circle cx="73.5" cy="41" r="4" fill="${SKIN}"/>
        <circle cx="50" cy="40" r="24" fill="${SKIN}"/>
        ${curls(FRONT, HAIR)}
        ${face(mood, { cx: 50, cy: 41, skin: SKIN, mouthY: 12 })}
      </g>
    </g>`);
}
