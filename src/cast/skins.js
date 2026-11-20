import { INK } from './kit.js';
import { PANELS, butterfly } from './butterfly.js';

/**
 * Lumi's skins: what she can wear, drawn in her own 100 x 120 space with the kit's flat shapes and
 * no outlines. Data and drawings only; what earns each one is a rule in garden/model.js, and the
 * words are SKIN_WORDS in lines.js. lumi(mood, skin, colours) puts the parts in place:
 *   head    in her head group, so a hat or glasses moves with her head (coach.js nod)
 *   front   over her body, under her flippers: a bow tie, a scarf
 *   back    behind her: the costume's wings, the learner's own butterfly in `colours`
 *   perch   how far up the learner's butterfly sits on her head, to clear a hat (lumi()'s `perch`)
 *   arm(shoulder, hand)   on each flipper, so it moves with flap(): the costume's arm straps
 * Lumi never has wings of her own: the costume's are plainly dress-up, on visible straps.
 */

// A five-petal flower, as sketched for the crown.
const bloom = (x, y, c, r = 2.6, d = 3) => [0, 72, 144, 216, 288].map((a) => {
  const t = (a * Math.PI) / 180;
  return `<circle cx="${(x + d * Math.sin(t)).toFixed(1)}" cy="${(y - d * Math.cos(t)).toFixed(1)}" r="${r}" fill="${c}"/>`;
}).join('') + `<circle cx="${x}" cy="${y}" r="${(r * 0.66).toFixed(1)}" fill="#F2B53A"/>`;

const STRAP = '#E86A9A', BAND = '#7B55B0';

export const SKINS = [
  // Tucked by her ear, beside her eye where her head is widest, so its white petals sit on her and show on any page.
  { id: 'daisy', head: '<ellipse cx="22" cy="47" rx="5.2" ry="2.4" fill="#4E8E4A" transform="rotate(-40 22 47)"/>' + bloom(25.5, 39.5, '#FFFFFF', 3.3, 4.2) },
  { id: 'bowtie', front: '<path d="M50 75 L39 68.5 Q36.5 75 39 81.5 Z M50 75 L61 68.5 Q63.5 75 61 81.5 Z" fill="#E0533D"/>'
    + '<rect x="46.5" y="71" width="7" height="8" rx="2.6" fill="#A8382A"/>' },
  { id: 'crown', perch: 11, head: '<path d="M28 25 Q50 9 72 25" stroke="#5FA35A" stroke-width="2.4" fill="none"/>'
    + [[29, 24, '#F49AC1'], [38.5, 17.5, '#FFFFFF'], [50, 15, '#F7B548'], [61.5, 17.5, '#B8A4F0'], [71, 24, '#F49AC1']].map(([x, y, c]) => bloom(x, y, c)).join('') },
  { id: 'sunglasses', head: '<path d="M21 36 L31 36 M47 37 Q50 35 53 37 M69 36 L79 36" stroke="#F07A5A" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    + '<rect x="29.5" y="31.5" width="19" height="15" rx="5" fill="#F07A5A"/><rect x="51.5" y="31.5" width="19" height="15" rx="5" fill="#F07A5A"/>'
    + '<rect x="31.5" y="33.5" width="15" height="11" rx="3.6" fill="#2A2438"/><rect x="53.5" y="33.5" width="15" height="11" rx="3.6" fill="#2A2438"/>'
    + '<path d="M34 41 L38 36 M56 41 L60 36" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>' },
  { id: 'strawhat', perch: 12, head: '<ellipse cx="50" cy="17" rx="31" ry="6.5" fill="#E9C46A"/><path d="M33 17 C33 1 67 1 67 17 Z" fill="#E2B04E"/>'
    + '<path d="M33.4 12.5 L66.6 12.5 L66.9 16.5 L33.1 16.5 Z" fill="#C8553D"/>' },
  { id: 'beanie', perch: 13, head: '<path d="M25 27 C25 3 75 3 75 27 Z" fill="#C8423A"/><rect x="23" y="21" width="54" height="8" rx="4" fill="#A93630"/><circle cx="50" cy="5" r="5.2" fill="#F4F1EA"/>',
    // The scarf sits a little lower than sketched, clear of her widest mouth.
    front: '<g transform="translate(0 3)"><path d="M21 61 C40 70 60 70 79 61 L79 69 C60 78 40 78 21 69 Z" fill="#3E8EDE"/>'
      + '<path d="M34 66.5 L34 74.5 M46 68.5 L46 76.5 M58 68.5 L58 76.5" stroke="#E6F3FF" stroke-width="2.4"/>'
      + '<g transform="rotate(10 64 68)"><rect x="59" y="68" width="10" height="24" rx="3.5" fill="#3E8EDE"/><path d="M60.5 86 L70 87.5" stroke="#E6F3FF" stroke-width="2.4"/></g></g>' },
  { id: 'costume',
    // The learner's own butterfly as wings, drawn by the kit; its parts' names are dropped so nothing animating Lumi finds them.
    back: (colours) => `<g transform="translate(-4 20) scale(.9)">${butterfly(colours, colours.length >= PANELS, INK).replace(/ data-(part|new)="[^"]*"/g, '')}</g>`,
    // A purple band, not ink, so the antennae still show on a dark page.
    head: `<path d="M27 23 Q50 9 73 23" stroke="${BAND}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      + `<path d="M41 15 Q37 9 32 5 M59 15 Q63 9 68 5" stroke="${BAND}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      + '<circle cx="32" cy="5" r="3.4" fill="#F49AC1"/><circle cx="68" cy="5" r="3.4" fill="#F49AC1"/>',
    // An elastic loop round the flipper halfway along, and the strap up over her shoulder to the wings.
    arm: ([sx, sy], [hx, hy]) => {
      const x = (sx + hx) / 2, y = (sy + hy) / 2;
      const turn = ((Math.atan2(hy - sy, hx - sx) * 180) / Math.PI - 90).toFixed(0);
      return `<path d="M${x} ${y} Q${sx + (sx < 50 ? -6 : 6)} ${sy - 6} ${sx + (sx < 50 ? -3 : 3)} ${sy - 16}" fill="none" stroke="${STRAP}" stroke-width="2.6" stroke-linecap="round"/>`
        + `<ellipse cx="${x}" cy="${y}" rx="7.4" ry="2.6" fill="none" stroke="${STRAP}" stroke-width="2.4" transform="rotate(${turn} ${x} ${y})"/>`;
    } },
];

export const skinOf = (id) => SKINS.find((s) => s.id === id) ?? null;

/** What Lumi wears: the chosen skin once it has been given (its `skin:` rule in garden.earned), else null, just Lumi. */
export const worn = (progress) => (progress?.skin && progress.garden?.earned?.[`skin:${progress.skin}`] ? progress.skin : null);
