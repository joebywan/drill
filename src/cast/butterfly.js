import { INK } from './kit.js';
import data from '../data/butterflies.json' with { type: 'json' };

/**
 * The butterfly kit: one home for every butterfly the app draws. Each function returns the SVG body
 * for a 120 x 100 box (BOX); wrap it in <svg viewBox="0 0 120 100">. Flat colour, no outlines but
 * the wing edge, the cast's ink for bodies. The wings are one `data-part="wings"` group and the body
 * `data-part="body"`, so garden/scene.js animateVisitor(el, 'butterfly') flaps an open one as is.
 *
 * Every drawing with a body takes an optional last `body` colour; see BODY_INK below.
 *   butterfly(filled, full)    the player's own, from above: 14 wing panels (PANELS), `filled` colours
 *                              them in fill order (left, right, left, …); `full` adds the dark edge
 *                              and the spots. The app icon draws it (tools/icon.js).
 *   butterflySide(filled)      the player's own, side-on with its wings closed
 *   butterflyToday(state, filled)   the player's own as it is today (widget.js wingState): 'flying',
 *                              'basking' in the sun, or 'resting' on a flower with its wings closed
 *   open(art), side(art)       a species from its drawing spec (SPECIES[n].art), from above and side-on
 *   egg(), caterpillar(growth, spot), chrysalis(band)   the life cycle; growth 0 to 1
 *   HABIT_COLOURS, habitColour(id, own)   the wing panel colour for a habit; `own` is the index of
 *                              a habit of the learner's own, which cycle through OWN_COLOURS
 *   SPECIES, speciesFor(id, own)   the species (src/data/butterflies.json) a course, habit or
 *                              preset raises; a habit of the learner's own takes OWN_SPECIES[own]
 * Every call to butterfly() gets its own clip-path ids, so copies can share a page.
 */
export const BOX = '0 0 120 100';
export const PANELS = 14;

export const HABIT_COLOURS = {
  learn: '#4CAF73', calm: '#9B8CE0', move: '#F07A5A', reflect: '#F2B640', break: '#4A9BE0', focus: '#A86F3E',
  winddown: '#5B5FC7', walk: '#E0609A', read: '#D24B3E', water: '#2EA6A0', outside: '#8DB33A',
  tidy: '#45C1CF', floss: '#E6CF2E', music: '#CF4FB0', make: '#EE8E3A', call: '#7D4FD0',
};
export const OWN_COLOURS = ['#B565C9', '#64809E', '#C0622F', '#C9A227', '#8E4A73', '#3E8E6E'];
export const habitColour = (id, own = 0) => HABIT_COLOURS[id] || OWN_COLOURS[own % OWN_COLOURS.length];

export const SPECIES = data.species;
export const OWN_SPECIES = SPECIES.filter((s) => s.raisedBy === 'own');
export const speciesFor = (id, own = 0) => SPECIES.find((s) => s.raisedBy === id) || OWN_SPECIES[own % OWN_SPECIES.length];

const ORDER = ['learn', 'learn', 'calm', 'learn', 'move', 'calm', 'learn', 'reflect', 'calm', 'learn', 'move', 'calm', 'learn', 'reflect'].map((h) => HABIT_COLOURS[h]);
const EMPTY = '#E0D6C3', EDGE = '#2B2638', VEIN = '#FBF8F2', SOFT = '#C7BBA3', WING = '#F4EFE6';

// The left half; the right half is its mirror.
const FORE = 'M57 36 C50 24 33 9 18 11 C7 12.5 4 27 10 38 C16 48 40 50 57 45 Z';
const HIND = 'M57 49 C45 48 25 53 21 66 C17 79 28 91 40 88 C51 85 56 70 57 56 Z';
const TIP = 'M18 11 C7 12.5 4 27 10 38 C12 30 15 23 23 17 C24 13 22 11 18 11 Z';
const TAIL = 'M27 86 L21 99 L32 89 Z M37 88 L36 100 L42 86 Z';
const VEINS = 'M57 40 L16 15 M57 40 L9 29 M57 41 L22 44 M57 52 L25 63 M57 54 L31 84 M57 54 L46 85';
const mirror = (s) => `<g transform="translate(120 0) scale(-1 1)">${s}</g>`;
const edge = (colour, width) => `<path d="${FORE} ${HIND}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linejoin="round"/>`;
const dot = ([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
// The body, head and antennae: `var(--butterfly-body)` (pale in styles.css's dark theme) over the
// ink by default, so they read on a dark page; a caller with no CSS (the icon, a PNG) passes a colour.
const BODY_INK = `var(--butterfly-body, ${INK})`;
// A var() goes on the group as `color`, once, and the parts paint with currentColor.
const paint = (c) => (k) => `${k}="${c.startsWith('var(') ? 'currentColor' : c}"`;
const tint = (c) => (c.startsWith('var(') ? ` style="color:${c}"` : '');
const BODY = (c) => { const p = paint(c); return `<g data-part="body"${tint(c)}><rect x="57.6" y="36" width="4.8" height="36" rx="2.4" ${p('fill')}/><ellipse cx="60" cy="38" rx="4.2" ry="6.5" ${p('fill')}/>`
  + `<circle cx="60" cy="29" r="4.2" ${p('fill')}/>`
  + `<path d="M58.6 26 Q55 16 49 10 M61.4 26 Q65 16 71 10" ${p('stroke')} stroke-width="1.7" fill="none" stroke-linecap="round"/>`
  + `<circle cx="49" cy="10" r="2.2" ${p('fill')}/><circle cx="71" cy="10" r="2.2" ${p('fill')}/></g>`; };
const fly = (left, right, body) => `<g data-part="wings">${left}${mirror(right)}</g>${BODY(body)}`;

// --- The player's butterfly: each wing a fan of wedge panels from its root, clipped to the wing.
// Panels are wedges between two angles (degrees); SEQ is one side's fill order.
const FROOT = [57, 40], HROOT = [57, 52];
const FW = [[100, 185], [185, 203], [203, 222], [222, 275]], HW = [[80, 118], [118, 145], [145, 275]];
const SEQ = [['f', 1], ['h', 1], ['f', 2], ['f', 0], ['h', 0], ['f', 3], ['h', 2]];
const polar = ([x, y], a, R = 90) => { const r = (a * Math.PI) / 180; return `${(x + R * Math.cos(r)).toFixed(1)} ${(y + R * Math.sin(r)).toFixed(1)}`; };
// The newest coloured panel (side index `newest`) carries `data-new`, so the wingbeat can pop it in.
const panels = (root, fan, cs, part, newest) => fan.map(([a, b], i) => {
  const k = SEQ.findIndex(([p, j]) => p === part && j === i);
  return `<path${k === newest ? ' data-new=""' : ''} d="M${root.join(' ')} L${polar(root, a)} L${polar(root, b)} Z" fill="${cs[k] || EMPTY}"/>`;
}).join('') + `<path d="${fan.slice(1).map(([a]) => `M${root.join(' ')} L${polar(root, a)}`).join(' ')}" stroke="${VEIN}" stroke-width="1.5"/>`;
const DOTS = [[11.5, 30, 1.4, '#fff'], [9, 23.5, 1.2, '#fff'], [14, 16.5, 1.2, '#fff'], [31, 82, 3.2, EDGE], [31, 82, 1.6, '#F2D04A']].map(dot).join('');

let uid = 0;
export function butterfly(filled = ORDER, full = true, body = BODY_INK) {
  const sides = [[], []];
  filled.forEach((c, k) => sides[k % 2].push(c));
  // One pair of clips serves both halves: a clip is read in the user space of what it clips, mirrored too.
  const id = `bf${++uid}`;
  const newest = (s) => ((filled.length - 1) % 2 === s ? (filled.length - 1) >> 1 : -1);
  const half = (cs, s) => `<g clip-path="url(#${id}f)">${panels(FROOT, FW, cs, 'f', newest(s))}</g><g clip-path="url(#${id}h)">${panels(HROOT, HW, cs, 'h', newest(s))}</g>`
    + (full ? edge(EDGE, 2.8) + DOTS : edge(SOFT, 1.4));
  return `<defs><clipPath id="${id}f"><path d="${FORE}"/></clipPath><clipPath id="${id}h"><path d="${HIND}"/></clipPath></defs>`
    + fly(half(sides[0], 0), half(sides[1], 1), body);
}

// --- A species, from its drawing spec (all optional but `fore`):
//   fore, hind      upper-side colours        tip      a dark forewing tip
//   clear           a see-through forewing    veins    dark wing veins
//   tails           a tail on each hindwing   edge, edgeW   the wing edge
//   cells           { index: colour } patches at CELLS
//   dots            [[x, y, r, colour]]       eyes     [[x, y, r, ring?, centre?]] eyespots
//   under           [forewing, hindwing, spots] for the side view, the colours underneath
const CELLS = [[22, 22, 9, 6.5, -28], [36, 62, 8.5, 6.2, -20], [38, 28, 8, 5.5, -18], [20, 37, 8, 5.5, 8],
  [30, 76, 7, 6, 10], [42, 41, 8, 4.5, -4], [46, 71, 4.8, 7, 12]];
const cell = ([cx, cy, rx, ry, r], c) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" transform="rotate(${r} ${cx} ${cy})"/>`;
const eye = ([x, y, r, ring, centre = '#fff']) => (ring ? dot([x, y, r * 1.45, ring]) : '') + dot([x, y, r, '#1E1B1E']) + dot([x, y, r * 0.42, centre]);

export function open(art, body = BODY_INK) {
  const { fore, hind = fore, tip, clear, veins, tails, edge: e, edgeW = 2, cells = {}, dots = [], eyes = [] } = art;
  const half = `<path d="${FORE}" fill="${fore}"${clear ? ' fill-opacity=".3"' : ''}/><path d="${HIND}" fill="${hind}"/>`
    + (tails ? `<path d="${TAIL}" fill="${hind}"/>` : '')
    + (tip ? `<path d="${TIP}" fill="${tip}"/>` : '')
    + Object.entries(cells).map(([i, c]) => cell(CELLS[i], c)).join('')
    + (veins ? `<path d="${VEINS}" stroke="${veins}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : '')
    + (e ? edge(e, edgeW) : '') + dots.map(dot).join('') + eyes.map(eye).join('');
  return fly(half, half, body);
}

/** Side-on with the wings closed over its back, the underside showing: [forewing, hindwing, spots]. */
export function side(art, body = BODY_INK) {
  const p = paint(body);
  const [under, hind, spot] = art.under || [art.hind || art.fore, art.fore, art.fore];
  return `<g transform="translate(-6 10) scale(2.35)"><g data-part="wings">`
    + `<path d="M20 31 C12 28 10 21 14 18 C18 15 22 22 23 30 Z" fill="${hind}"/>`
    + `<path d="M22 30 C14 18 16 4 28 1 C40 -2 44 14 36 26 C33 30 29 31 26 31 Z" fill="${under}"${art.edge ? ` stroke="${art.edge}" stroke-width=".8"` : ''}/>`
    + `<circle cx="30" cy="12" r="2.4" fill="${spot}"/><circle cx="25" cy="21" r="1.8" fill="${spot}"/></g>`
    + `<g data-part="body"${tint(body)}><ellipse cx="25" cy="32" rx="9" ry="2.6" ${p('fill')}/><circle cx="34" cy="31" r="2.6" ${p('fill')}/>`
    + `<path d="M35 29 Q39 22 44 20 M35.5 30 Q41 25 46 25" ${p('stroke')} stroke-width="1.1" fill="none" stroke-linecap="round"/>`
    + `<circle cx="44" cy="20" r="1.1" ${p('fill')}/><circle cx="46" cy="25" r="1.1" ${p('fill')}/></g></g>`;
}

/** The player's butterfly side-on: the cream underside, the hindwing in the latest panel's colour. */
export const butterflySide = (filled = ORDER, body = BODY_INK) => side({ under: [WING, filled.at(-1) || EMPTY, filled[0] || SOFT] }, body);

// --- The life cycle, on a leaf.
const LEAF = `<ellipse cx="60" cy="66" rx="40" ry="13" fill="#6CBF6A" transform="rotate(-8 60 66)"/><path d="M22 71 Q60 66 98 60" stroke="#4E8E4A" stroke-width="1.6" fill="none"/>`;
export const egg = () => LEAF + `<ellipse data-part="egg" cx="60" cy="60" rx="5.2" ry="6.8" fill="#F6F0DC"/>`
  + `<path d="M57 55 Q56 60 57.5 65 M60 53.5 L60 66.5 M63 55 Q64 60 62.5 65" stroke="#DDD1B0" stroke-width="1" fill="none"/>`;

// Its segments, tail to head; a hatchling has the last two, a grown one all six, and it scales up too.
const SEGMENTS = [[29.5, 59, 4.4], [38, 58, 5], [46, 57, 5.6], [54, 56, 6.1], [62.5, 55, 6.6], [71, 54.5, 7]];
export function caterpillar(growth = 1, spot = '#F3E7B8', body = BODY_INK) {
  const g = Math.min(1, Math.max(0, Number(growth) || 0));
  const s = (0.55 + 0.45 * g).toFixed(2);
  return LEAF + `<g data-part="caterpillar" transform="translate(81 58) scale(${s}) translate(-81 -58)">`
    + SEGMENTS.slice(-(2 + Math.round(g * 4))).map(([x, y, r], i) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? '#7CC26A' : '#8ED07A'}"/><circle cx="${x}" cy="${(y - r * 0.35).toFixed(1)}" r="${(r * 0.32).toFixed(1)}" fill="${spot}"/>`
      + `<rect x="${x - 1.4}" y="${(y + r - 1.5).toFixed(1)}" width="2.8" height="3.6" rx="1.4" fill="#3F7A3A"/>`).join('')
    + `<circle cx="81" cy="52" r="8.2" fill="#9AD47A"/><circle cx="84.5" cy="50" r="1.7" fill="${INK}"/><circle cx="79" cy="50.5" r="1.5" fill="${INK}"/>`
    + `<path d="M79 55.5 Q82 57.5 85.5 55" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
    + `<path d="M79 44.5 L77 38.5 M84 44.5 L86 38.5" ${paint(body)('stroke')}${tint(body)} stroke-width="1.2" stroke-linecap="round"/></g>`;
}

export const chrysalis = (band = '#F3E7B8') => `<path d="M30 20 L92 16" stroke="#8A6A45" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="60" cy="19" rx="3" ry="2" fill="#F6F0DC"/>`
  + `<g data-part="chrysalis"><path d="M60 21 C71 30 73 52 60 74 C47 52 49 30 60 21 Z" fill="#8ED07A"/><path d="M60 21 C66 30 67 50 60 74 C63 52 63 32 60 21 Z" fill="#7CC26A"/>`
  + `<path d="M52 40 Q60 44 68 40" stroke="${band}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
  + [[53, 46], [57, 47], [61, 47], [65, 46]].map(([x, y]) => dot([x, y, 1.1, '#F2D04A'])).join('') + '</g>';

/** A species' colour for its caterpillar's spots and its chrysalis's band: its first patch or spot. */
export const tintOf = (art) => Object.values(art.cells || {})[0] || art.dots?.[0]?.[3] || '#F3E7B8';

/** A species at a stage of its life ('egg', 'caterpillar', 'chrysalis', 'butterfly'), open once emerged. */
export function lifeArt(species, stage, growth = 0, body = BODY_INK) {
  if (stage === 'egg') return egg();
  if (stage === 'caterpillar') return caterpillar(growth, tintOf(species.art), body);
  if (stage === 'chrysalis') return chrysalis(tintOf(species.art));
  return open(species.art, body);
}

// --- The player's butterfly today: flying once today is done, basking in the sun until then, resting
// on a flower with its wings closed after a missed day. Never sad. From the approved sketches.
const SUN = '<circle cx="104" cy="16" r="8" fill="#FFD27A"/>' + [0, 45, 90, 135, 180, 225, 270, 315]
  .map((a) => `<path d="M${polar([104, 16], a, 11)} L${polar([104, 16], a, 15)}" stroke="#FFD27A" stroke-width="2.2" stroke-linecap="round"/>`).join('');
const GRASS = '<ellipse cx="58" cy="70" rx="54" ry="17" fill="#6CBF6A"/><path d="M8 70 L108 70" stroke="#4E8E4A" stroke-width="1.6"/>';
const TRAIL = '<path d="M6 86 Q22 70 34 80 M14 96 Q30 84 42 92" stroke="#9AA6B8" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray="0.5 6"/>';
const FLOWER = '<path d="M24 8 A12 12 0 1 0 24 32 A9.5 9.5 0 1 1 24 8 Z" fill="#F6E7B0"/>'
  + '<path d="M60 100 L60 66" stroke="#5FA35A" stroke-width="3"/><ellipse cx="68" cy="88" rx="9" ry="3.6" fill="#6CBF6A" transform="rotate(-30 68 88)"/>'
  + [0, 72, 144, 216, 288].map((a) => {
    const r = (a * Math.PI) / 180, cx = (60 + 8 * Math.sin(r)).toFixed(1), cy = (64 - 8 * Math.cos(r)).toFixed(1);
    return `<ellipse cx="${cx}" cy="${cy}" rx="6" ry="9" fill="#F49AC1" transform="rotate(${a} ${cx} ${cy})"/>`;
  }).join('') + '<circle cx="60" cy="64" r="5.5" fill="#FFE07A"/>';
export function butterflyToday(state, filled = [], body = BODY_INK) {
  if (state === 'resting') return FLOWER + `<g transform="translate(30.4 9.3) scale(.562)">${butterflySide(filled, body)}</g>`;
  const wings = butterfly(filled, filled.length >= PANELS, body);
  if (state === 'flying') return TRAIL + `<g transform="rotate(-14 60 50) translate(6 2) scale(.9)">${wings}</g>`;
  return SUN + GRASS + `<g transform="translate(10 18) scale(.8)">${wings}</g>`;
}
