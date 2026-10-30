/**
 * The shared kit every character is built from. See "Construction kit" in the cast brief.
 *
 * - Flat colour, no outlines. Ink is used for facial features only.
 * - Chunky: head and body are one mass with no neck, limbs are short and thick.
 * - A character is a function `(mood, ...) => svg string` drawn on a 100 x 120 canvas.
 * - Every character answers every mood in MOODS. A mood is a face (from `face()`) plus a pose.
 * - Parts carry `data-part` so later code can animate them without redrawing.
 */
import { move } from '../feel.js';

export const INK = '#1E1B2E';
const MOUTH_FILL = '#5A1F2B';
const BLUSH = '#F28C8C';
const TONGUE = '#F27D8C';

/**
 * Moods, each tied to a moment in a lesson:
 *   teach       explaining an idea; the default
 *   think       a question is on screen
 *   correct     right answer
 *   wrong       wrong answer: kind, never disappointed
 *   struggling  several misses: points at the hint, encouraging
 *   complete    lesson finished: proud of the learner
 *   sleepy      the day is done, rest well (never "come back")
 */
export const MOODS = ['teach', 'think', 'correct', 'wrong', 'struggling', 'complete', 'sleepy'];

// Part settings per mood. `lid` is how far the upper lid drops (0 wide open, 1 shut): a heavy
// lid is most of the attitude. dx/dy nudge the gaze; brows are [lift, tilt in degrees, raise right].
const FACES = {
  teach:      { eyes: 'open',  lid: 0.25, brows: [0, 0],    mouth: 'smile' },
  think:      { eyes: 'open',  lid: 0.45, brows: [1, 0, 4], mouth: 'flat', dx: 2, dy: -1 },
  correct:    { eyes: 'happy',            brows: [3, 0],    mouth: 'open', blush: true },
  wrong:      { eyes: 'open',  lid: 0,    brows: [1, 14],   mouth: 'soft' },
  struggling: { eyes: 'open',  lid: 0.1,  brows: [2, 6],    mouth: 'grin', dx: 3 },
  complete:   { eyes: 'proud',            brows: [1, 0],    mouth: 'big', blush: true },
  sleepy:     { eyes: 'open',  lid: 0.65, brows: [-1, 0],   mouth: 'o' },
};

/**
 * A face centred between the eyes at (cx, cy). Eyes are whites with a pupil, 22 apart; `skin`
 * colours the lids; `lashes` adds a flick at each outer corner. The mouth sits `mouthY` below the eye line, a little off centre.
 * `mood` is a name from FACES or a settings object of the same shape, for a character's own moods.
 * For a character whose eyes are the point: `size` scales the eyes (and lifts the brows to clear
 * them), `iris` colours the eye in place of white, and `line` colours the happy and proud curves
 * when ink would vanish on a dark eye patch.
 */
export function face(mood, { cx, cy, skin, mouthY = 12, lashes = false, size = 1, iris = '#fff', line = INK }) {
  const f = typeof mood === 'object' ? mood : FACES[mood] || FACES.teach;
  const gx = f.dx || 0, gy = f.dy || 0;
  const eyes = [-1, 1].map((side) => {
    const x = cx + side * 11;
    // One lash flick at the outer corner, from wherever the top of the eye is.
    const top = f.eyes === 'open' ? cy - 7 + 14 * (f.lid || 0) : cy - 1;
    const lash = lashes ? `<path d="M${x + side * 5.5} ${top + 1} L${x + side * 9} ${top - 2}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` : '';
    return eye(f.eyes, x, cy, gx, gy, f.lid || 0, skin, size, iris, line) + lash;
  }).join('');
  const [lift, tilt, raise = 0] = f.brows;
  const brows = [-1, 1].map((side) => {
    const x = cx + side * 11, y = cy - 4 - 7 * size - lift - (side > 0 ? raise : 0);
    // Positive tilt raises the inner ends (sympathy); `raise` lifts the right brow (curiosity).
    return `<rect x="${x - 5.5}" y="${y - 1.8}" width="11" height="3.6" rx="1.8" fill="${INK}" transform="rotate(${side * tilt} ${x} ${y})"/>`;
  }).join('');
  const blush = f.blush
    ? [cx - 16, cx + 16].map((x) => `<ellipse cx="${x}" cy="${cy + 7}" rx="4" ry="2.4" fill="${BLUSH}" opacity=".7"/>`).join('') : '';
  return `<g data-part="face">${blush}<g data-part="eyes">${eyes}</g><g data-part="brows">${brows}</g>${mouth(f.mouth, cx + 2, cy + mouthY)}</g>`;
}

function eye(kind, x, y, gx, gy, lid, skin, s, iris, ink) {
  const line = `fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"`;
  if (kind === 'happy') return `<path d="M${x - 5 * s} ${y + 2} Q${x} ${y - 5 * s} ${x + 5 * s} ${y + 2}" ${line}/>`;
  if (kind === 'proud') return `<path d="M${x - 5 * s} ${y - 1} Q${x} ${y + 5 * s} ${x + 5 * s} ${y - 1}" ${line}/>`;
  const open = `<ellipse cx="${x}" cy="${y}" rx="${6 * s}" ry="${7 * s}" fill="${iris}"/>`
    + `<circle cx="${x + gx}" cy="${y + gy + 1}" r="${3.3 * s}" fill="${INK}"/>`
    + `<circle cx="${x + gx + 1.2 * s}" cy="${y + gy - 0.4 * s}" r="${s}" fill="#fff"/>`;
  if (!lid) return open;
  // The lid: skin over the top of the eye, with a hard ink edge.
  const ly = y - 7 * s + 14 * s * lid;
  return open + `<rect x="${x - 7 * s}" y="${y - 8 * s}" width="${14 * s}" height="${ly - y + 8 * s}" fill="${skin}"/>`
    + `<path d="M${x - 6.5 * s} ${ly} L${x + 6.5 * s} ${ly}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
}

// Mouths are lopsided on purpose: a symmetric mouth reads as a sticker, not a person.
function mouth(kind, x, y) {
  const line = (d, w = 2.8) => `<path data-part="mouth" d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;
  switch (kind) {
    case 'open': return `<g data-part="mouth"><path d="M${x - 7} ${y - 1} L${x + 7} ${y - 2} Q${x + 5} ${y + 9} ${x - 1} ${y + 8} Q${x - 6} ${y + 6} ${x - 7} ${y - 1} Z" fill="${MOUTH_FILL}"/>`
      + `<ellipse cx="${x}" cy="${y + 5.5}" rx="3.2" ry="1.8" fill="${TONGUE}"/></g>`;
    case 'big': return `<g data-part="mouth"><path d="M${x - 9} ${y - 2} L${x + 9} ${y - 3} Q${x + 7} ${y + 11} ${x - 1} ${y + 10} Q${x - 8} ${y + 8} ${x - 9} ${y - 2} Z" fill="${MOUTH_FILL}"/>`
      + `<path d="M${x - 8} ${y - 1.4} L${x + 8} ${y - 2.4} L${x + 7.6} ${y + 0.6} L${x - 7.6} ${y + 1.6} Z" fill="#fff"/>`
      + `<ellipse cx="${x}" cy="${y + 7}" rx="4" ry="2" fill="${TONGUE}"/></g>`;
    case 'o': return `<ellipse data-part="mouth" cx="${x}" cy="${y}" rx="3" ry="3.6" fill="${MOUTH_FILL}"/>`;
    case 'flat': return line(`M${x - 4} ${y + 1} L${x + 5} ${y - 1}`);
    case 'grin': return line(`M${x - 7} ${y - 1} Q${x} ${y + 6} ${x + 7} ${y - 3}`);
    case 'soft': return line(`M${x - 4} ${y + 1} Q${x + 1} ${y + 3} ${x + 5} ${y}`);
    default: return line(`M${x - 6} ${y} Q${x + 1} ${y + 6} ${x + 8} ${y - 1}`);
  }
}

/** A limb: a round-capped stroke in the body colour, ending in a round hand. */
export const limb = ([x1, y1], [x2, y2], colour, hand = colour, width = 8) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round"/>`
  + `<circle cx="${x2}" cy="${y2}" r="${width * 0.62}" fill="${hand}"/>`;

/** The pill everyone stands on: solid and dark, so a figure is grounded on any background. */
export const shadow = (rx = 26) => `<ellipse data-part="shadow" cx="50" cy="111" rx="${rx}" ry="6" fill="#3C4A55"/>`;

export const svg = (name, mood, body) =>
  `<svg class="cast cast-${name} mood-${mood}" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

// --- The rig ------------------------------------------------------------------------------

const DATA = { armL: 'arm-left', armR: 'arm-right', legL: 'leg-left', legR: 'leg-right' };
const PROPS = ['lids', 'seat']; // drawn at scaleY 0 until a pose opens them out

/**
 * A posable character (Clover, Mira): arms, legs, torso and head are separate groups, each moved
 * by one CSS transform about a fixed joint. Moods and poses only change those transforms, so a
 * pose is never a redraw and the Web Animations API can tween any part between any two poses.
 *
 * `joints` are { part: [x, y] } in the 100 x 120 canvas; a part without one (the eyes, closed lids)
 * turns about its own centre. A pose is a list of phases; a phase gives per part
 * [rotate, dx, dy, scaleY], and `body` [dx, dy] moves the whole upper body. Unset parts stand still.
 * Positive rotation is clockwise. `stand` is the resting phase every demo starts and ends on.
 *
 * Returns { POSES, at, pose, demo }:
 *   at(part, phase)     the attributes that put a part's group in that phase
 *   pose(name, arms)    the phase to draw: the named pose's first, else `arms` (a mood's own)
 *   demo(el, pose, seconds, reps = 1) -> Animation[] | null
 *       Moves the character inside `el` from standing to `pose` and back, `reps` times over exactly
 *       `seconds`, every phase the same length. Keyframes are absolute, so it is safe right after
 *       a redraw. Null under reduced motion or for an unknown pose: keep your own clock.
 */
export function rig(joints, stand, poses) {
  const phases = Object.values(poses).flat();
  const parts = [...new Set([stand, ...phases].flatMap(Object.keys))];
  const transform = (part, phase) => {
    const [r = 0, dx = 0, dy = 0, sy = PROPS.includes(part) ? 0 : 1] = part === 'body' ? [0, ...(phase.body || [])] : phase[part] || [];
    const [px, py] = joints[part] || [0, 0];
    return `translate(${dx}px, ${dy}px) translate(${px}px, ${py}px) rotate(${r}deg) scale(1, ${sy}) translate(${-px}px, ${-py}px)`;
  };
  const at = (part, phase) => `data-part="${DATA[part] || part}" style="${joints[part] || part === 'body' ? ''
    : 'transform-box: fill-box; transform-origin: center; '}transform: ${transform(part, phase)}"`;
  return {
    POSES: Object.keys(poses),
    at,
    pose: (name, arms) => ({ ...stand, ...(poses[name] ? poses[name][0] : arms) }),
    demo(el, pose, seconds, reps = 1) {
      if (!poses[pose] || !el?.querySelector) return null;
      const frames = [stand, ...poses[pose].map((p) => ({ ...stand, ...p })), stand];
      const anims = parts.map((part) => move(el.querySelector(`[data-part="${DATA[part] || part}"]`),
        frames.map((p) => ({ transform: transform(part, p), easing: 'ease-in-out' })),
        { duration: (seconds * 1000) / reps, iterations: reps })).filter(Boolean);
      return anims.length ? anims : null;
    },
  };
}

// --- Motion -------------------------------------------------------------------------------

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Blinks a character's eyes every 2–6 s, sometimes twice. Blinks stay under reduced motion:
 * they are tiny and they keep a face alive. Returns a stop function.
 */
export function blink(svgEl) {
  let timer;
  const once = () => svgEl.querySelector('[data-part="eyes"]')?.animate(
    [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.1)', offset: 0.4 }, { transform: 'scaleY(.1)', offset: 0.55 }, { transform: 'scaleY(1)' }],
    { duration: 180, easing: 'ease-in-out' });
  const next = () => {
    timer = setTimeout(async () => {
      await once()?.finished;
      if (Math.random() < 0.15) await once()?.finished;
      next();
    }, 2000 + Math.random() * 4000);
  };
  const eyes = svgEl.querySelector('[data-part="eyes"]');
  if (eyes) { eyes.style.transformBox = 'fill-box'; eyes.style.transformOrigin = 'center'; }
  next();
  return () => clearTimeout(timer);
}
