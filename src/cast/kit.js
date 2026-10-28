/**
 * The shared kit every character is built from. See "Construction kit" in the cast brief.
 *
 * - Flat colour, no outlines. Ink is used for facial features only.
 * - A character is a function `(mood, ...) => svg string` drawn on a 100 x 120 canvas.
 * - Every character answers every mood in MOODS. A mood is a face (from `face()`) plus a pose.
 * - Parts carry `data-part` so later code can animate them without redrawing.
 */
export const INK = '#1E1B2E';
const MOUTH_FILL = '#6B2430';
const BLUSH = '#F28C8C';

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

// Part settings per mood. dx/dy nudge the gaze; brows are [lift, tilt in degrees, raise right].
const FACES = {
  teach:      { eyes: 'open',  brows: [0, 0],    mouth: 'smile' },
  think:      { eyes: 'open',  brows: [1, 0, 4], mouth: 'flat', dx: 2, dy: -2 },
  correct:    { eyes: 'happy', brows: [3, 0],    mouth: 'open', blush: true },
  wrong:      { eyes: 'open',  brows: [1, 14],   mouth: 'soft' },
  struggling: { eyes: 'open',  brows: [2, 6],    mouth: 'grin', dx: 3 },
  complete:   { eyes: 'proud', brows: [1, 0],    mouth: 'big', blush: true },
  sleepy:     { eyes: 'sleepy', brows: [-1, 0],  mouth: 'o' },
};

/**
 * A face centred between the eyes at (cx, cy). `skin` colours the eyelids so they read as
 * lids, not ink. Eyes sit 22 apart; the mouth sits `mouthY` below the eye line.
 */
export function face(mood, { cx, cy, skin, mouthY = 13 }) {
  const f = FACES[mood] || FACES.teach;
  const gx = f.dx || 0, gy = f.dy || 0;
  const eyes = [cx - 11, cx + 11].map((x) => eye(f.eyes, x, cy, gx, gy, skin)).join('');
  const [lift, tilt, raise = 0] = f.brows;
  const brows = [-1, 1].map((side) => {
    const x = cx + side * 11, y = cy - 10 - lift - (side > 0 ? raise : 0);
    // Positive tilt raises the inner ends (sympathy); `raise` lifts the right brow (curiosity).
    return `<rect x="${x - 4.5}" y="${y - 1.3}" width="9" height="2.6" rx="1.3" fill="${INK}" transform="rotate(${side * tilt} ${x} ${y})"/>`;
  }).join('');
  const blush = f.blush
    ? [cx - 15, cx + 15].map((x) => `<ellipse cx="${x}" cy="${cy + 7}" rx="4" ry="2.4" fill="${BLUSH}" opacity=".7"/>`).join('') : '';
  return `<g data-part="face">${blush}<g data-part="eyes">${eyes}</g><g data-part="brows">${brows}</g>${mouth(f.mouth, cx, cy + mouthY)}</g>`;
}

function eye(kind, x, y, gx, gy, skin) {
  const line = `fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"`;
  if (kind === 'happy') return `<path d="M${x - 4.5} ${y + 1.5} Q${x} ${y - 5} ${x + 4.5} ${y + 1.5}" ${line}/>`;
  if (kind === 'proud') return `<path d="M${x - 4.5} ${y - 1} Q${x} ${y + 4} ${x + 4.5} ${y - 1}" ${line}/>`;
  const open = `<ellipse cx="${x + gx}" cy="${y + gy}" rx="4.5" ry="6" fill="${INK}"/>`
    + `<circle cx="${x + gx + 1.5}" cy="${y + gy - 2.2}" r="1.4" fill="#fff"/>`;
  // Sleepy: an eyelid in skin colour covers the top half.
  if (kind === 'sleepy') return open + `<rect x="${x - 6}" y="${y - 7}" width="12" height="7.5" fill="${skin}"/>`;
  return open;
}

function mouth(kind, x, y) {
  const line = (d, w = 2.4) => `<path data-part="mouth" d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;
  switch (kind) {
    case 'open': return `<path data-part="mouth" d="M${x - 7} ${y - 1} Q${x} ${y + 10} ${x + 7} ${y - 1} Z" fill="${MOUTH_FILL}"/>`;
    case 'o': return `<ellipse data-part="mouth" cx="${x}" cy="${y}" rx="2.4" ry="3" fill="${MOUTH_FILL}"/>`;
    case 'flat': return line(`M${x - 4} ${y + 1} L${x + 4} ${y}`);
    case 'grin': return line(`M${x - 6} ${y} Q${x - 1} ${y + 5} ${x + 6} ${y - 2}`);
    case 'big': return line(`M${x - 8} ${y - 1} Q${x} ${y + 8} ${x + 8} ${y - 1}`, 2.6);
    case 'soft': return line(`M${x - 4} ${y + 0.5} Q${x} ${y + 3} ${x + 4} ${y + 0.5}`);
    default: return line(`M${x - 6} ${y} Q${x} ${y + 5} ${x + 6} ${y}`);
  }
}

/** A limb: a round-capped stroke in the body colour, ending in a round hand. */
export const limb = ([x1, y1], [x2, y2], colour, hand = colour, width = 8) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round"/>`
  + `<circle cx="${x2}" cy="${y2}" r="${width * 0.62}" fill="${hand}"/>`;

export const shadow = (rx = 24) => `<ellipse data-part="shadow" cx="50" cy="116" rx="${rx}" ry="3.5" fill="#000" opacity=".12"/>`;

export const svg = (name, mood, body) =>
  `<svg class="cast cast-${name} mood-${mood}" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name}, ${mood}">${body}</svg>`;

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
