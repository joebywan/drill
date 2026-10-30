import { INK, face, limb, shadow, svg } from './kit.js';
import { move } from '../feel.js';

/**
 * Moss, the Calm coach: a capybara, the unhurried animal that lets birds sit on its head. One
 * round barrel of a body, so a breath shows. Silhouette hook: a leaf resting on its head.
 * Owned colour: warm brown with a moss-green leaf.
 *
 * API (for the Calm practice engine):
 *   NAME                       the display name; renaming the character is this one line
 *   MOODS                      ['guide', 'inhale', 'hold', 'exhale', 'notice', 'done', 'idle', 'tapped', 'hug']
 *   moss(mood) -> svg string   draw a mood; works with coach(el, moss) like Rosa and Lumi
 *   breathe(el, phase, seconds) -> Animation | null
 *       phase 'in' | 'hold' | 'out' | 'top' | 'sigh'. Swells ('in'), holds full ('hold') or settles ('out') the
 *       body; for the double-inhale sigh, 'top' swells a little past full and 'sigh' settles from there. The
 *       body of the character inside `el` (the svg or its container) over exactly `seconds`.
 *       Keyframes are absolute, so it is safe to call right after a redraw. Returns null under
 *       reduced motion; the inhale and hold drawings are already swelled, so set the matching
 *       mood each phase and the breath still reads. Keep your own clock: don't time phases by
 *       the returned animation, which is null when motion is off.
 *   tap(el, side) -> Animation | null
 *       side 'left' | 'right'. In the 'hug' pose, that paw pats its shoulder once (about half a
 *       second). Null under reduced motion; the words say which side.
 */
export const NAME = 'Moss';
export const MOODS = ['guide', 'inhale', 'hold', 'exhale', 'notice', 'done', 'idle', 'tapped', 'hug'];

const FUR = '#9C6B48';
const FUR_SHADE = '#835736';
const MUZZLE = '#D9B48E';
const BELLY = '#E9D3B4';
const LEAF = '#6FA86A';
const LEAF_VEIN = '#4E8049';

// Faces in the kit's part settings. Nothing here is sad or worried: lids lower to rest, not to sulk.
const FACES = {
  guide:  { eyes: 'open',  lid: 0.3,  brows: [0, 0],     mouth: 'soft' },
  inhale: { eyes: 'open',  lid: 0.1,  brows: [2, 0],     mouth: 'soft', dy: -2 },
  hold:   { eyes: 'open',  lid: 0.25, brows: [1, 0],     mouth: 'flat', dy: -1 },
  exhale: { eyes: 'open',  lid: 0.6,  brows: [-1, 0],    mouth: 'o', dy: 1 },
  notice: { eyes: 'open',  lid: 0,    brows: [1, 0, 4],  mouth: 'o', dx: 2, dy: -1 },
  done:   { eyes: 'proud',            brows: [0, 0],     mouth: 'smile', blush: true },
  idle:   { eyes: 'open',  lid: 0.4,  brows: [0, 0],     mouth: 'smile', dx: -1 },
  tapped: { eyes: 'happy',            brows: [3, 0],     mouth: 'open', blush: true },
  hug:    { eyes: 'open',  lid: 0.55, brows: [0, 0],     mouth: 'smile' },
};

// Paw tips per mood: [left, right]. Short arms; they rise with the breath and fall with it.
const L = [25, 68], R = [75, 68];
const ARMS = {
  guide:  [[20, 88], [80, 88]],
  inhale: [[13, 60], [87, 60]],
  hold:   [[15, 64], [85, 64]],
  exhale: [[24, 92], [76, 92]],
  notice: [[20, 88], [93, 56]],   // paw out: "what can you see?"
  done:   [[42, 84], [58, 84]],   // paws folded on the belly
  idle:   [[21, 90], [79, 90]],
  tapped: [[14, 58], [86, 58]],
  hug:    [[67, 78], [33, 78]],   // arms crossed over the chest: the butterfly hug
};

// The breath: a swell from the feet. FULL as an svg attribute (static drawings) and as CSS (breathe).
const FULL_ATTR = 'translate(50 110) scale(1.06 1.05) translate(-50 -110)';
const REST = 'scale(1, 1)', FULL = 'scale(1.06, 1.05)', TOP = 'scale(1.09, 1.07)';
const SWELLED = new Set(['inhale', 'hold']);

export function moss(mood = 'guide') {
  const f = FACES[mood] ? mood : 'guide';
  const [lh, rh] = ARMS[f];
  const arm = f === 'hug' ? FUR_SHADE : FUR; // crossed arms in shade, so they read against the chest
  return svg(NAME.toLowerCase(), f, `
    ${shadow(28)}
    <g data-part="body"${SWELLED.has(f) ? ` transform="${FULL_ATTR}"` : ''}>
      <ellipse cx="38" cy="106" rx="9" ry="4.5" fill="${FUR_SHADE}"/><ellipse cx="62" cy="106" rx="9" ry="4.5" fill="${FUR_SHADE}"/>
      <path d="M50 16 C76 16 84 36 84 64 C84 92 74 108 50 108 C26 108 16 92 16 64 C16 36 24 16 50 16 Z" fill="${FUR}"/>
      <path d="M63 18 C78 24 84 42 84 64 C84 92 74 108 50 108 C65 100 72 84 72 64 C72 42 69 28 63 18 Z" fill="${FUR_SHADE}"/>
      <ellipse cx="50" cy="88" rx="22" ry="16" fill="${BELLY}"/>
      <g data-part="head">
        <circle cx="27" cy="23" r="4.5" fill="${FUR_SHADE}"/><circle cx="73" cy="23" r="4.5" fill="${FUR_SHADE}"/>
        <g data-part="leaf"><path d="M44 15 Q50 1 63 6 Q58 18 44 15 Z" fill="${LEAF}"/><path d="M45 14 Q53 9 60 7" stroke="${LEAF_VEIN}" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>
        <rect x="29" y="43" width="42" height="24" rx="11" fill="${MUZZLE}"/>
        <ellipse cx="43" cy="49" rx="2.6" ry="1.8" fill="${INK}"/><ellipse cx="57" cy="49" rx="2.6" ry="1.8" fill="${INK}"/>
        ${face(FACES[f], { cx: 50, cy: 33, skin: FUR, mouthY: 25 })}
      </g>
      <g data-part="arms"><g data-arm="left">${limb(L, lh, arm, arm, 11)}</g><g data-arm="right">${limb(R, rh, arm, arm, 11)}</g></g>
    </g>`);
}

const PHASES = { in: [REST, FULL], hold: [FULL, FULL], out: [FULL, REST], top: [FULL, TOP], sigh: [TOP, REST] };

export function breathe(el, phase, seconds) {
  const body = el?.querySelector('[data-part="body"]');
  if (!body || !PHASES[phase]) return null;
  Object.assign(body.style, { transformBox: 'fill-box', transformOrigin: '50% 100%' });
  const [from, to] = PHASES[phase];
  return move(body, [{ transform: from }, { transform: to }],
    { duration: seconds * 1000, easing: 'ease-in-out', fill: 'forwards' });
}

export function tap(el, side) {
  return move(el?.querySelector(`[data-arm="${side}"]`), [
    { transform: 'translate(0, 0)' }, { transform: 'translate(0, 3px)' }, { transform: 'translate(0, 0)' },
  ], { duration: 450, easing: 'ease-in-out' });
}
