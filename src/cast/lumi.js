import { face, limb, shadow, svg } from './kit.js';

/**
 * Lumi, the guide: a small walking lightbulb. The light inside is the habit display.
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
const GLASS = { bright: '#FFD978', soft: '#F5A524', ember: '#D98A3A' };
const SHADE = { bright: '#F2C658', soft: '#E39418', ember: '#C77B2F' };
const CORE = { bright: '#FFF1C2', soft: '#FFC861', ember: '#F2A65A' };

// The globe: a circle (centre 50,46, r 34) that tapers into the neck of the screw base.
const GLOBE = 'M50 12 A34 34 0 0 1 72 72 Q64 80 63 88 L37 88 Q36 80 28 72 A34 34 0 0 1 50 12 Z';
const GLOBE_SHADE = 'M62 14 A34 34 0 0 1 72 72 Q64 80 63 88 L56 88 Q58 78 65 70 A30 30 0 0 0 62 14 Z';

export function lumi(mood = 'teach', light = 'soft') {
  if (!GLASS[light]) light = 'soft';
  const glass = GLASS[light];
  const halo = light === 'bright'
    ? `<circle data-part="halo" cx="50" cy="48" r="48" fill="${GLASS.bright}" opacity=".22"/>` : '';
  // The ember sits low in the neck, so the face reads as resting rather than fading.
  const core = light === 'ember'
    ? `<ellipse data-part="core" cx="50" cy="78" rx="12" ry="5" fill="${CORE.ember}"/>`
    : `<circle data-part="core" cx="50" cy="44" r="22" fill="${CORE[light]}" opacity=".85"/>`;
  const up = mood === 'correct' || mood === 'complete';
  const arms = up
    ? limb([19, 56], [7, 40], FRAME, FRAME, 9) + limb([81, 56], [93, 40], FRAME, FRAME, 9)
    : mood === 'struggling'
      ? limb([19, 60], [9, 74], FRAME, FRAME, 9) + limb([81, 56], [96, 50], FRAME, FRAME, 9)
      : limb([19, 60], [9, 74], FRAME, FRAME, 9) + limb([81, 60], [91, 74], FRAME, FRAME, 9);
  return svg('lumi', mood, `
    ${halo}
    ${shadow(22)}
    <g data-part="body">
      ${limb([44, 100], [42, 107], FRAME, FRAME, 10)}${limb([56, 100], [58, 107], FRAME, FRAME, 10)}
      <g data-part="arms">${arms}</g>
      <path data-part="glass" d="${GLOBE}" fill="${glass}"/>
      <path d="${GLOBE_SHADE}" fill="${SHADE[light]}"/>
      ${core}
      <ellipse cx="32" cy="30" rx="3.5" ry="8" fill="#fff" opacity=".5" transform="rotate(35 32 30)"/>
      <!-- the screw base: banded, so the bulb reads at any size -->
      <rect x="35" y="86" width="30" height="7" rx="3.5" fill="${FRAME}"/>
      <rect x="37" y="92" width="26" height="6" rx="3" fill="${FRAME_SHADE}"/>
      <rect x="35" y="97" width="30" height="5" rx="2.5" fill="${FRAME}"/>
      ${face(mood, { cx: 50, cy: 44, skin: glass, mouthY: 12 })}
    </g>`);
}
