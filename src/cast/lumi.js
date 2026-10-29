import { INK, face, limb, shadow, svg } from './kit.js';

/**
 * Lumi, the guide: a baby seal who carries a small lantern from lamp to lamp. The lantern's
 * light is the habit display:
 *
 *   bright   today is done
 *   soft     not yet today (the app flickers it)
 *   ember    after a missed day: warm and low, one lesson rekindles it
 *
 * The light never goes out, and no light state comes with a sad face.
 */
export const LIGHTS = ['bright', 'soft', 'ember'];

const SEAL = '#6E82A8';
const SEAL_SHADE = '#5A6D92';
const BELLY = '#E4EAF3';
const MUZZLE = '#C9D3E3';
const FRAME = '#2E3270';
const GLASS = { bright: '#FFD978', soft: '#F5A524', ember: '#D98A3A' };
const CORE = { bright: '#FFF1C2', soft: '#FFC861', ember: '#F2A65A' };

// Flipper tips per mood: [left, right]. The left flipper always holds the lantern.
const L = [25, 62], R = [75, 62];
const ARMS = {
  teach:      [[14, 76], [88, 58]],   // right flipper presenting
  think:      [[14, 76], [64, 70]],   // flipper to chin
  correct:    [[12, 38], [88, 40]],   // lantern held high
  wrong:      [[14, 78], [88, 80]],   // open, low: "it's fine"
  struggling: [[14, 76], [94, 52]],   // pointing out to the board
  complete:   [[12, 38], [88, 40]],
  sleepy:     [[14, 80], [60, 84]],
};

/** The lantern hangs from (x, y): handle, cap, glass, base. */
function lantern(x, y, light) {
  const halo = light === 'bright' ? `<circle data-part="halo" cx="${x}" cy="${y + 14}" r="14" fill="${GLASS.bright}" opacity=".35"/>` : '';
  // The ember sits low in the glass, so it reads as resting rather than fading.
  const core = light === 'ember'
    ? `<ellipse data-part="core" cx="${x}" cy="${y + 18}" rx="4" ry="2" fill="${CORE.ember}"/>`
    : `<ellipse data-part="core" cx="${x}" cy="${y + 13.5}" rx="3.5" ry="4.5" fill="${CORE[light]}"/>`;
  return `<g data-part="lantern">${halo}
    <path d="M${x - 4} ${y + 6} Q${x} ${y - 3} ${x + 4} ${y + 6}" fill="none" stroke="${FRAME}" stroke-width="2.5"/>
    <rect x="${x - 7}" y="${y + 4}" width="14" height="4" rx="2" fill="${FRAME}"/>
    <rect data-part="glass" x="${x - 5.5}" y="${y + 7}" width="11" height="13" rx="3" fill="${GLASS[light]}"/>
    ${core}
    <rect x="${x - 7}" y="${y + 19}" width="14" height="4" rx="2" fill="${FRAME}"/></g>`;
}

export function lumi(mood = 'teach', light = 'soft') {
  if (!GLASS[light]) light = 'soft';
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
      ${lantern(lh[0], lh[1], light)}
      <g data-part="arms">${limb(L, lh, SEAL, SEAL, 12)}${limb(R, rh, SEAL, SEAL, 12)}</g>
    </g>`);
}
