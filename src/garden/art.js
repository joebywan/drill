import { move } from '../feel.js';
import { scene, slots, place, SIZE, visitor } from './scene.js';
export { scene, slots, place, SIZE, MOODS, visitor, animateVisitor, VISITORS } from './scene.js';

/**
 * The garden's plants, drawn like the cast (src/cast/kit.js): hand-written SVG strings, flat
 * colour, no outlines, parts tagged `data-part`, motion through feel.js `move()`.
 *
 * Each habit is one plant chosen to read at a glance, drawn on a 100 x 120 canvas whose base (where
 * the stem meets the soil) is (50, 106). Plant colours are constants, like the cast's: they are
 * checked on the light and the dark page and on every scene in tools/garden.html.
 *
 * API:
 *   PLANTS                       { habit id: plant name }; every habit in HABITS has one
 *   plant(habit, stage, { flowers = 0, closed = false }) -> svg string
 *       stage 0–4 (seed, sprout, sapling, young, full grown; see STAGES in model.js). `flowers` small
 *       blooms sit on the plant (on the ground around it while it is small), capped at MAX_FLOWERS
 *       and never overlapping. `closed` draws buds shut for the 'resting' mood.
 *   blooms(habit, stage, flowers) -> [{ x, y, r }]   where those blooms go, in canvas units
 *   sway(el) -> Animation | null   a slow idle sway about the base; null under reduced motion
 */
export const MAX_FLOWERS = 6;
const BLOOM_R = 4.5;

const SOIL = '#7A4E32';
const LEAF = '#5FA35A';
const LEAF_DARK = '#3F7E45';
const LEAF_LIGHT = '#8CC77A';
const STEM = '#4A8A4C';
const SEED = '#5B4636';
const GOLD = '#F5C542';
const WHITE = '#FFFDF6';

const f = (v) => Math.round(v * 10) / 10;

// --- Parts ---------------------------------------------------------------------------------

/** An almond leaf from (x, y), `len` long, turned `ang` degrees clockwise from straight up. */
const leaf = (x, y, len, ang, w, fill) =>
  `<path d="M0 0 Q${f(w)} ${f(-len / 2)} 0 ${f(-len)} Q${f(-w)} ${f(-len / 2)} 0 0Z" transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})" fill="${fill}"/>`;

const stem = (d, width, colour = STEM) =>
  `<path d="${d}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;

/** A small five-petal bloom, or a shut bud when closed. */
function bloom({ x, y, r }, colour, closed) {
  if (closed) {
    return `<g data-part="bloom"><ellipse cx="${x}" cy="${f(y - r * 0.2)}" rx="${f(r * 0.45)}" ry="${f(r * 0.8)}" fill="${colour}"/>`
      + `<path d="M${f(x - r * 0.5)} ${f(y + 0.2 * r)} Q${x} ${f(y + r)} ${f(x + r * 0.5)} ${f(y + 0.2 * r)}Z" fill="${LEAF_DARK}"/></g>`;
  }
  const petals = [0, 1, 2, 3, 4].map((i) => {
    const a = (i * 72 - 90) * Math.PI / 180;
    return `<circle cx="${f(x + Math.cos(a) * r * 0.55)}" cy="${f(y + Math.sin(a) * r * 0.55)}" r="${f(r * 0.5)}" fill="${colour}"/>`;
  }).join('');
  return `<g data-part="bloom">${petals}<circle cx="${x}" cy="${y}" r="${f(r * 0.32)}" fill="${GOLD}"/></g>`;
}

/** A four-point twinkle: full grown is a reward, so it shines a little. */
const twinkle = (x, y, s) =>
  `<path d="M${x} ${y - s} Q${x + s * 0.2} ${y - s * 0.2} ${x + s} ${y} Q${x + s * 0.2} ${y + s * 0.2} ${x} ${y + s} Q${x - s * 0.2} ${y + s * 0.2} ${x - s} ${y} Q${x - s * 0.2} ${y - s * 0.2} ${x} ${y - s}Z" fill="${GOLD}"/>`;

/** Smooth path through points, with quadratic curves between midpoints. */
function smooth(pts) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    d += ` Q${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
  }
  const [lx, ly] = pts.at(-1);
  return `${d} L${f(lx)} ${f(ly)}`;
}

// --- The plants: each one function of stage (0 seed … 4 full grown) -----------------------

// Learning: a tree. An acorn, a sprout that is already a tiny tree (a trunk and a round crown of
// oak leaves), a sapling with a fuller crown, then a trunk and a round canopy that grows to full
// size and bears apples.
const TREE_CANOPY = [[50, 36, 24], [30, 50, 17], [70, 50, 17], [36, 28, 15], [64, 28, 15], [50, 56, 16]];
const TREE_SPOTS = [[32, 46], [46, 22], [64, 28], [72, 50], [52, 42], [40, 60]];
const APPLES = [[26, 58], [58, 60], [76, 60], [42, 34]];
const TREE_SAPLING = [null,
  { top: 95, w: 2.4, leaves: [[95, -55, 15], [95, 55, 15], [94, 0, 14]] },
  { top: 76, w: 3.4, leaves: [[90, -80, 13], [88, 76, 13], [77, -50, 16], [77, 50, 16], [76, 0, 16]] }];
/** A lobed oak leaf from (x, y), `len` long, turned `ang` degrees clockwise from straight up. */
const oak = (x, y, len, ang, fill) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${ang})" fill="${fill}"><ellipse cx="0" cy="${f(-len * 0.55)}" rx="${f(len * 0.2)}" ry="${f(len * 0.45)}"/>`
  + [0.35, 0.6, 0.84].map((t, i) => [-1, 1].map((side) =>
    `<circle cx="${f(side * len * (0.2 - i * 0.03))}" cy="${f(-len * t)}" r="${f(len * (0.17 - i * 0.03))}"/>`).join('')).join('') + '</g>';
// Canopy grows about its centre: young is 0.66 of full, lower down on a shorter trunk.
const treeAt = (s) => (s === 3 ? { k: 0.66, cy: 62 } : { k: 1, cy: 44 });
const inCanopy = (s, [x, y]) => {
  const { k, cy } = treeAt(s);
  return [f(50 + (x - 50) * k), f(cy + (y - 44) * k)];
};

function tree(s) {
  if (s === 0) {
    return `<ellipse cx="50" cy="102" rx="4.2" ry="5" fill="#B9824A"/><path d="M45 99 Q50 94 55 99Z" fill="${SEED}"/>`
      + stem('M50 95 L51 93', 1.6, SEED);
  }
  if (s <= 2) {
    const { top, w, leaves } = TREE_SAPLING[s];
    return `<path d="M${f(50 - w)} 106 Q${f(50 - w * 0.4)} ${f((106 + top) / 2)} ${f(50 - w * 0.4)} ${top} L${f(50 + w * 0.4)} ${top} Q${f(50 + w * 0.4)} ${f((106 + top) / 2)} ${f(50 + w)} 106Z" fill="#8A5E3B"/>`
      + leaves.map(([y, a, l], i) => oak(50, y, l, a, i % 2 ? LEAF_DARK : LEAF)).join('');
  }
  const { k, cy } = treeAt(s);
  const w = 3 + 3 * k, top = cy + 10;
  const trunk = `<path d="M${f(50 - w - 2 * k)} 106 Q${f(50 - w * 0.6)} ${f((106 + top) / 2)} ${f(50 - w * 0.6)} ${top} L${f(50 + w * 0.6)} ${top} Q${f(50 + w * 0.6)} ${f((106 + top) / 2)} ${f(50 + w + 2 * k)} 106Z" fill="#8A5E3B"/>`
    + stem(`M50 ${f(top + 14 * k)} L${f(50 + 12 * k)} ${f(top + 2)}`, f(2 + k), '#8A5E3B');
  const circles = TREE_CANOPY.map(([x, y, r]) => [...inCanopy(s, [x, y]), f(r * k)]);
  const canopy = circles.map(([x, y, r]) => `<circle cx="${x}" cy="${f(y + 3 * k)}" r="${r}" fill="${LEAF_DARK}"/>`).join('')
    + circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${f(r - 1.5)}" fill="${LEAF}"/>`).join('')
    + circles.slice(3, 5).map(([x, y, r]) => `<circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.3)}" r="${f(r * 0.45)}" fill="${LEAF_LIGHT}"/>`).join('');
  const apples = s === 4 ? APPLES.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#D9483B"/><circle cx="${x - 1.1}" cy="${y - 1.1}" r="1" fill="#F49A8E"/>`).join('') : '';
  return trunk + canopy + apples;
}

// Calm: lavender. Grey-green blades, then purple spikes on long stems, fanning out when full grown.
const LAV = '#7FA38A', LAV_DARK = '#5E8470', PURPLE = '#8A63CC', PURPLE_DARK = '#6847AE', PURPLE_LIGHT = '#B49BE6';
const LAV_SPIKES = [null, [], [],
  [[42, 52], [50, 44], [58, 54]],
  [[22, 42], [32, 30], [42, 22], [50, 18], [58, 22], [68, 30], [78, 42]]];

function lavender(s) {
  if (s === 0) return `<ellipse cx="50" cy="102" rx="3" ry="2.4" fill="${SEED}"/>`;
  const blades = [2, 5, 7, 9, 11][s];
  const len = [0, 9, 16, 20, 24][s];
  const tuft = Array.from({ length: blades }, (_, i) => {
    const t = blades === 1 ? 0 : i / (blades - 1) - 0.5;
    return leaf(50 + t * 6, 106, len - Math.abs(t) * 6, t * 120, 1.9, i % 2 ? LAV : LAV_DARK);
  }).join('');
  const head = s === 4 ? 22 : 16, beads = s === 4 ? 7 : 5;
  const spikes = LAV_SPIKES[s].map(([x, y]) => {
    const base = 50 + (x - 50) * 0.15;
    const st = stem(`M${f(base)} 104 Q${f(base + (x - base) * 0.3)} ${f((104 + y) / 2)} ${x} ${y + head}`, 1.8, LAV_DARK);
    const bs = Array.from({ length: beads }, (_, i) => {
      const by = y + (i * head) / (beads - 1), w = 1.8 + (i / beads) * 1.2;
      return `<ellipse cx="${x}" cy="${f(by)}" rx="${f(w)}" ry="2.6" fill="${i % 2 ? PURPLE_DARK : PURPLE}"/>`;
    }).join('');
    return st + bs + `<circle cx="${x - 0.8}" cy="${y + 1}" r="1" fill="${PURPLE_LIGHT}"/>`;
  }).join('');
  return tuft + spikes;
}

// Move: a sunflower. A striped seed, round seed-leaves, then one tall stalk with big heart leaves
// and a shut green bud on top, a bud with yellow showing, then the big yellow head.
const SUN_TOP = [0, 94, 72, 50, 34];
// Heart leaves: [y, angle, size].
const SUN_LEAVES = [null, [],
  [[96, -78, 1.25], [86, 78, 1.25]],
  [[96, -75, 1.3], [86, 75, 1.35], [74, -70, 1.2], [64, 70, 1.1]],
  [[98, -75, 1.4], [88, 75, 1.5], [76, -70, 1.4], [64, 70, 1.35], [52, -65, 1]]];

function sunflower(s, closed) {
  if (s === 0) {
    return `<path d="M50 95 Q55.5 101 50 106 Q44.5 101 50 95Z" fill="#3B3B40"/>`
      + stem('M48.6 98.5 L48.6 103', 0.9, '#E8E6DF') + stem('M51.4 98.5 L51.4 103', 0.9, '#E8E6DF');
  }
  const top = SUN_TOP[s];
  let out = stem(`M50 106 Q52 ${f((106 + top) / 2)} 50 ${top}`, 1.5 + s, STEM);
  if (s === 1) {
    out += `<ellipse cx="44" cy="${top}" rx="6" ry="3.4" fill="${LEAF}" transform="rotate(-18 44 ${top})"/>`
      + `<ellipse cx="56" cy="${top}" rx="6" ry="3.4" fill="${LEAF_DARK}" transform="rotate(18 56 ${top})"/>`;
  }
  out += SUN_LEAVES[s].map(([y, a, k], i) => heart(50, y, k, a, i % 2 ? LEAF_DARK : LEAF)).join('');
  if (s === 2) {
    // A shut green bud, cupped in two sepals.
    return out + `<ellipse cx="50" cy="${top - 4}" rx="3.6" ry="5.4" fill="${LEAF_DARK}"/>`
      + leaf(50, top + 1, 7, -40, 2.4, LEAF) + leaf(50, top + 1, 7, 40, 2.4, LEAF);
  }
  if (s === 3) {
    // A green bud with yellow just showing.
    const tips = Array.from({ length: 8 }, (_, i) => leaf(50, top, 9, i * 45 + 22, 2.4, i % 2 ? '#F5C21B' : LEAF_DARK)).join('');
    return out + tips + `<circle cx="50" cy="${top}" r="6.5" fill="${LEAF}"/>`;
  }
  if (s === 4) {
    const cy = 30, petal = closed ? 6 : 12;
    const ring = (n, off, colour, len) => Array.from({ length: n }, (_, i) => leaf(50, cy, 11 + len, (i * 360) / n + off, 3.6, colour)).join('');
    const seeds = Array.from({ length: 7 }, (_, i) => {
      const a = (i * 360 / 7) * Math.PI / 180;
      return `<circle cx="${f(50 + Math.cos(a) * 5.5)}" cy="${f(cy + Math.sin(a) * 5.5)}" r="1.2" fill="#8E5A30"/>`;
    }).join('');
    out += `<g data-part="head">${ring(16, 11, '#F0A92A', petal - 2)}${ring(16, 0, '#F7C51E', petal)}`
      + `<circle cx="50" cy="${cy}" r="11" fill="#6B3F1F"/>${seeds}<circle cx="50" cy="${cy}" r="2" fill="#8E5A30"/></g>`;
  }
  return out;
}

// Reflect: a climbing vine on a little wooden trellis, which carries white moonflowers when full
// grown. (A bare vine reads as a squiggle at 48 px; the ladder trellis makes "climber" obvious.)
const TRELLIS = [0, 26, 48, 70, 88];
const heart = (x, y, size, ang, fill) =>
  `<path d="M0 0 C-6 -3 -7 -10 -3 -11 C-1 -11.5 0 -10 0 -9 C0 -10 1 -11.5 3 -11 C7 -10 6 -3 0 0Z" transform="translate(${f(x)} ${f(y)}) rotate(${ang}) scale(${size})" fill="${fill}"/>`;

function vine(s) {
  if (s === 0) return `<ellipse cx="50" cy="102" rx="3.4" ry="2.6" fill="${SEED}"/>`;
  const top = 106 - TRELLIS[s];
  let out = [38, 62].map((x) => `<rect x="${x - 1.8}" y="${top}" width="3.6" height="${106 - top}" rx="1.8" fill="#A87D52"/>`).join('');
  for (let y = 98; y > top + 2; y -= 14) out += `<rect x="37" y="${y - 1.2}" width="26" height="2.4" rx="1.2" fill="#8C6440"/>`;
  // The vine winds side to side up the trellis, one leaf at every turn.
  const reach = s === 1 ? 94 : top + 6;
  const pts = [[50, 106]];
  for (let i = 1, y = 100; y > reach; i++, y -= 11) pts.push([i % 2 ? 40 : 60, y]);
  pts.push([50, reach]);
  out += stem(smooth(pts), 1.8, STEM);
  out += pts.slice(1).map(([x, y], i) => heart(x, y, 0.55 + s * 0.12, x < 50 ? -60 : 60, i % 2 ? LEAF_DARK : LEAF)).join('');
  if (s === 4) {
    out += [[50, top + 2], [34, top + 30], [66, top + 50]].map(([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="7" fill="${WHITE}"/><circle cx="${x}" cy="${y}" r="3.4" fill="#F1E3A6"/><circle cx="${x}" cy="${y}" r="1.3" fill="#C9B25A"/>`).join('');
  }
  return out;
}

// Screen break: daisies. A rosette of leaves, a bud, then a clump of white daisies that shut at rest.
const DAISIES = [null, [], [[52, 82, 5]],
  [[40, 70, 9], [58, 60, 10], [54, 84, 8]],
  [[24, 62, 11], [45, 40, 13], [68, 48, 12], [80, 74, 10], [50, 70, 10]]];

function daisy(x, y, size, closed) {
  if (closed) {
    return `<ellipse cx="${x}" cy="${f(y - size * 0.35)}" rx="${f(size * 0.35)}" ry="${f(size * 0.65)}" fill="${WHITE}"/>`
      + `<path d="M${f(x - size * 0.45)} ${y} Q${x} ${f(y + size * 0.6)} ${f(x + size * 0.45)} ${y}Z" fill="${LEAF_DARK}"/>`;
  }
  // A lilac-grey back ring gives white petals an edge on a pale page without an outline.
  const ring = (off, fill, len) => Array.from({ length: 12 }, (_, i) => leaf(x, y, size * len, i * 30 + off, size * 0.28, fill)).join('');
  return ring(15, '#C9C3DC', 1.2) + ring(0, WHITE, 1.15) + `<circle cx="${x}" cy="${y}" r="${f(size * 0.4)}" fill="#F2B91E"/>`;
}

function daisies(s, closed) {
  if (s === 0) return `<ellipse cx="50" cy="102" rx="2.6" ry="2" fill="${SEED}"/>`;
  const rosette = (s === 1 ? [-40, 40] : [-80, -50, 50, 80, -20]).map((a, i) =>
    leaf(50, 106, s === 1 ? 9 : 10 + s * 2, a, s === 1 ? 4.5 : 4, i % 2 ? LEAF_DARK : LEAF)).join('');
  const heads = DAISIES[s].map(([x, y, size]) =>
    stem(`M${f(50 + (x - 50) * 0.2)} 104 Q${f(x + (50 - x) * 0.2)} ${f((104 + y) / 2)} ${x} ${y}`, 1.8, LEAF_DARK)
    + daisy(x, y, size, closed || s === 2)).join('');
  return rosette + heads;
}

// --- The public API -------------------------------------------------------------------------

const DRAW = { tree, lavender, sunflower, vine, daisies };
export const PLANTS = { learn: 'tree', calm: 'lavender', move: 'sunflower', reflect: 'vine', break: 'daisies' };
const BLOOM_COLOUR = { tree: '#F4A6C0', lavender: '#F2A7C3', sunflower: '#E8613C', vine: '#C99BEA', daisies: '#F28CB0' };

// Where blooms go, per plant and stage. Small plants keep theirs on the ground round the mound.
const GROUND = [[18, 104], [82, 104], [28, 112], [72, 112], [9, 111], [91, 111]];
const SPOTS = {
  tree: { 3: TREE_SPOTS.map((p) => inCanopy(3, p)), 4: TREE_SPOTS },
  lavender: { 3: [[30, 84], [70, 84], [38, 70], [62, 66], [24, 98], [76, 98]], 4: [[18, 70], [82, 70], [28, 86], [72, 86], [39, 72], [61, 72]] },
  sunflower: { 3: [[28, 96], [72, 88], [30, 74], [70, 64], [20, 106], [80, 106]], 4: [[26, 92], [74, 82], [28, 70], [72, 58], [32, 50], [70, 46]] },
  vine: Object.fromEntries([2, 3, 4].map((s) => [s, Array.from({ length: 6 }, (_, i) =>
    [i % 2 ? 72 : 28, f(100 - (i * (TRELLIS[s] - 8)) / 5)])])),
  daisies: { 3: [[26, 96], [74, 96], [30, 82], [72, 80], [18, 106], [82, 106]], 4: [[16, 90], [86, 92], [34, 96], [68, 96], [22, 106], [80, 108]] },
};

const nameOf = (habit) => PLANTS[habit] || 'tree';
const stageOf = (stage) => Math.max(0, Math.min(4, Math.floor(stage) || 0));

export function blooms(habit, stage, flowers = 0) {
  const spots = SPOTS[nameOf(habit)][stageOf(stage)] || GROUND;
  const n = Math.max(0, Math.min(MAX_FLOWERS, Math.floor(flowers) || 0));
  return spots.slice(0, n).map(([x, y]) => ({ x, y, r: BLOOM_R }));
}

// Each plant's drawing at each stage is scaled about its base so early stages read at a glance: a
// sprout about a third of full height, a sapling about half, and every stage taller than the last
// (a test measures it in the browser). Blooms on the plant scale with it; blooms on the ground don't.
const GROW = {
  tree: [1.6, 1.4, 1.05, 1.1, 1],
  lavender: [1.8, 3.4, 2.7, 1.12, 1],
  sunflower: [1.6, 1.9, 1.25, 1.08, 1],
  vine: [1.6, 1.2, 1.05, 1, 1],
  daisies: [1.8, 3.4, 1.7, 1.25, 1],
};
const grown = (k, svg) => (k === 1 ? svg : `<g transform="translate(50 106) scale(${k}) translate(-50 -106)">${svg}</g>`);

export function plant(habit, stage = 0, { flowers = 0, closed = false } = {}) {
  const name = nameOf(habit), s = stageOf(stage);
  const k = GROW[name][s];
  const mound = `<ellipse data-part="mound" cx="50" cy="107" rx="${14 + s * 3}" ry="4.5" fill="${SOIL}"/>`;
  const shine = s === 4 ? `<g data-part="twinkle">${twinkle(12, 18, 4)}${twinkle(88, 12, 3)}</g>` : '';
  const flowerSvg = blooms(habit, s, flowers).map((b) => bloom(b, BLOOM_COLOUR[name], closed)).join('');
  return `<svg class="plant plant-${name} stage-${s}" data-habit="${habit}" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
    + `${mound}<g data-part="plant">${SPOTS[name][s]
      ? grown(k, `${DRAW[name](s, closed)}<g data-part="blooms">${flowerSvg}</g>`)
      : `${grown(k, DRAW[name](s, closed))}<g data-part="blooms">${flowerSvg}</g>`}</g>${shine}</svg>`;
}

export function sway(el) {
  const part = el?.querySelector?.('[data-part="plant"]');
  if (!part) return null;
  Object.assign(part.style, { transformBox: 'view-box', transformOrigin: '50px 106px' });
  const deg = 1.6;
  return move(part, [{ transform: `rotate(${-deg}deg)` }, { transform: `rotate(${deg}deg)` }],
    { duration: 2600 + Math.random() * 1600, delay: -Math.random() * 3000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
}

// --- A whole garden, for the garden screen ---------------------------------------------------

/** A single bloom in a habit's colour, drawn small beside "A flower opened" lines. */
export const flower = (habit) =>
  `<svg class="flower" viewBox="-5 -5 10 10" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${bloom({ x: 0, y: 0, r: BLOOM_R }, BLOOM_COLOUR[nameOf(habit)], false)}</svg>`;

// What each plant draws at each stage, in canvas units [x0, y0, x1, y1]: mound, twinkles, shut buds
// and MAX_FLOWERS blooms included, a unit of room around. Measured with getBBox in the browser; an
// e2e test re-measures and fails with the new numbers when a drawing changes.
export const BOUNDS = {
  tree: [[3, 84, 97, 118], [3, 68, 97, 118], [3, 56, 97, 118], [22, 35, 78, 113], [7, 8, 92, 113]],
  lavender: [[3, 93, 97, 118], [3, 74, 97, 118], [3, 61, 97, 118], [14, 32, 86, 113], [7, 8, 92, 113]],
  sunflower: [[3, 87, 97, 118], [3, 72, 97, 118], [3, 50, 97, 118], [11, 35, 89, 113], [7, 6, 92, 113]],
  vine: [[3, 94, 97, 118], [3, 73, 97, 118], [20, 51, 80, 113], [22, 31, 78, 113], [7, 8, 92, 113]],
  daisies: [[3, 94, 97, 118], [3, 76, 97, 118], [3, 55, 97, 118], [3, 32, 97, 113], [7, 8, 93, 114]],
};
const ASPECT = { butterfly: 1, bee: 1, birds: 56 / 32 };

/** A plant's drawn box at a slot, in the scene's units { x, y, w, h }. A plant not measured yet is its whole canvas. */
export function plantBox(habit, stage, { x, y, w }) {
  const [x0, y0, x1, y1] = BOUNDS[nameOf(habit)]?.[stageOf(stage)] || [0, 0, 100, 120];
  const k = w / 100, left = x - w / 2, top = y - w * 1.06;
  return { x: f(left + x0 * k), y: f(top + y0 * k), w: f((x1 - x0) * k), h: f((y1 - y0) * k) };
}

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Where each plant's visitors wait, in the scene's units: for plants [{ habit, stage }] laid out by
 * slots(shape, n), one { butterfly, bee, birds } of boxes { x, y, w, h } per plant. Each wants a
 * spot by its own plant (the butterfly above it to the left, the bee above it to the right, the birds
 * on the ground beside it, towards the middle) and takes the nearest one, inside the scene, that is
 * clear of every plant's drawn box and of the visitors placed before it. Pure.
 */
export function perches(plants, shape = 'tall') {
  const [W, H] = SIZE[shape] || SIZE.tall;
  const at = slots(shape, plants.length);
  const taken = plants.map((p, i) => plantBox(p.habit, p.stage, at[i]));
  const STEP = 3; // ponytail: a grid scan for the nearest free spot; a few thousand box tests per visitor
  const place = (kind, cx, bottom, h) => {
    const bw = h * ASPECT[kind];
    const want = { x: cx - bw / 2, y: bottom - h };
    let best = null, bestD = Infinity;
    for (let y = 0; y <= H - h; y += STEP) {
      for (let x = 0; x <= W - bw; x += STEP) {
        const d = (x - want.x) ** 2 + (y - want.y) ** 2;
        if (d < bestD) {
          const b = { x, y, w: bw, h };
          if (!taken.some((t) => overlap(b, t))) [best, bestD] = [b, d];
        }
      }
    }
    // Nowhere free (never in a real garden; a test checks every layout): stay by the plant.
    const b = best || { x: Math.max(0, Math.min(W - bw, want.x)), y: Math.max(0, Math.min(H - h, want.y)), w: bw, h };
    taken.push(b);
    return { x: f(b.x), y: f(b.y), w: f(bw), h: f(h) };
  };
  const wants = (i) => {
    const { x, y, w } = at[i], top = taken[i].y;
    return {
      birds: [x + (x > W / 2 ? -1 : 1) * 0.53 * w, y + 0.06 * w, 0.22 * w],
      butterfly: [x - 0.3 * w, top - 0.04 * w, 0.26 * w],
      bee: [x + 0.3 * w, top - 0.1 * w, 0.2 * w],
    };
  };
  const out = plants.map(() => ({}));
  // Biggest first, every plant's birds before any butterfly, so the small ones fill the gaps left.
  for (const kind of ['birds', 'butterfly', 'bee']) {
    out.forEach((spot, i) => { spot[kind] = place(kind, ...wants(i)[kind]); });
  }
  return out;
}

/**
 * The garden as one svg string, drawn once per render: `garden()` from model.js in `shape`
 * ('strip' or 'tall'). Each plant at its stage with its flowers (plant() caps them) and shut
 * buds when resting, then each visitor at its plant's perch. A clear rect under each plant
 * makes the whole plant tappable.
 */
export function drawGarden({ mood, plants }, shape = 'tall') {
  const at = slots(shape, plants.length);
  const closed = mood === 'resting';
  const grown = plants.map((p, i) => place(plant(p.habit, p.stage, { flowers: p.flowers.length, closed }), at[i])
    .replace(/^(<svg [^>]*>)/, '$1<rect width="100" height="120" fill="transparent"/>')).join('');
  const spots = perches(plants, shape);
  const life = plants.flatMap((p, i) => p.visitors.map(({ gift }) => {
    const b = spots[i][gift];
    return b ? visitor(gift).replace('<svg ', `<svg x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" data-kind="${gift}" `) : '';
  })).join('');
  return scene(mood, shape).replace(/<\/svg>$/, `${grown}${life}</svg>`);
}
