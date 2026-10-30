import { face, rig, shadow, svg } from './kit.js';

/**
 * Ada, the maths coach: an octopus who counts on all eight arms and still checks her working.
 * Silhouette hook: a big round head over a skirt of curling arms. Owned colour: violet, with a
 * yellow pencil tucked behind her eye. She answers every mood in kit.js MOODS, like Rosa, and her
 * two front arms are posed per mood with the shared rig().
 *
 *   NAME              the display name; renaming her is this one line
 *   ada(mood) -> svg  works with coach(el, ada)
 */
export const NAME = 'Ada';

const SKIN = '#8A6AD6';
const SHADE = '#6C4FB8';
const SPOT = '#A98EEB';
const SUCKER = '#E4D9FF';
const PENCIL = '#F7C02B';

const J = { armL: [30, 70], armR: [70, 70] };
const STAND = { armL: [24], armR: [-24] };
// Positive rotation is clockwise: a left arm swings up and out with +, a right arm with -.
const ARMS = {
  teach:      { armL: [24], armR: [-75] },             // right arm out, presenting
  think:      { armL: [24], armR: [96] },             // tip to the chin
  correct:    { armL: [150], armR: [-150] },           // both up
  wrong:      { armL: [48], armR: [-48] },             // open, low: "it's fine"
  struggling: { armL: [24], armR: [-95] },             // pointing out at the sum
  complete:   { armL: [160], armR: [-128], body: [0, -3] },
  sleepy:     { armL: [-18], armR: [18], body: [0, 2] }, // tucked in
};
const RIG = rig(J, STAND, {});

// A tentacle hanging from (x, y), curling one way at the tip, with suckers down its front.
// `spread` is how far out the tip lands.
const curl = (x, y, side, length, colour, suckers = false, spread = 4) => {
  const d = `M${x} ${y} C${x - side * 3} ${y + length * 0.45} ${x + side * (spread + 4)} ${y + length * 0.75} ${x + side * spread} ${y + length}`
    + ` q${side * 5} ${3} ${side * 7} ${-3}`;
  const dots = suckers ? [0.45, 0.72].map((k) => `<circle cx="${x + side * (k * (spread + 2) - 1)}" cy="${y + length * k}" r="1.6" fill="${SUCKER}"/>`).join('') : '';
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
};

export function ada(mood = 'teach') {
  const m = ARMS[mood] ? mood : 'teach';
  const p = RIG.pose(null, ARMS[m]);
  const arm = ([x, y], side) => curl(x, y, side, 30, SKIN, true);
  return svg(NAME.toLowerCase(), m, `
    ${shadow(30)}
    <g ${RIG.at('body', p)}>
      <g data-part="legs">
        ${curl(32, 72, -1, 32, SHADE, false, 12)}${curl(68, 72, 1, 32, SHADE, false, 12)}
        ${curl(43, 78, -1, 27, SKIN, true, 5)}${curl(57, 78, 1, 27, SKIN, true, 5)}
      </g>
      <g data-part="head">
        <path d="M50 10 C73 10 82 30 82 50 C82 70 70 82 50 82 C30 82 18 70 18 50 C18 30 27 10 50 10 Z" fill="${SKIN}"/>
        <path d="M68 16 C78 24 82 36 82 50 C82 70 70 82 50 82 C66 76 74 62 74 46 C74 34 72 24 68 16 Z" fill="${SHADE}"/>
        <ellipse cx="38" cy="22" rx="5" ry="3.5" fill="${SPOT}"/><ellipse cx="50" cy="17" rx="3" ry="2.2" fill="${SPOT}"/>
        <ellipse cx="30" cy="31" rx="2.6" ry="2" fill="${SPOT}"/>
        <g data-part="pencil" transform="rotate(-50 70 22)"><rect x="62" y="27" width="22" height="6" rx="1.5" fill="${PENCIL}"/>
          <path d="M84 27 L90 30 L84 33 Z" fill="#F1D9B0"/><circle cx="89.4" cy="30" r="1" fill="#1E1B2E"/>
          <rect x="59" y="27" width="4" height="6" rx="1.5" fill="#F28C8C"/></g>
        ${face(m, { cx: 50, cy: 52, skin: SKIN, mouthY: 13, size: 1.15 })}
      </g>
      <g data-part="arms"><g ${RIG.at('armL', p)}>${arm(J.armL, -1)}</g><g ${RIG.at('armR', p)}>${arm(J.armR, 1)}</g></g>
    </g>`);
}
