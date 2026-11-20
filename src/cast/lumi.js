import { INK, face, limb, shadow, svg } from './kit.js';
import { butterfly } from './butterfly.js';
import { skinOf } from './skins.js';
import { move } from '../feel.js';

/**
 * Lumi, the guide: a baby seal who walks the learner along the street. The habit display
 * (bright, soft, ember) lives on the streak chip and in the widget, not on Lumi.
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

/**
 * Lumi in `mood`, wearing `skin` (an id from skins.js; none or unknown is just Lumi). `colours` are the
 * learner's wing panels, for the butterfly costume's wings. With `perch` (the panels, or true for the icon's), the learner's
 * butterfly rides on her head, on top of a hat (the skin's `perch`, how far up), never with the costume.
 */
export function lumi(mood = 'teach', skin = null, colours = [], perch = null) {
  const [lh, rh] = ARMS[mood] || ARMS.teach;
  const wear = skinOf(skin) ?? {};
  const arm = (shoulder, hand) => limb(shoulder, hand, SEAL, SEAL, 12) + (wear.arm?.(shoulder, hand) ?? '');
  const whisker = (y1, y2) => [-1, 1].map((s) =>
    `<path d="M${50 + s * 12} ${y1} L${50 + s * 22} ${y2}" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`).join('');
  const drawn = svg('lumi', mood, `
    ${shadow(26)}${wear.back?.(colours) ?? ''}
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
        <ellipse cx="50" cy="48.5" rx="4" ry="3" fill="${INK}"/>${wear.head ?? ''}${perch && !wear.back ? perched(perch, wear.perch) : ''}
      </g>
      ${wear.front ?? ''}<g data-part="arms"><g data-arm="left">${arm(L, lh)}</g><g data-arm="right">${arm(R, rh)}</g></g>
    </g>`);
  return wear.id ? drawn.replace('cast-lumi ', `cast-lumi skin-${wear.id} `) : drawn;
}

/**
 * Lumi's flipper-flap, at the wingbeat moment and as her signature on a perfect lesson: both front
 * flippers beat like wings, twice, about her shoulders. Flippers only: Lumi is never drawn with wings.
 * `el` holds her drawing, best in a flippers-up mood ('complete'). Skipped under reduced motion.
 */
export function flap(el) {
  for (const part of el?.querySelectorAll('[data-arm]') ?? []) {
    const left = part.dataset.arm === 'left';
    const [x, y] = left ? L : R;
    part.style.transformOrigin = `${x}px ${y}px`;
    move(part, [0, 1, 0, 1, 0].map((k) => ({ transform: `rotate(${k * (left ? -50 : 50)}deg)` })), { duration: 900, easing: 'ease-in-out' });
  }
}

/** The player's butterfly on her crown, placed as on the app icon (tools/icon.js), `up` higher over a hat; its own parts unnamed so nothing animating Lumi finds them. */
const perched = (filled, up = 0) => `<g data-part="butterfly" transform="translate(26.5 ${-10.4 - up}) scale(.391)">${butterfly(filled === true ? undefined : filled, true, INK).replace(/ data-(part|new)="[^"]*"/g, '')}</g>`;

/** Lumi with the player's butterfly on her crown. */
export const lumiPerched = (mood, filled) => lumi(mood, null, [], filled || true);
