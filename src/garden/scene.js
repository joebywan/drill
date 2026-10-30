import { INK } from '../cast/kit.js';
import { lumi } from '../cast/lumi.js';
import { move } from '../feel.js';
import { SEASONS } from './season.js';

/**
 * The garden's backdrop and its visitors. Import from art.js, which re-exports all of this.
 *
 *   MOODS                   ['sunlit', 'morning', 'resting'], as model.js `mood()` returns them
 *   SIZE                    { strip: [360, 124], tall: [360, 390] }, the viewBox of each shape: little
 *                           sky, so the plants fill the view
 *   scene(mood, shape = 'tall', season = 'summer', event) -> svg string
 *       sky, sun or moon, two rows of hills and the ground. Resting
 *       is a warm evening with a moon and fireflies. The season (season.js) tints the land and adds
 *       its decoration: spring blossom, summer wildflowers, autumn falling leaves, winter frost and
 *       lanterns. A seasonal event's id (events.js) repaints the sky and the land and dresses the whole scene on top of that. Plants are never touched by either. Colours come from palette constants written into the svg as CSS, with a
 *       `prefers-color-scheme: dark` set, so one string works in both themes.
 *   slots(shape, n = 6) -> [{ x, y, w }]   up to MAX_PLANTS
 *       Where n plants go (1–12), in the scene's viewBox: (x, y) is the base of the plant and w its
 *       width. A scalable layout: one row spaced evenly across the strip (two past six), or in the
 *       tall view one row for up to 3 plants, two rows (back row first, smaller) up to 6, then three. Listed back to front,
 *       so drawing them in order layers them right.
 *   place(svg, slot) -> svg string   a plant drawn at a slot, to append inside the scene's svg
 *   VISITORS                ['butterfly', 'bee', 'birds', 'ladybird'], the gifts in model.js RULES
 *   visitor(kind, species) -> svg string   32 units tall (birds is a pair, 56 wide), in that species' colours
 *   animateVisitor(el, kind, fresh) -> Animation[] | null   flutter, hover or hop, the butterfly and bee wander,
 *                           and a fresh one flies in first; null under reduced motion
 *   pond() -> svg string   80 x 50: the pond where Lumi lounges, placed by art.js drawGarden()
 *   animateScene(el) -> Animation[]  clouds drift, the sun glows, dew glints, stars twinkle, fireflies wander
 */
export const MOODS = ['sunlit', 'morning', 'resting'];
export const SIZE = { strip: [360, 124], tall: [360, 390] };
/** Where the ground starts in each shape, under the hills. */
export const GROUND_Y = { strip: 66, tall: 120 };
/** The most plants a garden draws. A learner with more habits than this sees the first ones. */
export const MAX_PLANTS = 12;

// One palette per mood and theme. Plants keep their own colours; grounds stay mid-tone so a
// plant reads on both.
const PALETTE = {
  sunlit: {
    light: { sky: '#BFE3F7', band: '#DDF1FB', sun: '#FFD45C', halo: '#FFE9A3', cloud: '#FFFFFF', far: '#A9D69E', near: '#8DC47E', ground: '#7DB86A', shade: '#68A257', dot: '#FFFFFF' },
    dark: { sky: '#1D3550', band: '#27476A', sun: '#F5C542', halo: '#5A5A48', cloud: '#34506D', far: '#2D5745', near: '#2F6646', ground: '#2E5E3B', shade: '#244E30', dot: '#CFE8FF' },
  },
  morning: {
    light: { sky: '#F7E4D4', band: '#FCEFD9', sun: '#FFB86B', halo: '#FFD9AE', cloud: '#FFFFFF', far: '#BBD4B0', near: '#9DC590', ground: '#8CBB78', shade: '#78A766', dot: '#FFFFFF' },
    dark: { sky: '#2B3150', band: '#4A3E5C', sun: '#E59A55', halo: '#6B4E50', cloud: '#525B7A', far: '#384E48', near: '#33604A', ground: '#2F5A3D', shade: '#274D33', dot: '#B9C3DD' },
  },
  resting: {
    light: { sky: '#D8CCEC', band: '#F5D3C4', sun: '#FFF4D2', halo: '#EFE3F6', cloud: '#FFFFFF', far: '#A3B9AB', near: '#86A992', ground: '#7BA47E', shade: '#6A936E', dot: '#F2E04F' },
    dark: { sky: '#1E2142', band: '#3B3058', sun: '#F3E7B8', halo: '#3A3C5C', cloud: '#E8E3C8', far: '#2A4241', near: '#284B3F', ground: '#244135', shade: '#1D372C', dot: '#E7F27A' },
  },
};

// Each season retints the land and the pond over the mood's palette; summer is the full colour.
// Decoration colours (blossom, leaves, lanterns) are fixed, like the plants'.
const SEASON = {
  spring: { light: { far: '#B3DCA0', near: '#98D184', ground: '#88C873', pond: '#8FCBE8' }, dark: { far: '#2E5C44', near: '#326C47', ground: '#30633C', pond: '#2D5878' } },
  summer: { light: { pond: '#7CC0E3' }, dark: { pond: '#285473' } },
  autumn: { light: { far: '#D8BC7E', near: '#CDA562', ground: '#A9B565', shade: '#94984E', pond: '#86B6CC' }, dark: { far: '#4F4930', near: '#5A4E2D', ground: '#46512F', shade: '#3A4327', pond: '#2A4A60' } },
  winter: { light: { far: '#D9E6EE', near: '#C6D9E2', ground: '#ADC8B9', shade: '#97B3A4', pond: '#CFE6F2' }, dark: { far: '#344452', near: '#2F414B', ground: '#2C4541', shade: '#243934', pond: '#4A6578' } },
};
// A seasonal event repaints more than a season does, the sky included.
const EVENT = {
  'spring-market': { light: { sky: '#FFE0EA', band: '#FFF1C4', far: '#BFE3A6', near: '#A5DA8A', ground: '#93D277' }, dark: { sky: '#2B2244', band: '#50335C', far: '#31604A', near: '#35704C', ground: '#336A40' } },
  'summer-tournament': { light: { sky: '#86D0F5', band: '#FFF0B0', far: '#8ED07C', near: '#78C766', ground: '#6CC058', shade: '#57A848' }, dark: { sky: '#12294C', band: '#2B4C60', far: '#25593F', near: '#286A3F', ground: '#2A6E3A', shade: '#215A2E' } },
  'autumn-harvest': { light: { sky: '#F5C088', band: '#FCE2AE', far: '#CB8C47', near: '#BC7631', ground: '#AE8C3E', shade: '#94752F' }, dark: { sky: '#2A1B2C', band: '#58331F', far: '#5C3B20', near: '#50301A', ground: '#493C1D', shade: '#3A2F16' } },
  'winter-festival': { light: { sky: '#B5C6E3', band: '#E9DDEB', far: '#EEF3F8', near: '#E2EBF3', ground: '#F4F8FB', shade: '#C7D7E2', pond: '#D4E7F2' }, dark: { sky: '#131A36', band: '#2C3359', far: '#56677F', near: '#4B5D73', ground: '#5B6E83', shade: '#43556B', pond: '#6C8BA1' } },
};
const RIM = { light: '#A7A39A', dark: '#5D5A55' };

const css = (mood, season, event) => {
  const scope = `.garden-${mood}.season-${season}`;
  const rules = (p) => Object.entries(p).map(([k, v]) => `${scope} .g-${k}{fill:${v}}`).join('');
  const theme = (t) => rules({ ...PALETTE[mood][t], ...SEASON[season][t], ...EVENT[event]?.[t], rim: RIM[t] });
  // The frost line is a stroke: white in the light, a dim blue-grey haze in the dark.
  const frost = (t) => `${scope} .g-frost{stroke:${t === 'dark' ? '#9FB4C6' : '#FFFFFF'};opacity:${t === 'dark' ? 0.35 : 0.7}}`;
  return `<style>${theme('light')}${frost('light')}@media (prefers-color-scheme: dark){${theme('dark')}${frost('dark')}}</style>`;
};

/** The season's own touches over the land, all tagged for animateScene(). */
const touches = (season, W, H, hy, k, rand, tall) => {
  const n = (strip, full) => (tall ? full : strip);
  const any = (fn, count) => Array.from({ length: count }, fn).join('');
  const onGrass = () => [f(rand() * W), f(hy + 10 + rand() * (H - hy - 16))];
  if (season === 'spring') {
    // Blossom: pink clusters along the near hill, and a few petals on the air.
    return any(() => {
      const x = f(rand() * W), y = f(hy - 12 * k + rand() * 6 * k), c = ['#F7A8C4', '#FBD3E0', '#F28CB1'][Math.floor(rand() * 3)];
      return `<g fill="${c}"><circle cx="${x}" cy="${y}" r="${f(3 * k)}"/><circle cx="${f(x + 3 * k)}" cy="${f(y + 1.5 * k)}" r="${f(2.4 * k)}"/><circle cx="${f(x - 2.6 * k)}" cy="${f(y + 1.8 * k)}" r="${f(2.2 * k)}"/></g>`;
    }, n(7, 12)) + any(() => `<ellipse data-part="petal" fill="#F7B6CE" cx="${f(rand() * W)}" cy="${f(rand() * hy * 0.8)}" rx="2.4" ry="1.5"/>`, n(5, 10));
  }
  if (season === 'summer') {
    // Full colour: wildflowers through the grass.
    return any(() => { const [x, y] = onGrass(); return `<circle fill="${['#F5C230', '#F28C8C', '#FFFFFF', '#B58BE0'][Math.floor(rand() * 4)]}" cx="${x}" cy="${y}" r="1.8"/>`; }, n(10, 24));
  }
  if (season === 'autumn') {
    // Falling leaves, and a few already on the grass.
    const leaf = (x, y, c, tag = '') => `<path${tag} fill="${c}" d="M${x} ${y - 3} Q${x + 3} ${y} ${x} ${y + 3} Q${x - 3} ${y} ${x} ${y - 3}Z"/>`;
    const colour = () => ['#E8743B', '#D9532F', '#F2B53A', '#B5652A'][Math.floor(rand() * 4)];
    return any(() => { const [x, y] = onGrass(); return leaf(x, y, colour()); }, n(6, 14))
      + any(() => leaf(f(rand() * W), f(rand() * hy * 0.9), colour(), ' data-part="leaf"'), n(5, 10));
  }
  // Winter: frost on the hilltops and grass, and paper lanterns glowing on their posts.
  const frost = any(() => { const [x, y] = onGrass(); return `<path fill="#FFFFFF" opacity=".8" d="M${x - 3} ${y} L${x} ${f(y - 4)} L${x + 3} ${y}Z"/>`; }, n(10, 22))
    + `<path d="M0 ${f(hy - 26 * k)} Q${W / 2} ${f(hy - 36 * k)} ${W} ${f(hy - 24 * k)}" class="g-frost" stroke-width="${f(2 * k)}" fill="none" stroke-linecap="round"/>`;
  const lantern = (x, y) => `<path d="M${x} ${y} L${x} ${f(y + 22 * k)}" stroke="#6B4C33" stroke-width="${f(1.4 * k)}"/>`
    + `<circle data-part="lantern" fill="#FFD978" opacity=".35" cx="${x}" cy="${f(y + 2 * k)}" r="${f(7 * k)}"/>`
    + `<rect fill="#E8743B" x="${f(x - 3.4 * k)}" y="${f(y - 3 * k)}" width="${f(6.8 * k)}" height="${f(9 * k)}" rx="${f(2.6 * k)}"/>`
    + `<rect fill="#FFD978" x="${f(x - 1.6 * k)}" y="${f(y - 1 * k)}" width="${f(3.2 * k)}" height="${f(5 * k)}" rx="1"/>`;
  return frost + [0.18, 0.5, 0.82].map((t) => lantern(f(W * t), f(hy - 8 * k))).join('');
};

/** A line of little flags sagging across the scene, at height y. */
const bunting = (W, y, k, colours, count) => {
  const at = (t) => [W * t, y + 14 * k * 4 * t * (1 - t)];
  const flags = Array.from({ length: count }, (_, i) => {
    const [x, fy] = at((i + 0.5) / count);
    return `<path fill="${colours[i % colours.length]}" d="M${f(x - 4 * k)} ${f(fy)} L${f(x + 4 * k)} ${f(fy)} L${f(x)} ${f(fy + 9 * k)}Z"/>`;
  }).join('');
  return `<path d="M0 ${f(y)} Q${W / 2} ${f(y + 28 * k)} ${W} ${f(y)}" stroke="#7E5432" stroke-width="${f(0.8 * k)}" fill="none"/>${flags}`;
};

/** What an event lays over the whole scene, under the plants. */
const dressing = (event, W, H, hy, k, rand, tall) => {
  const count = (strip, full) => (tall ? full : strip);
  const many = (fn, n) => Array.from({ length: n }, (_, i) => fn(i)).join('');
  const onGrass = () => [f(rand() * W), f(hy + 8 + rand() * (H - hy - 14))];
  if (event === 'spring-market') {
    const awning = (x) => `<rect fill="#FFF8E8" x="${f(x)}" y="${f(hy - 14 * k)}" width="${f(26 * k)}" height="${f(12 * k)}"/>`
      + many((i) => `<rect fill="${i % 2 ? '#FFFFFF' : '#E8743B'}" x="${f(x - 2 * k + i * 6 * k)}" y="${f(hy - 20 * k)}" width="${f(6 * k)}" height="${f(7 * k)}"/>`, 5);
    return bunting(W, 8 * k, k, ['#F28CB1', '#F5C230', '#7CC0E3', '#FFFFFF'], count(14, 16)) + [0.08, 0.42, 0.78].map((t) => awning(W * t)).join('')
      + many(() => `<ellipse data-part="petal" fill="#F7B6CE" cx="${f(rand() * W)}" cy="${f(rand() * hy)}" rx="2.4" ry="1.5"/>`, count(8, 16));
  }
  if (event === 'summer-tournament') {
    // Mown stripes, a giant board on the lawn and pennants along the hill.
    const stripes = many((i) => `<rect fill="#FFFFFF" opacity=".1" x="${f((i * 2 * W) / 10)}" y="${f(hy + 6)}" width="${f(W / 10)}" height="${f(H - hy - 6)}"/>`, 5);
    const s = 9 * k, x0 = W * 0.04, y0 = H - 6 * s;
    const squares = many((i) => {
      const c = i % 6, r = Math.floor(i / 6);
      return `<rect fill="${(c + r) % 2 ? '#FFF8E8' : '#3D5A45'}" opacity=".75" x="${f(x0 + c * s)}" y="${f(y0 + r * s * 0.7)}" width="${f(s)}" height="${f(s * 0.7)}"/>`;
    }, tall ? 36 : 0);
    const flag = (x, c) => `<path d="M${f(x)} ${f(hy - 2 * k)} V${f(hy - 28 * k)}" stroke="#7E5432" stroke-width="${f(k)}"/><path fill="${c}" d="M${f(x)} ${f(hy - 28 * k)} L${f(x + 12 * k)} ${f(hy - 24 * k)} L${f(x)} ${f(hy - 20 * k)}Z"/>`;
    return stripes + squares + many((i) => flag(W * (0.06 + i * 0.125), ['#E8743B', '#F5C230', '#4C8FD6', '#D9532F'][i % 4]), 8);
  }
  if (event === 'autumn-harvest') {
    const pumpkin = (x, y, z) => `<ellipse fill="#E8743B" cx="${x}" cy="${y}" rx="${f(6 * z)}" ry="${f(4.6 * z)}"/><ellipse fill="#F08C4A" cx="${x}" cy="${y}" rx="${f(2.6 * z)}" ry="${f(4.6 * z)}"/><rect fill="#5F7A3A" x="${f(x - 0.8 * z)}" y="${f(y - 6 * z)}" width="${f(1.6 * z)}" height="${f(2.2 * z)}"/>`;
    const bale = (x) => `<rect fill="#E2B85C" x="${f(x)}" y="${f(hy - 15 * k)}" width="${f(18 * k)}" height="${f(11 * k)}" rx="${f(2 * k)}"/><path d="M${f(x + 6 * k)} ${f(hy - 15 * k)} v${f(11 * k)} M${f(x + 12 * k)} ${f(hy - 15 * k)} v${f(11 * k)}" stroke="#B98F3E" stroke-width="${f(0.8 * k)}"/>`;
    return [0.12, 0.5, 0.86].map((t) => bale(W * t)).join('') + many(() => { const [x, y] = onGrass(); return pumpkin(x, y, tall ? 1.3 : 0.9); }, count(7, 12))
      + many(() => `<path data-part="leaf" fill="#D9532F" d="M0 -3 Q3 0 0 3 Q-3 0 0 -3Z" transform="translate(${f(rand() * W)} ${f(rand() * hy)})"/>`, count(6, 12));
  }
  if (event === 'winter-festival') {
    const lights = many((i) => {
      const t = (i + 0.5) / count(14, 18);
      return `<circle data-part="lantern" fill="${['#FFD978', '#F28C8C', '#8FD3F5'][i % 3]}" cx="${f(W * t)}" cy="${f(10 * k + 14 * k * 4 * t * (1 - t) + 1.5 * k)}" r="${f(2 * k)}"/>`;
    }, count(14, 18));
    return `<path d="M0 ${f(10 * k)} Q${W / 2} ${f(38 * k)} ${W} ${f(10 * k)}" stroke="#5B4A3A" stroke-width="${f(0.8 * k)}" fill="none"/>${lights}`
      + many(() => `<circle data-part="petal" fill="#FFFFFF" cx="${f(rand() * W)}" cy="${f(rand() * (hy + 30))}" r="${f(1 + rand() * 1.4)}"/>`, count(16, 36));
  }
  return '';
};

// A small seeded random, so a scene draws the same every time.
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const f = (v) => Math.round(v * 10) / 10;

/** A rolling hill line across the width at height y, as a filled shape down to the bottom. */
const hills = (W, H, y, amp, waves, phase, cls) => {
  let d = `M0 ${H} L0 ${f(y)}`;
  for (let x = 0; x <= W; x += 12) d += ` L${x} ${f(y - amp * Math.sin((x / W) * Math.PI * waves + phase))}`;
  return `<path class="g-${cls}" d="${d} L${W} ${H}Z"/>`;
};

const cloud = (x, y, s) => `<g class="g-cloud" data-part="cloud">`
  + `<circle cx="${x}" cy="${y}" r="${7 * s}"/><circle cx="${x + 9 * s}" cy="${y - 4 * s}" r="${9 * s}"/>`
  + `<circle cx="${x + 19 * s}" cy="${y}" r="${7 * s}"/><rect x="${x}" y="${y}" width="${19 * s}" height="${7 * s}"/></g>`;

const spark = (x, y, s) =>
  `<path class="g-dot" data-part="glint" d="M${x} ${y - s} L${f(x + s * 0.25)} ${f(y - s * 0.25)} L${x + s} ${y} L${f(x + s * 0.25)} ${f(y + s * 0.25)} L${x} ${y + s} L${f(x - s * 0.25)} ${f(y + s * 0.25)} L${x - s} ${y} L${f(x - s * 0.25)} ${f(y - s * 0.25)}Z"/>`;

/**
 * The pond where Lumi lounges, at the edge, half in the water: an svg 80 x 50, the water's
 * middle at (40, 40). drawGarden() puts it on clear ground. Its water takes the season's colour
 * (frozen pale in winter) from the scene's style; Lumi is the same seal as on the path, content.
 */
export const pond = () => `<svg class="pond" viewBox="0 0 80 50" overflow="visible" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
  + `<ellipse class="g-rim" cx="40" cy="41.5" rx="39" ry="8.5"/><ellipse class="g-pond" cx="40" cy="40" rx="35" ry="6.5"/>`
  + `<ellipse fill="#5FA35A" cx="20" cy="41" rx="6" ry="2.2"/><circle fill="#F7A8C4" cx="21" cy="39.6" r="1.6"/>`
  + `<g data-part="lounge">${lumi('sleepy').replace('<svg ', '<svg x="38" y="6" width="30" height="36" ')}`
  + `<ellipse class="g-pond" cx="53" cy="41.4" rx="14" ry="3.6"/></g>`
  + `<path d="M28 42 q4 -1.4 8 0" stroke="#FFFFFF" stroke-width="1" fill="none" opacity=".6" stroke-linecap="round"/></svg>`;

export function scene(mood = 'morning', shape = 'tall', season = 'summer', event = null) {
  const e = EVENT[event] ? event : null;
  const m = PALETTE[mood] ? mood : 'morning';
  const s = SEASONS.includes(season) ? season : 'summer';
  const [W, H] = SIZE[shape] || SIZE.tall;
  const tall = H > 200;
  const hy = GROUND_Y[tall ? 'tall' : 'strip'];
  const k = tall ? 1.8 : 1;            // sun, clouds and hills scale with the view
  const rand = seeded(tall ? 7 : 3);
  let sky = `<rect class="g-sky" width="${W}" height="${H}"/><rect class="g-band" y="${f(hy - 50 * k)}" width="${W}" height="${f(60 * k)}"/>`;
  if (m === 'sunlit') {
    sky += `<circle class="g-halo" data-part="halo" cx="${W - 56}" cy="${f(30 * k)}" r="${f(22 * k)}"/><circle class="g-sun" cx="${W - 56}" cy="${f(30 * k)}" r="${f(14 * k)}"/>`
      + cloud(40, f(26 * k), k * 0.9) + cloud(150, f(44 * k), k * 0.7);
  } else if (m === 'morning') {
    // A low sun just over the far hills, and a little mist.
    sky += `<circle class="g-halo" data-part="halo" cx="80" cy="${f(hy - 22 * k)}" r="${f(26 * k)}"/><circle class="g-sun" cx="80" cy="${f(hy - 22 * k)}" r="${f(17 * k)}"/>`
      + cloud(220, f(hy - 54 * k), k * 0.7);
  } else {
    // Evening: a crescent moon and a few early stars.
    const mx = W - 64, my = f(28 * k);
    sky += `<circle class="g-sun" cx="${mx}" cy="${my}" r="${f(12 * k)}"/>`
      + `<circle class="g-sky" cx="${f(mx + 6 * k)}" cy="${f(my - 4 * k)}" r="${f(10 * k)}"/>`
      + Array.from({ length: tall ? 12 : 6 }, () => `<circle class="g-cloud" data-part="star" cx="${f(rand() * W)}" cy="${f(rand() * (hy - 60 * k))}" r="${f(0.8 + rand())}"/>`).join('');
  }
  const land = hills(W, H, hy - 26 * k, 8 * k, 3, 0.6, 'far') + hills(W, H, hy - 10 * k, 7 * k, 2, 2.2, 'near')
    + `<path class="g-ground" d="M0 ${hy} Q${W / 2} ${f(hy - 8 * k)} ${W} ${hy} L${W} ${H} L0 ${H}Z"/>`
    + Array.from({ length: tall ? 22 : 9 }, () => {
      const x = f(rand() * W), y = f(hy + 10 + rand() * (H - hy - 14));
      return `<path class="g-shade" data-part="tuft" data-x="${x}" d="M${x - 3} ${y} L${x - 1} ${y - 6} L${x} ${y - 1} L${x + 1.5} ${y - 7} L${x + 3} ${y}Z"/>`;
    }).join('');
  // Sunlit is dewy: a few glints on the grass. Resting has fireflies, warm and slow.
  const life = m === 'sunlit'
    ? Array.from({ length: tall ? 8 : 4 }, () => spark(f(rand() * W), f(hy + 12 + rand() * (H - hy - 20)), 2.5)).join('')
    : m === 'resting'
      ? Array.from({ length: tall ? 12 : 6 }, () => {
        const x = f(rand() * W), y = f(hy - 30 * k + rand() * (H - hy + 10 * k));
        return `<g data-part="firefly"><circle class="g-dot" cx="${x}" cy="${y}" r="5" opacity=".28"/><circle class="g-dot" cx="${x}" cy="${y}" r="1.8"/></g>`;
      }).join('')
      : '';
  const decor = touches(s, W, H, hy, k, seeded(tall ? 11 : 5), tall) + (e ? dressing(e, W, H, hy, k, seeded(tall ? 13 : 17), tall) : '');
  return `<svg class="garden-scene garden-${m} season-${s}${e ? ` event-${e}` : ''} garden-${tall ? 'tall' : 'strip'}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
    + `${css(m, s, e)}${sky}${land}${decor}${life}</svg>`;
}

export function slots(shape = 'tall', n = 6) {
  const count = Math.max(1, Math.min(MAX_PLANTS, Math.floor(n) || 1));
  const [W] = SIZE.tall;
  const row = (k, y, wMax) => Array.from({ length: k }, (_, i) => ({ x: f((W * (i + 0.5)) / k), y, w: f(Math.min(wMax, W / k)) }));
  // Past six, plants go in rows from back to front; a back row takes any extra plant, so the
  // front row's fewer plants can be bigger.
  const rows = (ys, wMax) => {
    const out = [];
    let left = count;
    ys.forEach((y, i) => {
      const k = Math.ceil(left / (ys.length - i));
      out.push(...row(k, y, wMax[i]));
      left -= k;
    });
    return out;
  };
  if (shape === 'strip') return count <= 6 ? row(count, 112, 80) : rows([84, 120], [56, 64]);
  if (count <= 3) return row(count, 350, 150);
  return count <= 6 ? rows([232, 364], [120, 150]) : rows([180, 272, 364], [90, 105, 120]);
}

/** Draws a plant svg (100 x 120, base at 50, 106) at a slot, as a nested svg. */
export const place = (svg, { x, y, w }) =>
  svg.replace('<svg ', `<svg x="${f(x - w / 2)}" y="${f(y - w * 1.06)}" width="${w}" height="${f(w * 1.2)}" `);

// --- Visitors -------------------------------------------------------------------------------

export const VISITORS = ['butterfly', 'bee', 'birds', 'ladybird'];

// Species: each habit's butterfly and bee is its own, so a garden of them never repeats (the 13th
// habit's matches the first's). [upper wings, lower wings, spots]; a bee's [body, stripes].
export const BUTTERFLIES = [
  ['#F28B30', '#F7B548', '#FFF6E0'], ['#3E8EDE', '#7BB8F0', '#E6F3FF'], ['#F5D547', '#FBE88A', '#FFFFFF'],
  ['#F4F1EA', '#E2DCCF', '#3A3A3A'], ['#C8423A', '#E07A5F', '#3C5BA8'], ['#F08BB5', '#F7B8D2', '#FFFFFF'],
  ['#6CBF6A', '#A2D99A', '#FFFFFF'], ['#7A5BC7', '#A98CE0', '#F3E9FF'], ['#E06A2B', '#8C4A2F', '#FFE08A'],
  ['#2FA8A0', '#7FD3C8', '#FFFFFF'], ['#B5884A', '#D9B57A', '#3A2A1A'], ['#E84E7A', '#F59AB5', '#FFE3EC'],
];
export const BEES = [
  ['#F5C230', INK], ['#E3A33A', '#6B3F1D'], ['#E0533A', INK], ['#4FA36B', INK], ['#D27D3A', '#5A3A22'], ['#5C6BC0', INK],
  ['#F2D27A', '#7A5A2A'], ['#E8E2D0', INK], ['#B6D35A', '#2F4A1E'], ['#E87FA0', INK], ['#7FC6E8', INK], ['#C9A0DC', INK],
];
// Pairs of birds, [body, wing, breast, cheek?] each: a robin and a blue tit, then a goldfinch and a wren.
export const BIRDS = [
  [['#8B6648', '#6B4C33', '#E8743B'], ['#5E95D6', '#3F6FB0', '#F4CF45', '#FFFFFF']],
  [['#C8A060', '#8A6A3A', '#E5413A', '#FFFFFF'], ['#9A7A5A', '#6E5338', '#D8B98E']],
];
const pick = (list, i) => list[(Math.floor(i) || 0) % list.length] || list[0];

const butterfly = (i) => {
  const [up, low, spot] = pick(BUTTERFLIES, i);
  return `<g data-part="wings">`
  + `<ellipse cx="9.5" cy="11.5" rx="7" ry="6" fill="${up}" transform="rotate(-20 9.5 11.5)"/><ellipse cx="22.5" cy="11.5" rx="7" ry="6" fill="${up}" transform="rotate(20 22.5 11.5)"/>`
  + `<ellipse cx="11" cy="20.5" rx="4.6" ry="4" fill="${low}"/><ellipse cx="21" cy="20.5" rx="4.6" ry="4" fill="${low}"/>`
  + `<circle cx="8" cy="10.5" r="1.8" fill="${spot}"/><circle cx="24" cy="10.5" r="1.8" fill="${spot}"/></g>`
  + `<rect x="14.8" y="8.5" width="2.4" height="16" rx="1.2" fill="${INK}"/>`
  + `<path d="M15.4 9 Q13.5 5 11 3.6 M16.6 9 Q18.5 5 21 3.6" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round"/>`
  + `<circle cx="11" cy="3.6" r="1" fill="${INK}"/><circle cx="21" cy="3.6" r="1" fill="${INK}"/>`;
};

const bee = (i) => {
  const [body, stripe] = pick(BEES, i);
  return `<g data-part="body">`
  + `<ellipse cx="13.5" cy="9.5" rx="4" ry="5.6" fill="#CFE6F7" transform="rotate(-22 13.5 9.5)"/><ellipse cx="19" cy="10" rx="3.6" ry="5" fill="#B8DAF2" transform="rotate(18 19 10)"/>`
  + `<path d="M24.5 17.4 L29 18.6 L24.6 20Z" fill="${INK}"/>`
  + `<ellipse cx="17" cy="18.5" rx="8.6" ry="6.6" fill="${body}"/>`
  + `<ellipse cx="15.6" cy="18.5" rx="1.6" ry="6.3" fill="${stripe}"/><ellipse cx="20.4" cy="18.5" rx="1.5" ry="5.6" fill="${stripe}"/>`
  + `<circle cx="8.5" cy="17.5" r="4.6" fill="${INK}"/><circle cx="7.4" cy="16.4" r="1.3" fill="#FFFFFF"/>`
  + `<path d="M7.5 13.4 Q6 10 4 9.2" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round"/></g>`;
};

// A robin and a blue tit: round bodies, a beak, a bright breast. Each one hops on its own.
const bird = (dx, [body, wing, breast, cheek]) =>
  `<g transform="translate(${dx} 0)"><g data-part="bird">`
  + `<path d="M8 17 L1.5 13 L2.5 19.5Z" fill="${wing}"/>`
  + `<path d="M13 26 L13 30 M17.5 26 L17.5 30" stroke="#C9894A" stroke-width="1.3" stroke-linecap="round"/>`
  + `<circle cx="15" cy="18.5" r="8.5" fill="${body}"/><circle cx="21" cy="12" r="5.6" fill="${body}"/>`
  + `<ellipse cx="19.8" cy="18" rx="5" ry="5.6" fill="${breast}"/>`
  + (cheek ? `<ellipse cx="22.5" cy="13" rx="2.8" ry="2.2" fill="${cheek}"/>` : '')
  + `<ellipse cx="12" cy="18.5" rx="5.6" ry="3.8" fill="${wing}" transform="rotate(-15 12 18.5)"/>`
  + `<path d="M26 11.2 L30 12.6 L26 14Z" fill="#F2B53A"/>`
  + `<circle cx="22.6" cy="10.8" r="1.4" fill="${INK}"/><circle cx="23" cy="10.4" r=".45" fill="#FFFFFF"/></g></g>`;

const birds = (i) => { const [a, b] = pick(BIRDS, i); return bird(0, a) + bird(24, b); };

// The comeback's visitor (src/fitting.js): a ladybird seen from above, crawling about the plant's foot.
const ladybird = () =>
  `<path d="M7 15 L3.5 13.5 M6.5 21 L2.5 21.5 M8 26 L4.5 28.5 M25 15 L28.5 13.5 M25.5 21 L29.5 21.5 M24 26 L27.5 28.5" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`
  + `<path d="M14 6.5 Q12.5 3 10 2.4 M18 6.5 Q19.5 3 22 2.4" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round"/>`
  + `<circle cx="16" cy="9" r="4.6" fill="${INK}"/><circle cx="14.2" cy="7.8" r="1" fill="#FFFFFF"/><circle cx="17.8" cy="7.8" r="1" fill="#FFFFFF"/>`
  + `<g data-part="shell"><ellipse cx="16" cy="19.5" rx="10" ry="9.5" fill="#E0412F"/><ellipse cx="13" cy="15" rx="3" ry="2" fill="#F07A68"/>`
  + `<path d="M16 10.5 L16 29" stroke="${INK}" stroke-width="1.2"/>`
  + `<circle cx="11.2" cy="17.5" r="1.9" fill="${INK}"/><circle cx="20.8" cy="17.5" r="1.9" fill="${INK}"/><circle cx="11.5" cy="24" r="1.6" fill="${INK}"/><circle cx="20.5" cy="24" r="1.6" fill="${INK}"/></g>`;

const DRAW = { butterfly, bee, birds, ladybird };

/** `species` picks the colours (see BUTTERFLIES, BEES, BIRDS); 0 is the first. */
export function visitor(kind = 'butterfly', species = 0) {
  const k = DRAW[kind] ? kind : 'butterfly';
  const w = k === 'birds' ? 56 : 32;
  return `<svg class="visitor visitor-${k}" viewBox="0 0 ${w} 32" overflow="visible" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g data-part="drift">${DRAW[k](species)}</g></svg>`;
}

const loop = { iterations: Infinity, easing: 'ease-in-out' };
const MOTION = {
  // Wings fold and open quickly, with a rest between beats.
  butterfly: ['[data-part="wings"]', [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.3)', offset: 0.12 }, { transform: 'scaleX(1)', offset: 0.24 }, { transform: 'scaleX(1)' }], { duration: 1400, ...loop }],
  bee: ['[data-part="body"]', [{ transform: 'translate(0, 0) rotate(0deg)' }, { transform: 'translate(0, -2px) rotate(-4deg)' }, { transform: 'translate(0, 0) rotate(0deg)' }], { duration: 1100, ...loop }],
  birds: ['[data-part="bird"]', [{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)', offset: 0.1 }, { transform: 'translateY(0)', offset: 0.2 }, { transform: 'translateY(0)' }], { duration: 2400, ...loop }],
  ladybird: ['[data-part="shell"]', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-4deg)', offset: 0.3 }, { transform: 'rotate(3deg)', offset: 0.6 }, { transform: 'rotate(0deg)' }], { duration: 2600, ...loop }],
};

// The butterfly and the bee also wander about their perch, in the visitor's own units.
const WANDER = {
  butterfly: [[0, 0], [-18, -10], [-8, -22], [10, -16], [16, -4], [6, 4], [0, 0]],
  bee: [[0, 0], [10, -4], [16, 2], [6, 6], [-8, 0], [-12, -6], [0, 0]],
  ladybird: [[0, 0], [6, -1], [12, 0], [6, 1], [0, 0]],
};
// A visitor that has just arrived flies in from up and to one side.
const ARRIVE = { butterfly: [-90, -60], bee: [90, -50], birds: [-70, -40], ladybird: [80, -50] };

/** `fresh` makes it fly in first, from off its perch: for what arrived this session. */
export function animateVisitor(el, kind, fresh = false) {
  if (!MOTION[kind] || !el?.querySelectorAll) return null;
  const [sel, frames, opts] = MOTION[kind];
  const anims = [...el.querySelectorAll(sel)].map((part, i) => {
    if (part.style) Object.assign(part.style, { transformBox: 'fill-box', transformOrigin: 'center' });
    // The second bird hops a little after the first.
    return move(part, frames, { ...opts, delay: i * 700 });
  });
  const drift = el.querySelector('[data-part="drift"]');
  if (WANDER[kind]) {
    anims.push(move(drift, WANDER[kind].map(([x, y]) => ({ transform: `translate(${x}px, ${y}px)` })),
      { duration: 6000 + Math.random() * 3000, delay: -Math.random() * 7000, iterations: Infinity, easing: 'ease-in-out' }));
  }
  if (fresh) {
    const [x, y] = ARRIVE[kind];
    anims.push(move(drift, [{ transform: `translate(${x}px, ${y}px)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'translate(0, 0)', opacity: 1 }],
      { duration: 1800, delay: 300, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards', composite: 'add' }));
  }
  const live = anims.filter(Boolean);
  return live.length ? live : null;
}

// The scene's own life, each part on its own clock so nothing moves in step:
// [selector, frames, base duration ms, transform origin (null for none)].
const LIFE = [
  ['[data-part="cloud"]', [{ transform: 'translateX(-45px)' }, { transform: 'translateX(45px)' }], 26000, null],
  ['[data-part="halo"]', [{ transform: 'scale(.92)', opacity: 1 }, { transform: 'scale(1.2)', opacity: 0.6 }], 3200, 'center'],
  ['[data-part="glint"]', [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.15 }, { transform: 'scale(.2)', opacity: 0, offset: 0.3 }, { transform: 'scale(.2)', opacity: 0 }], 5000, 'center'],
  ['[data-part="star"]', [{ opacity: 1 }, { opacity: 0.25 }], 2600, null],
  ['[data-part="petal"]', [{ transform: 'translate(0, 0) rotate(0deg)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: 'translate(-18px, 46px) rotate(200deg)', opacity: 0 }], 9000, 'center'],
  ['[data-part="leaf"]', [{ transform: 'translate(0, 0) rotate(0deg)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: 'translate(14px, 52px) rotate(-260deg)', opacity: 0 }], 8000, 'center'],
  ['[data-part="lantern"]', [{ opacity: 0.2 }, { opacity: 0.5 }], 3000, null],
  ['[data-part="lounge"]', [{ transform: 'translateY(0)' }, { transform: 'translateY(1.2px)' }], 3400, null],
  ['[data-part="firefly"]', [{ transform: 'translate(0, 0)', opacity: 0.2 }, { transform: 'translate(4px, -6px)', opacity: 1 }, { transform: 'translate(-3px, -10px)', opacity: 0.5 }, { transform: 'translate(0, 0)', opacity: 0.2 }], 6000, null],
];

/**
 * The breeze: one gust every BREEZE ms that rolls across the garden from left to right, so the
 * grass and every plant lean in turn. `x` is where the part stands, 0 to the scene's width.
 */
export const BREEZE = 5200;
export const gust = (part, x, frames) => move(part, frames,
  { duration: BREEZE, delay: -BREEZE + (x / SIZE.tall[0]) * 1600, iterations: Infinity, easing: 'ease-in-out' });
/** A gust's keyframes: lean `k` with it, swing back past upright, settle. `at(v)` is the transform. */
export const lean = (k, at) => [0, k, -k * 0.4, k * 0.2, 0].map((v, i) => ({ transform: at(v), offset: [0, 0.22, 0.45, 0.62, 1][i] }));

/** Moves the backdrop of a drawn scene: clouds drift, the sun glows, dew glints, stars twinkle, fireflies wander, the grass leans in the breeze. */
export function animateScene(el) {
  if (!el?.querySelectorAll) return [];
  const grass = [...el.querySelectorAll('[data-part="tuft"]')].map((t) => {
    if (t.style) Object.assign(t.style, { transformBox: 'fill-box', transformOrigin: '50% 100%' });
    return gust(t, Number(t.dataset?.x) || 0, lean(16, (v) => `skewX(${-v}deg)`));
  });
  return grass.concat(LIFE.flatMap(([sel, frames, ms, origin]) => [...el.querySelectorAll(sel)].map((part) => {
    if (origin && part.style) Object.assign(part.style, { transformBox: 'fill-box', transformOrigin: origin });
    const duration = ms * (0.8 + Math.random() * 0.5);
    const alternate = frames.length === 2;
    return move(part, frames, { duration, delay: -Math.random() * duration, iterations: Infinity, easing: 'ease-in-out', direction: alternate ? 'alternate' : 'normal' });
  }))).filter(Boolean);
}
