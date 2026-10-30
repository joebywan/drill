/**
 * A small QR encoder, written for Drill (no dependency): byte mode, error correction M, versions 1–6,
 * which holds a pairing link (up to 106 bytes). Pure.
 *
 *   qr(text, mask?) -> rows of booleans (true is dark), with the best mask by the standard's penalty
 *                      unless one is given. Throws on text too long.
 *   qrSvg(text, label) -> svg string, always dark on white with its quiet zone, in both themes
 */
const LEVEL = [[16, 10, 1], [28, 16, 1], [44, 26, 1], [64, 18, 2], [86, 24, 2], [108, 16, 4]]; // per version: data codewords, EC per block, blocks

// GF(256), the field QR's error correction works in.
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = EXP[i + 255] = x; LOG[x] = i; x = (x << 1) ^ (x & 0x80 ? 0x11d : 0); }
const times = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function remainder(data, n) {
  let gen = [1];
  for (let i = 0; i < n; i++) gen = [...gen, 0].map((c, j) => c ^ (j ? times(gen[j - 1], EXP[i]) : 0));
  const out = new Array(n).fill(0);
  for (const byte of data) {
    const lead = byte ^ out.shift();
    out.push(0);
    for (let j = 0; j < n; j++) out[j] ^= times(gen[j + 1], lead);
  }
  return out;
}

/** The message: mode, length, bytes and padding, split into blocks with their correction, interleaved. */
function codewords(bytes, version) {
  const [size, ecLen, blocks] = LEVEL[version - 1];
  const data = [0x40 | (bytes.length >> 4), ((bytes.length & 15) << 4) | (bytes[0] >> 4)];
  for (let i = 0; i < bytes.length; i++) data.push(i + 1 < bytes.length ? ((bytes[i] & 15) << 4) | (bytes[i + 1] >> 4) : (bytes[i] & 15) << 4);
  for (let pad = 0xec; data.length < size; pad ^= 0xec ^ 0x11) data.push(pad);
  const each = size / blocks; // equal blocks at level M up to version 6
  const parts = Array.from({ length: blocks }, (_, b) => data.slice(b * each, (b + 1) * each));
  const ecs = parts.map((p) => remainder(p, ecLen));
  const out = [];
  for (let i = 0; i < each; i++) for (const p of parts) out.push(p[i]);
  for (let i = 0; i < ecLen; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function draw(words, version, mask) {
  const n = 17 + version * 4;
  const dark = Array.from({ length: n }, () => new Array(n).fill(false));
  const fixed = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, on) => { if (r >= 0 && c >= 0 && r < n && c < n) { dark[r][c] = on; fixed[r][c] = true; } };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      set(r0 + r, c0 + c, ring !== 2 && ring !== 4);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  if (version > 1) {
    const a = n - 7; // one alignment pattern, up to version 6
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) set(a + r, a + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
  }
  // Format: level M (00) and the mask, with its BCH check, twice.
  let bits = mask << 10;
  for (let i = 14; i >= 10; i--) if ((bits >> i) & 1) bits ^= 0x537 << (i - 10);
  bits = ((mask << 10) | bits) ^ 0x5412;
  const bit = (i) => ((bits >> i) & 1) === 1;
  for (let i = 0; i < 6; i++) set(i, 8, bit(i));
  set(7, 8, bit(6)); set(8, 8, bit(7)); set(8, 7, bit(8));
  for (let i = 9; i < 15; i++) set(8, 14 - i, bit(i));
  for (let i = 0; i < 8; i++) set(8, n - 1 - i, bit(i));
  for (let i = 8; i < 15; i++) set(n - 15 + i, 8, bit(i));
  set(n - 8, 8, true);
  // The data, up and down in pairs of columns from the right, skipping the timing column.
  let at = 0;
  for (let right = n - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < n; step++) {
      for (const c of [right, right - 1]) {
        const r = ((right + 1) & 2) === 0 ? n - 1 - step : step;
        if (fixed[r][c]) continue;
        const on = at < words.length * 8 && ((words[at >> 3] >> (7 - (at & 7))) & 1) === 1;
        at++;
        dark[r][c] = on !== MASKS[mask](r, c);
      }
    }
  }
  return dark;
}

/** The standard's penalty: the lower, the easier the code is to read. */
function penalty(m) {
  const n = m.length;
  let score = 0, on = 0;
  const lines = [...m, ...m[0].map((_, c) => m.map((row) => row[c]))];
  for (const line of lines) {
    let run = 0;
    line.forEach((v, i) => {
      run = i && v === line[i - 1] ? run + 1 : 1;
      if (run === 5) score += 3; else if (run > 5) score += 1;
    });
    const s = line.map(Number).join('');
    for (let i = s.indexOf('1011101'); i >= 0; i = s.indexOf('1011101', i + 1))
      if (s.slice(i + 7, i + 11) === '0000' || s.slice(Math.max(0, i - 4), i) === '0000') score += 40;
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (m[r][c]) on++;
    if (r + 1 < n && c + 1 < n && m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  }
  return score + 10 * Math.floor(Math.abs((on * 100) / (n * n) - 50) / 5);
}

export function qr(text, mask) {
  const bytes = new TextEncoder().encode(text);
  const version = LEVEL.findIndex(([size]) => bytes.length + 2 <= size) + 1;
  if (!version) throw new Error('too long for a QR code here');
  const words = codewords(bytes, version);
  if (mask !== undefined) return draw(words, version, mask);
  return MASKS.map((_, i) => draw(words, version, i)).reduce((best, m) => (penalty(m) < penalty(best) ? m : best));
}

export function qrSvg(text, label) {
  const m = qr(text);
  const size = m.length + 8;
  const d = m.flatMap((row, r) => row.flatMap((on, c) => (on ? [`M${c + 4} ${r + 4}h1v1h-1z`] : []))).join('');
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
