import { INK } from './kit.js';

/**
 * The player's butterfly, seen from above. `butterfly(filled, full)` is the SVG body for a
 * 120 x 100 box: each wing is a fan of wedge panels from its root, clipped to the wing, and
 * `filled` colours them in fill order (left, right, left, …); `full` adds the dark edge and the
 * spots. Every call gets its own clip-path ids, so copies can share a page. So far only the app
 * icon draws it (tools/icon.js), every panel filled.
 */
const COL = { learn: '#4CAF73', calm: '#9B8CE0', move: '#F07A5A', reflect: '#F2B640' };
const ORDER = ['learn', 'learn', 'calm', 'learn', 'move', 'calm', 'learn', 'reflect', 'calm', 'learn', 'move', 'calm', 'learn', 'reflect'].map((h) => COL[h]);
const EMPTY = '#E0D6C3', EDGE = '#2B2638', VEIN = '#FBF8F2', SOFT = '#C7BBA3';

// The left half; the right half is its mirror.
const FORE = 'M57 36 C50 24 33 9 18 11 C7 12.5 4 27 10 38 C16 48 40 50 57 45 Z';
const HIND = 'M57 49 C45 48 25 53 21 66 C17 79 28 91 40 88 C51 85 56 70 57 56 Z';
// Panels are wedges from each wing's root between two angles (degrees); SEQ is one side's fill order.
const FROOT = [57, 40], HROOT = [57, 52];
const FW = [[100, 185], [185, 203], [203, 222], [222, 275]], HW = [[80, 118], [118, 145], [145, 275]];
const SEQ = [['f', 1], ['h', 1], ['f', 2], ['f', 0], ['h', 0], ['f', 3], ['h', 2]];
const polar = ([x, y], a, R = 90) => { const r = (a * Math.PI) / 180; return `${(x + R * Math.cos(r)).toFixed(1)} ${(y + R * Math.sin(r)).toFixed(1)}`; };
const panels = (root, fan, cs, part) => fan.map(([a, b], i) => {
  const k = SEQ.findIndex(([p, j]) => p === part && j === i);
  return `<path d="M${root.join(' ')} L${polar(root, a)} L${polar(root, b)} Z" fill="${cs[k] || EMPTY}"/>`;
}).join('') + fan.slice(1).map(([a]) => `<path d="M${root.join(' ')} L${polar(root, a)}" stroke="${VEIN}" stroke-width="1.5"/>`).join('');
const outline = (colour, width) => [FORE, HIND].map((d) => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linejoin="round"/>`).join('');
const DOTS = `<circle cx="11.5" cy="30" r="1.4" fill="#fff"/><circle cx="9" cy="23.5" r="1.2" fill="#fff"/><circle cx="14" cy="16.5" r="1.2" fill="#fff"/>`
  + `<circle cx="31" cy="82" r="3.2" fill="${EDGE}"/><circle cx="31" cy="82" r="1.6" fill="#F2D04A"/>`;
const BODY = `<rect x="57.6" y="36" width="4.8" height="36" rx="2.4" fill="${INK}"/><ellipse cx="60" cy="38" rx="4.2" ry="6.5" fill="${INK}"/>`
  + `<circle cx="60" cy="29" r="4.2" fill="${INK}"/>`
  + `<path d="M58.6 26 Q55 16 49 10 M61.4 26 Q65 16 71 10" stroke="${INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
  + `<circle cx="49" cy="10" r="2.2" fill="${INK}"/><circle cx="71" cy="10" r="2.2" fill="${INK}"/>`;

let uid = 0;
function wings(filled, full) {
  const sides = [[], []];
  filled.forEach((c, k) => sides[k % 2].push(c));
  const half = (cs) => {
    const id = `bf${++uid}`;
    return `<defs><clipPath id="${id}f"><path d="${FORE}"/></clipPath><clipPath id="${id}h"><path d="${HIND}"/></clipPath></defs>`
      + `<g clip-path="url(#${id}f)">${panels(FROOT, FW, cs, 'f')}</g><g clip-path="url(#${id}h)">${panels(HROOT, HW, cs, 'h')}</g>`
      + (full ? outline(EDGE, 2.8) + DOTS : outline(SOFT, 1.4));
  };
  return half(sides[0]) + `<g transform="translate(120 0) scale(-1 1)">${half(sides[1])}</g>`;
}

export const butterfly = (filled = ORDER, full = true) => wings(filled, full) + BODY;
