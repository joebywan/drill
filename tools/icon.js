/**
 * Wingbeat's icon: Lumi close up, as src/cast/lumi.js draws her, with the player's butterfly
 * (src/cast/butterfly.js) perched on her crown, on the garden green. Run `node tools/icon.js` after
 * either changes; it writes, from those two drawings,
 *   assets/icon.svg                    the web favicon (the middle 72 units, rounded)
 *   assets/icon-512.png                full bleed: the manifest's maskable icon and the Play listing icon
 *   android/.../drawable/ic_launcher_fg.xml, ic_launcher_mono.xml   the adaptive icon's layers
 *   android/.../drawable/ic_butterfly.xml   the daily note's small icon: the butterfly in one colour
 * The Android layers are vector drawables converted from the same SVG elements, so nothing is redrawn.
 * It fails if Lumi's face or any part of the butterfly leaves the adaptive icon's 66-unit safe circle.
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { lumi } from '../src/cast/lumi.js';
import { butterfly } from '../src/cast/butterfly.js';
import { INK } from '../src/cast/kit.js';

const ROOT = new URL('..', import.meta.url).pathname;
const RES = `${ROOT}android/app/src/main/res`;
const GREEN = '#2F7D4F'; // --accent in styles.css: the garden green

// On the 108-unit adaptive canvas the safe circle is 66 across. The approved sketch (Lumi at
// translate(-7.5 12) scale(1.15) on a 100-unit square, the butterfly at translate(23 0) scale(.45))
// sits at AT: as close up as keeps her face and the whole butterfly inside it. Her cheeks and body
// run off under the mask.
const AT = 'translate(16 22) scale(.76)';
const LUMI = 'translate(-7.5 12) scale(1.15)', FLY = 'translate(23 0) scale(.45)';
const SAFE = 33;
const GAP = 2.4, DROP = 4; // the themed icon's gap under the butterfly, and how far Lumi drops there so it clears her brows
const her = lumi('teach').replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/<ellipse data-part="shadow"[^>]*\/>/, '');
const art = `<g transform="${AT}"><g data-part="lumi" transform="${LUMI}">${her}</g>`
  + `<g data-part="butterfly" transform="${FLY}">${butterfly(undefined, true, INK)}</g></g>`;

const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const oval = (cx, cy, rx, ry) => `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${2 * rx},0 a${rx},${ry} 0 1,0 ${-2 * rx},0 Z`;
function rectPath({ x, y, width: w, height: h, rx = 0 }) {
  [x, y, w, h, rx] = [x, y, w, h, rx].map(Number);
  if (!rx) return `M${x},${y} h${w} v${h} h${-w} Z`;
  return `M${x + rx},${y} h${w - 2 * rx} a${rx},${rx} 0 0,1 ${rx},${rx} v${h - 2 * rx} a${rx},${rx} 0 0,1 ${-rx},${rx} h${-(w - 2 * rx)} a${rx},${rx} 0 0,1 ${-rx},${-rx} v${-(h - 2 * rx)} a${rx},${rx} 0 0,1 ${rx},${-rx} Z`;
}
const pathOf = (tag, a) => tag === 'path' ? a.d : tag === 'rect' ? rectPath(a) : oval(+a.cx, +a.cy, +(a.rx ?? a.r), +(a.ry ?? a.r));
const hex = (c) => {
  const h = c.replace('#', '');
  return `#${(h.length === 3 ? [...h].map((x) => x + x).join('') : h).toUpperCase()}`;
};

// A group for an SVG transform: translate then scale, or a rotation about a point, which is all the
// cast and the butterfly use. The butterfly's mirror, translate(120 0) scale(-1 1), flips about x 60.
function group(t) {
  const get = (fn) => t?.match(new RegExp(`${fn}\\(([^)]*)\\)`))?.[1].trim().split(/[\s,]+/).map(Number);
  const [tx = 0, ty = 0] = get('translate') || [], [sx = 1, sy = sx] = get('scale') || [], [r = 0, px = 0, py = 0] = get('rotate') || [];
  if ((get('rotate') && (get('translate') || get('scale'))) || /scale.*translate/.test(t)) throw new Error(`tools/icon.js can't convert the transform "${t}"`);
  const g = sx === -1 && sy === 1 && !ty ? { scaleX: -1, pivotX: tx / 2 }
    : { translateX: tx, translateY: ty, scaleX: sx, scaleY: sy, ...(r && { rotation: r, pivotX: px, pivotY: py }) };
  return Object.entries(g).filter(([k, v]) => v !== (k.startsWith('scale') ? 1 : 0)).map(([k, v]) => ` android:${k}="${+v.toFixed(4)}"`).join('');
}

const clipsOf = (svg) => new Map([...svg.matchAll(/<clipPath id="([^"]+)"><path d="([^"]+)"\/><\/clipPath>/g)].map((m) => [m[1], m[2]]));

/** SVG made of g (a transform above, or a clip-path), path, rect, circle and ellipse, as a vector drawable `side` units and `dp` across. */
function vector(svg, side = 108, dp = 108) {
  const clips = clipsOf(svg);
  const lines = [];
  let depth = 1;
  const put = (s) => lines.push(`${'    '.repeat(depth)}${s}`);
  for (const [, close, tag, raw] of svg.replace(/<defs>.*?<\/defs>/gs, '').matchAll(/<(\/?)(\w+)([^>]*)>/g)) {
    if (close) { depth--; put('</group>'); continue; }
    const a = attrs(raw), g = group(a.transform);
    if (tag === 'g') {
      put(`<group${g}>`);
      depth++;
      if (a['clip-path']) put(`<clip-path android:pathData="${clips.get(a['clip-path'].slice(5, -1))}" />`);
      continue;
    }
    const fill = a.fill && a.fill !== 'none', alpha = (k) => (a.opacity ? ` android:${k}Alpha="${a.opacity}"` : '');
    const path = `<path android:pathData="${pathOf(tag, a)}"`
      + (fill ? ` android:fillColor="${hex(a.fill)}"${alpha('fill')}` : '')
      + (a['fill-rule'] === 'evenodd' ? ' android:fillType="evenOdd"' : '')
      + (a.stroke ? ` android:strokeColor="${hex(a.stroke)}" android:strokeWidth="${a['stroke-width'] ?? 1}"${alpha('stroke')}` : '')
      + (a['stroke-linecap'] ? ` android:strokeLineCap="${a['stroke-linecap']}"` : '')
      + (a['stroke-linejoin'] ? ` android:strokeLineJoin="${a['stroke-linejoin']}"` : '') + ' />';
    if (g) { put(`<group${g}>`); depth++; put(path); depth--; put('</group>'); } else put(path);
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by tools/icon.js from Lumi (src/cast/lumi.js) and the butterfly (src/cast/butterfly.js). Edit those, then run the tool. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${dp}dp" android:height="${dp}dp" android:viewportWidth="${side}" android:viewportHeight="${side}">
${lines.join('\n')}
</vector>
`;
}

// Themed icons use only the monochrome layer's shape: the butterfly, and Lumi's outline with her
// eyes, nose and brows cut out (even-odd) and her pupils put back, kept GAP clear of the butterfly's
// underside. Its wings come down almost to her brows, so she sits DROP lower here; her smile would
// forbid that, but it's a stroke, which can't be cut, so it's left out anyway.
const shapes = [...her.matchAll(/<(ellipse|circle|path|rect)\s([^>]*?)\/>/g)].map(([, tag, raw]) => ({ ...attrs(raw), d: pathOf(tag, attrs(raw)) }));
const outline = shapes.find((s) => s.d.startsWith('M50 14'));
const eyes = shapes.filter((s) => s.fill === '#fff' && /a6,7/.test(s.d));
const pupils = shapes.filter((s) => s.fill === '#1E1B2E' && /a3\.3,3\.3/.test(s.d));
const nose = shapes.find((s) => /a4,3 /.test(s.d));
const brows = shapes.filter((s) => /a1\.8,1\.8/.test(s.d));
if (!outline || eyes.length !== 2 || pupils.length !== 2 || !nose || brows.length !== 2) throw new Error('Lumi has changed shape: update the monochrome layer in tools/icon.js');
// In one colour a fan of panels is just its wing, and drawing the wing whole leaves no seams between wedges.
const whole = (fly) => fly.replace(/<g clip-path="url\(#([^)]+)\)">.*?<\/g>/g, (_, id) => `<path d="${clipsOf(fly).get(id)}" fill="#fff"/>`);
const mono = (under) => `<defs><clipPath id="under"><path d="${under}"/></clipPath></defs><g clip-path="url(#under)"><g transform="translate(0 ${DROP})"><g transform="${AT}"><g transform="${LUMI}">`
  + `<path fill-rule="evenodd" fill="#fff" d="${[outline, ...eyes, nose, ...brows].map((s) => s.d).join(' ')}"/>`
  + `${pupils.map((s) => `<path fill="#fff" d="${s.d}"/>`).join('')}</g></g></g></g>`
  + `<g transform="${AT}"><g transform="${FLY}">${whole(butterfly(undefined, true, INK)).replace(/(fill|stroke)="#\w+"/g, '$1="#fff"')}</g></g>`;

const page = await (await chromium.launch()).newPage({ viewport: { width: 512, height: 512 } });
const [reach, under] = await page.evaluate(async ([inner, gap]) => {
  const N = 10; // pixels a unit
  const paint = async (keep) => {
    const img = new Image();
    img.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><style>* { visibility: hidden }
      [data-part=${keep}], [data-part=${keep}] * { visibility: visible }</style>${inner}</svg>`)}`;
    await img.decode();
    const c = new OffscreenCanvas(108 * N, 108 * N), g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    return (x, y) => data[(y * c.width + x) * 4 + 3] > 8;
  };
  const W = 108 * N, cols = [...Array(W).keys()];
  const reach = {};
  let on;
  for (const keep of ['face', 'butterfly']) {
    on = await paint(keep);
    reach[keep] = Math.max(...cols.map((x) => Math.max(0, ...cols.filter((y) => on(x, y)).map((y) => Math.hypot(x + 0.5 - W / 2, y + 0.5 - W / 2))))) / N;
  }
  // The butterfly's underside (`on` is the butterfly now), lowered by `gap` all round: for each column,
  // the lowest point of the butterfly within `gap` of it.
  const r = gap * N;
  const low = cols.map((x) => { for (let y = W - 1; y >= 0; y--) if (on(x, y)) return y + 1; return -Infinity; });
  const pts = cols.filter((x) => x % 5 === 0).map((x) => [x / N, Math.max(...cols.slice(Math.max(0, x - r), x + r + 1).map((xx) => low[xx] + Math.sqrt(r * r - (xx - x) ** 2))) / N])
    .filter(([, y]) => y > 0);
  return [reach, `M0 108 V0 H${pts[0][0]} ${pts.map(([x, y]) => `L${x} ${y.toFixed(1)}`).join(' ')} V0 H108 V108 Z`];
}, [art, GAP]);
for (const [part, r] of Object.entries(reach)) if (r > SAFE) throw new Error(`The icon's ${part} reaches ${r} from the centre, past the ${SAFE}-unit safe circle: move it in AT`);

writeFileSync(`${RES}/drawable/ic_launcher_fg.xml`, vector(art));
writeFileSync(`${RES}/drawable/ic_launcher_mono.xml`, vector(mono(under)));
// The note's small icon: Android draws only its alpha, so the butterfly goes whole and white, centred in a 120-unit square.
const small = whole(butterfly(undefined, true, INK)).replace(/(fill|stroke)="#\w+"/g, '$1="#fff"');
writeFileSync(`${RES}/drawable/ic_butterfly.xml`, vector(`<g transform="translate(0 10)">${small}</g>`, 120, 24));

// The web's copies, of the same canvas: the favicon shows what a launcher shows, the middle 72
// units, rounded; the PNG is full bleed, cropped so the safe circle is its central 80%, the most a
// maskable icon may lose.
const svg = (box) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${art}</svg>`;
const crop = (side) => [54 - side / 2, 54 - side / 2, side, side].join(' ');
writeFileSync(`${ROOT}assets/icon.svg`, svg(crop(72)).replace('>', `><defs><clipPath id="icon"><rect x="18" y="18" width="72" height="72" rx="16"/></clipPath></defs><g clip-path="url(#icon)"><rect width="108" height="108" fill="${GREEN}"/>`).replace(/<\/svg>$/, '</g></svg>\n'));
await page.setContent(`<style>body{margin:0}svg{display:block;width:512px;height:512px}</style>${svg(crop(SAFE / 0.4)).replace('>', `><rect width="108" height="108" fill="${GREEN}"/>`)}`);
await page.screenshot({ path: `${ROOT}assets/icon-512.png` });
await page.context().browser().close();
console.log('wrote assets/icon.svg, assets/icon-512.png, ic_launcher_fg.xml, ic_launcher_mono.xml, ic_butterfly.xml');
