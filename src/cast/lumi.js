import { INK, face, limb, shadow, svg } from './kit.js';

/**
 * Lumi, the guide: a baby seal who walks the learner along the street. The habit display
 * (bright, soft, ember) lives on the lamps of the home path and in the widget, not on Lumi.
 */
const SEAL = '#6E82A8';
const SEAL_SHADE = '#5A6D92';
const BELLY = '#E4EAF3';
const MUZZLE = '#C9D3E3';

// Flipper tips per mood: [left, right].
const L = [25, 62], R = [75, 62];
const ARMS = {
  teach:      [[14, 76], [88, 58]],   // right flipper presenting
  think:      [[14, 76], [64, 70]],   // flipper to chin
  correct:    [[12, 40], [88, 40]],   // both up
  wrong:      [[14, 78], [88, 80]],   // open, low: "it's fine"
  struggling: [[14, 76], [94, 52]],   // pointing out to the board
  complete:   [[12, 40], [88, 40]],
  sleepy:     [[14, 80], [60, 84]],
};

export function lumi(mood = 'teach') {
  const [lh, rh] = ARMS[mood] || ARMS.teach;
  const whisker = (y1, y2) => [-1, 1].map((s) =>
    `<path d="M${50 + s * 12} ${y1} L${50 + s * 22} ${y2}" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`).join('');
  return svg('lumi', mood, `
    ${shadow(26)}
    <g data-part="body">
      <ellipse cx="35" cy="105" rx="11" ry="5" fill="${SEAL_SHADE}" transform="rotate(-18 35 105)"/>
      <ellipse cx="65" cy="105" rx="11" ry="5" fill="${SEAL_SHADE}" transform="rotate(18 65 105)"/>
      <path d="M50 14 C74 14 82 36 82 60 C82 86 72 104 50 104 C28 104 18 86 18 60 C18 36 26 14 50 14 Z" fill="${SEAL}"/>
      <path d="M62 16 C76 22 82 40 82 60 C82 86 72 104 50 104 C64 96 70 80 70 60 C70 40 68 26 62 16 Z" fill="${SEAL_SHADE}"/>
      <ellipse cx="50" cy="84" rx="22" ry="18" fill="${BELLY}"/>
      <g data-part="head">
        <ellipse cx="44" cy="53" rx="7" ry="5" fill="${MUZZLE}"/><ellipse cx="56" cy="53" rx="7" ry="5" fill="${MUZZLE}"/>
        ${whisker(52, 50)}${whisker(55, 57)}
        ${face(mood, { cx: 50, cy: 39, skin: SEAL, mouthY: 20 })}
        <ellipse cx="50" cy="48.5" rx="4" ry="3" fill="${INK}"/>
      </g>
      <g data-part="arms">${limb(L, lh, SEAL, SEAL, 12)}${limb(R, rh, SEAL, SEAL, 12)}</g>
    </g>`);
}
