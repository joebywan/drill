import { face, limb, shadow, svg } from './kit.js';

/**
 * Lumi, the guide: a small walking lantern. The light inside is the habit display.
 *
 *   bright   today is done
 *   soft     not yet today (the app flickers it)
 *   ember    after a missed day: warm and low, one lesson rekindles it
 *
 * Lumi never goes dark, and no light state comes with a sad face.
 */
export const LIGHTS = ['bright', 'soft', 'ember'];

const FRAME = '#2E3270';
const FRAME_SHADE = '#262A5E';
const BASE = '#23265A';
const GLASS = { bright: '#FFD978', soft: '#F5A524', ember: '#D98A3A' };
const CORE = { bright: '#FFF1C2', soft: '#FFC861', ember: '#F2A65A' };

export function lumi(mood = 'teach', light = 'soft') {
  if (!GLASS[light]) light = 'soft';
  const glass = GLASS[light];
  const halo = light === 'bright'
    ? `<circle data-part="halo" cx="50" cy="60" r="48" fill="${GLASS.bright}" opacity=".22"/>` : '';
  // The ember sits low in the glass, so the face reads as resting rather than fading.
  const core = light === 'ember'
    ? `<ellipse data-part="core" cx="50" cy="84" rx="15" ry="5" fill="${CORE.ember}"/>`
    : `<ellipse data-part="core" cx="50" cy="62" rx="19" ry="20" fill="${CORE[light]}" opacity=".85"/>`;
  const up = mood === 'correct' || mood === 'complete';
  const arms = up
    ? limb([20, 62], [9, 46], FRAME, FRAME, 9) + limb([80, 62], [91, 46], FRAME, FRAME, 9)
    : mood === 'struggling'
      ? limb([20, 66], [11, 78], FRAME, FRAME, 9) + limb([80, 62], [94, 54], FRAME, FRAME, 9)
      : limb([20, 66], [11, 78], FRAME, FRAME, 9) + limb([80, 66], [89, 78], FRAME, FRAME, 9);
  return svg('lumi', mood, `
    ${halo}
    ${shadow(24)}
    <g data-part="body">
      ${limb([41, 100], [40, 107], FRAME, FRAME, 10)}${limb([59, 100], [60, 107], FRAME, FRAME, 10)}
      <g data-part="arms">${arms}</g>
      <path d="M40 18 Q50 0 60 18" fill="none" stroke="${FRAME}" stroke-width="6" stroke-linecap="round"/>
      <rect x="18" y="26" width="64" height="70" rx="20" fill="${FRAME}"/>
      <path d="M64 26 Q82 26 82 44 L82 78 Q82 96 64 96 Z" fill="${FRAME_SHADE}"/>
      <rect data-part="glass" x="24" y="33" width="52" height="56" rx="15" fill="${glass}"/>
      ${core}
      <rect x="28" y="40" width="4" height="13" rx="2" fill="#fff" opacity=".45"/>
      <!-- the cap and base flare wider than the body: that flare is what says "lantern" -->
      <path d="M12 34 Q14 17 50 15 Q86 17 88 34 Z" fill="${FRAME}"/>
      <rect x="14" y="88" width="72" height="12" rx="6" fill="${BASE}"/>
      ${face(mood, { cx: 50, cy: 57, skin: glass, mouthY: 12 })}
    </g>`);
}
