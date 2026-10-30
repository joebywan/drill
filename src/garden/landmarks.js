import { INK } from '../cast/kit.js';
import { move } from '../feel.js';
import { SIZE, visitor, pond } from './scene.js';

/**
 * The garden's landmarks, LANDMARKS in model.js: drawn into a scene by drawGarden (art.js).
 *
 *   layout(shape, taken, gifts, fresh) -> { back, front, life }   svg strings in the scene's units
 *       Lumi's pond (scene.js pond()) is every garden's, there before any landmark; the pond landmark
 *       is a frog joining it. The path and the fence lie behind the plants (`back`); every other piece takes the free spot
 *       nearest where it would like to be, clear of `taken` (the plants' boxes, which it adds to).
 *       The birdhouse brings a pair of birds, the nest a second pair, the hive two bees (`life`).
 *       In the home strip a piece with no room is left out; the tall view always has room.
 *   landmark(gift) -> svg string   a piece on its own, for "A frog joined Lumi at the pond" lines
 *   animateLandmarks(el) -> Animation[]   lanterns glow, the pond ripples, the frog hops
 */

const WOOD = '#B07A4A', DARK = '#7E5432';
const f = (v) => Math.round(v * 10) / 10;

// Each piece in its own units, top left at 0, 0: [width, height, svg].
const ART = {
  pond: [80, 34, `<ellipse cx="40" cy="18" rx="40" ry="16" fill="#4E8E6A"/><ellipse cx="40" cy="17" rx="36" ry="13" fill="#5FAED6"/>`
    + `<ellipse cx="32" cy="13" rx="16" ry="4" fill="#9FD5EE" data-part="ripple"/>`
    + `<circle cx="58" cy="20" r="6" fill="#5FA35A"/><path d="M58 20 L64 17 L64 23Z" fill="#5FAED6"/><circle cx="20" cy="22" r="5" fill="#5FA35A"/>`
    + `<circle cx="20" cy="21" r="2.4" fill="#F49AC1"/><circle cx="20" cy="21" r="1" fill="#FFE07A"/>`
    + `<g data-part="frog"><ellipse cx="57" cy="16" rx="5.5" ry="4" fill="#7CC26A"/><circle cx="54.5" cy="12.5" r="2" fill="#7CC26A"/><circle cx="59.5" cy="12.5" r="2" fill="#7CC26A"/>`
    + `<circle cx="54.5" cy="12.3" r=".9" fill="${INK}"/><circle cx="59.5" cy="12.3" r=".9" fill="${INK}"/></g>`],
  bench: [46, 28, `<rect x="2" y="0" width="42" height="4" rx="2" fill="${WOOD}"/><rect x="2" y="6" width="42" height="4" rx="2" fill="${WOOD}"/>`
    + `<rect x="6" y="0" width="3" height="28" fill="${DARK}"/><rect x="37" y="0" width="3" height="28" fill="${DARK}"/>`
    + `<rect x="0" y="15" width="46" height="5" rx="2" fill="${WOOD}"/><rect x="4" y="20" width="3" height="8" fill="${DARK}"/><rect x="39" y="20" width="3" height="8" fill="${DARK}"/>`],
  birdhouse: [22, 56, `<rect x="9" y="22" width="4" height="34" fill="${DARK}"/><rect x="2" y="10" width="18" height="16" fill="#E9C46A"/>`
    + `<path d="M0 11 L11 1 L22 11Z" fill="#C8553D"/><circle cx="11" cy="17" r="3.2" fill="${INK}"/>`],
  lantern: [11, 50, `<rect x="4" y="10" width="3" height="40" fill="#5B4A3A"/><path d="M0 2 h11 l-1.5 10 h-8Z" fill="#3D3530"/>`
    + `<circle cx="5.5" cy="7" r="9" fill="#FFD27A" opacity=".35" data-part="glow"/><rect x="2.5" y="3" width="6" height="8" rx="1" fill="#FFE3A0"/>`],
  beehive: [34, 40, `<rect x="2" y="30" width="30" height="4" fill="${DARK}"/><rect x="5" y="34" width="3" height="6" fill="${DARK}"/><rect x="26" y="34" width="3" height="6" fill="${DARK}"/>`
    + [0, 1, 2, 3, 4].map((i) => `<ellipse cx="17" cy="${f(26 - i * 5.2)}" rx="${f(15 - i * 2.2)}" ry="4.2" fill="${i % 2 ? '#E2B04E' : '#D29A35'}"/>`).join('')
    + `<ellipse cx="17" cy="27" rx="4" ry="3" fill="${INK}"/>`],
  // Seasonal events' gifts (events.js), which stay all year.
  stall: [44, 42, `<rect x="3" y="10" width="3" height="32" fill="${DARK}"/><rect x="38" y="10" width="3" height="32" fill="${DARK}"/><rect x="1" y="26" width="42" height="12" fill="${WOOD}"/>`
    + [0, 1, 2, 3].map((i) => `<rect x="${i * 11}" y="0" width="11" height="11" fill="${i % 2 ? '#FFF8E8' : '#E8743B'}"/>`).join('')
    + `<circle cx="11" cy="24" r="3.4" fill="#D9532F"/><circle cx="20" cy="24" r="3.4" fill="#F5C230"/><circle cx="31" cy="24" r="3.4" fill="#8E5BB5"/>`],
  pennant: [30, 56, `<rect x="3" y="0" width="3" height="56" fill="${DARK}"/><path d="M6 3 L30 11 L6 19Z" fill="#E8743B"/><path d="M6 9 L18 11 L6 14Z" fill="#FFF8E8"/><circle cx="4.5" cy="1.5" r="2.5" fill="#F5C230"/>`],
  scarecrow: [36, 56, `<rect x="16.5" y="12" width="3" height="44" fill="${DARK}"/><rect x="2" y="22" width="32" height="3" fill="${DARK}"/><path d="M9 20 h18 l2 18 h-22Z" fill="#C8553D"/>`
    + `<circle cx="18" cy="11" r="7" fill="#E9C46A"/><path d="M6 7 h24 l-5 -2 l-2 -5 h-10 l-2 5Z" fill="#7E5432"/><circle cx="15.5" cy="11" r="1" fill="${INK}"/><circle cx="20.5" cy="11" r="1" fill="${INK}"/>`],
  snowman: [32, 48, `<circle cx="16" cy="35" r="13" fill="#FFFFFF" stroke="#C7D7E2"/><circle cx="16" cy="16" r="9" fill="#FFFFFF" stroke="#C7D7E2"/><rect x="9" y="0" width="14" height="8" fill="${INK}"/><rect x="6" y="7" width="20" height="2.4" fill="${INK}"/>`
    + `<circle cx="13" cy="14" r="1.1" fill="${INK}"/><circle cx="19" cy="14" r="1.1" fill="${INK}"/><path d="M16 16 L23 17.5 L16 18.6Z" fill="#E8743B"/><path d="M8 24 q8 4 16 0 v3.4 q-8 4 -16 0Z" fill="#D9532F"/><circle cx="16" cy="33" r="1.1" fill="${INK}"/><circle cx="16" cy="39" r="1.1" fill="${INK}"/>`],
};
// Small stand-ins for the pieces that are drawn across the whole scene, for arrival lines.
const ICON = {
  path: [40, 22, [[8, 18, 7], [20, 11, 5.5], [31, 5, 4]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y + 1}" rx="${r * 1.5}" ry="${r * 0.7}" fill="#8F897D"/><ellipse cx="${x}" cy="${y}" rx="${r * 1.4}" ry="${r * 0.62}" fill="#D5CEC0"/>`).join('')],
  fence: [40, 24, `<rect x="0" y="9" width="40" height="3" fill="${DARK}"/><rect x="0" y="16" width="40" height="3" fill="${DARK}"/>`
    + [3, 15, 27].map((x) => `<path d="M${x} 24 V5 l3 -4 l3 4 V24Z" fill="${WOOD}"/>`).join('')],
};

/** A piece on its own, for an arrival line. The nest is its birds. */
export function landmark(gift) {
  if (gift === 'nest') return visitor('birds', 1);
  const [w, h, svg] = ART[gift] || ICON[gift] || ICON.path;
  return `<svg class="landmark landmark-${gift}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${svg}</svg>`;
}

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// Where each piece would like to stand, as fractions of the scene.
const WANT = { lumi: [0.8, 0.86], bench: [0.15, 0.36], birdhouse: [0.86, 0.33], beehive: [0.88, 0.62], lantern: [0.05, 0.45], lantern2: [0.95, 0.5], stall: [0.5, 0.42], pennant: [0.32, 0.33], scarecrow: [0.68, 0.36], snowman: [0.1, 0.62] };

export function layout(shape, taken, gifts, fresh = []) {
  const [W, H] = SIZE[shape] || SIZE.tall;
  const tall = H > 200;
  const hy = tall ? 120 : 66; // where the ground starts, as scene() draws it
  const k = tall ? 1 : 0.55;
  const has = new Set(gifts);
  const isNew = (gift) => (fresh.includes(`garden:${gift}`) ? ' data-new' : '');
  // ponytail: a grid scan for the nearest free spot, like perches(); a few thousand box tests a piece
  const plantsAt = taken.length; // the plants' boxes come first
  const free = ([fx, fy], w, h, behind = false) => {
    const clear = behind ? taken.slice(plantsAt) : taken;
    const want = { x: fx * W - w / 2, y: fy * H - h / 2 };
    let best = null, bd = Infinity;
    // A piece may stand back on the near hills, its foot no higher than just above the ground line.
    for (let y = Math.max(0, hy - 14 * k - h); y <= H - h; y += 3) {
      for (let x = 0; x <= W - w; x += 3) {
        const d = (x - want.x) ** 2 + (y - want.y) ** 2;
        if (d < bd) {
          const b = { x, y, w, h };
          if (!clear.some((t) => hit(b, t))) [best, bd] = [b, d];
        }
      }
    }
    if (best) taken.push(best);
    return best;
  };
  // A crowded garden makes a piece or a guest a little smaller rather than leave it out, and past
  // that (only the strip, or a dozen grown plants) stands it half behind the plants.
  const fit = (want, w, h, canHide = false) => {
    for (const z of [1, 0.8, 0.62, 0.48]) {
      const b = free(want, w * z, h * z);
      if (b) return { ...b, z };
    }
    const b = canHide && free(want, w * 0.62, h * 0.62, true);
    return b ? { ...b, z: 0.62, behind: true } : null;
  };
  // The frog sits on Lumi's lily pad, in the pond's own units.
  const frog = `<g data-landmark="pond"${isNew('pond')}><g transform="translate(-37 22)">${ART.pond[2].match(/<g data-part="frog">.*<\/g>/)[0]}</g></g>`;
  const piece = (gift, b, z) => `<g transform="translate(${f(b.x)} ${f(b.y)}) scale(${f(z * 100) / 100})"${gift === 'lumi' ? '' : ` data-landmark="${gift}"${isNew(gift)}`}>`
    + (gift === 'lumi' ? pond().replace('<svg ', '<svg width="80" height="50" ') + (has.has('pond') ? frog : '') : ART[gift][2]) + '</g>';
  const guest = (kind, species, b, gift) => (b ? visitor(kind, species)
    .replace('<svg ', `<svg x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" data-kind="${kind}"${isNew(gift)} `) : '');

  let back = '';
  if (has.has('fence')) {
    back += `<g data-landmark="fence"${isNew('fence')}><rect x="0" y="${f(hy - 2 * k)}" width="${W}" height="${f(3 * k)}" fill="${DARK}"/><rect x="0" y="${f(hy + 6 * k)}" width="${W}" height="${f(3 * k)}" fill="${DARK}"/>`;
    for (let x = 6 * k; x < W; x += 16 * k) back += `<path d="M${f(x)} ${f(hy + 14 * k)} V${f(hy - 7 * k)} l${f(3 * k)} ${f(-4 * k)} l${f(3 * k)} ${f(4 * k)} V${f(hy + 14 * k)}Z" fill="${WOOD}"/>`;
    back += '</g>';
  }
  if (has.has('path')) {
    // Stepping stones from the front edge to the back, getting smaller; one a plant stands on is left out.
    const stones = [];
    let s = '';
    for (let i = 0; i <= 13; i++) {
      const t = i / 13;
      const x = (1 - t) ** 2 * W * 0.5 + 2 * (1 - t) * t * W * 0.12 + t * t * W * 0.6;
      const y = (1 - t) ** 2 * (H + 4) + 2 * (1 - t) * t * (H * 0.62) + t * t * (hy + 8 * k);
      const r = (10 - 7 * t) * k;
      const box = { x: x - r * 1.5, y: y - r, w: r * 3, h: r * 2 };
      if (taken.some((b) => hit(box, b))) continue;
      s += `<ellipse cx="${f(x)}" cy="${f(y + r * 0.2)}" rx="${f(r * 1.5)}" ry="${f(r * 0.7)}" fill="#8F897D"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 1.4)}" ry="${f(r * 0.62)}" fill="#D5CEC0"/>`;
      stones.push(box);
    }
    back += `<g data-landmark="path"${isNew('path')}>${s}</g>`;
    taken.push(...stones);
  }

  let front = '', life = '';
  // A piece standing back on the hills is drawn behind the fence; one half behind the plants, before them.
  let far = '', hidden = '';
  const place = (gift, want = WANT[gift]) => {
    const [w, h] = gift === 'lumi' ? [80, 50] : ART[gift];
    const b = fit(want, w * k, h * k, tall);
    if (!b) return null;
    const svg = piece(gift, b, b.z * k);
    if (b.y + b.h < hy + 10 * k) far += svg; else if (b.behind) hidden += svg; else front += svg;
    return { ...b, z: b.z * k };
  };
  place('lumi');
  for (const gift of ['bench', 'birdhouse', 'beehive']) {
    if (!has.has(gift)) continue;
    const b = place(gift);
    if (!b) continue;
    if (gift === 'birdhouse') life += guest('birds', 0, fit([b.x / W - 0.08, (b.y + 48 * b.z) / H], 34 * k, 19 * k, tall), gift);
    if (gift === 'beehive') {
      for (const [dx, dy, sp] of [[-0.06, -0.06, 6], [0.07, -0.09, 7]]) life += guest('bee', sp, fit([(b.x + 17 * b.z) / W + dx, b.y / H + dy], 18 * k, 18 * k, tall), gift);
    }
  }
  for (const gift of ['stall', 'pennant', 'scarecrow', 'snowman']) if (has.has(gift)) place(gift);
  if (has.has('lantern')) { place('lantern'); place('lantern', WANT.lantern2); }
  if (has.has('nest')) life += guest('birds', 1, fit([0.3, 0.55], 34 * k, 19 * k, tall), 'nest');
  return { back: far + back + hidden, front, life };
}

/** Lanterns glow, the pond's ripple widens and fades, and the frog hops now and then. */
export function animateLandmarks(el) {
  if (!el?.querySelectorAll) return [];
  const all = (sel) => [...el.querySelectorAll(sel)];
  const centre = (g) => { if (g.style) Object.assign(g.style, { transformBox: 'fill-box', transformOrigin: 'center' }); return g; };
  return [
    ...all('[data-part="glow"]').map((g) => move(g, [{ opacity: 0.15 }, { opacity: 0.6 }], { duration: 1800 + Math.random() * 800, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' })),
    ...all('[data-part="ripple"]').map((g) => move(centre(g), [{ transform: 'scaleX(.8)', opacity: 0.9 }, { transform: 'scaleX(1.1)', opacity: 0.4 }], { duration: 2400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' })),
    ...all('[data-part="frog"]').map((g) => move(g, [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)', offset: 0.05 }, { transform: 'translateY(0)', offset: 0.1 }, { transform: 'translateY(0)' }], { duration: 4000, iterations: Infinity })),
    // A piece that has just arrived settles into place.
    ...all('[data-landmark][data-new]').map((g) => move(g, [{ opacity: 0 }, { opacity: 1 }], { duration: 1200, delay: 300, fill: 'backwards', easing: 'ease-out' })),
  ].filter(Boolean);
}
