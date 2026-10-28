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
    ? `<circle data-part="halo" cx="50" cy="62" r="46" fill="${GLASS.bright}" opacity=".22"/>` : '';
  // The ember sits low in the glass, so the face reads as resting rather than fading.
  const core = light === 'ember'
    ? `<ellipse data-part="core" cx="50" cy="86" rx="12" ry="5" fill="${CORE.ember}"/>`
    : `<ellipse data-part="core" cx="50" cy="64" rx="15" ry="20" fill="${CORE[light]}" opacity=".85"/>`;
  const up = mood === 'correct' || mood === 'complete';
  const arms = up
    ? limb([25, 64], [14, 50], FRAME, FRAME, 7) + limb([75, 64], [86, 50], FRAME, FRAME, 7)
    : mood === 'struggling'
      ? limb([25, 66], [17, 76], FRAME, FRAME, 7) + limb([75, 64], [90, 56], FRAME, FRAME, 7)
      : limb([25, 66], [17, 76], FRAME, FRAME, 7) + limb([75, 66], [83, 76], FRAME, FRAME, 7);
  return svg('lumi', mood, `
    ${halo}
    ${shadow(22)}
    <g data-part="body">
      ${limb([42, 100], [41, 111], FRAME, FRAME, 7)}${limb([58, 100], [59, 111], FRAME, FRAME, 7)}
      <g data-part="arms">${arms}</g>
      <path d="M41 19 Q50 2 59 19" fill="none" stroke="${FRAME}" stroke-width="5" stroke-linecap="round"/>
      <rect x="26" y="26" width="48" height="72" rx="14" fill="${FRAME}"/>
      <path d="M60 26 Q74 26 74 40 L74 84 Q74 98 60 98 Z" fill="${FRAME_SHADE}"/>
      <rect data-part="glass" x="31" y="32" width="38" height="61" rx="10" fill="${glass}"/>
      ${core}
      <rect x="35" y="37" width="4" height="13" rx="2" fill="#fff" opacity=".45"/>
      <!-- the cap and base flare wider than the body: that flare is what says "lantern" -->
      <path d="M19 32 Q20 18 50 16 Q80 18 81 32 Z" fill="${FRAME}"/>
      <rect x="20" y="92" width="60" height="10" rx="5" fill="${BASE}"/>
      ${face(mood, { cx: 50, cy: 58, skin: glass, mouthY: 13 })}
    </g>`);
}
