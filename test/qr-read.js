/**
 * Reads a QR matrix back to its text, as a scanner would, for level M and versions 1–6 with one
 * alignment pattern. Independent of src/sync/qr.js's drawing code. Returns { text, mask }.
 */
export function readQr(m) {
  const n = m.length, version = (n - 17) / 4;
  let f = 0;
  for (let i = 0; i < 6; i++) if (m[i][8]) f |= 1 << i;
  if (m[7][8]) f |= 1 << 6;
  if (m[8][8]) f |= 1 << 7;
  if (m[8][7]) f |= 1 << 8;
  for (let i = 9; i < 15; i++) if (m[8][14 - i]) f |= 1 << i;
  f ^= 0x5412;
  if (f >> 13) throw new Error('not level M');
  const mask = (f >> 10) & 7;
  const test = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0][mask];
  const reserved = (r, c) => r === 6 || c === 6 || (r < 9 && c < 9) || (r < 9 && c >= n - 8) || (r >= n - 8 && c < 9)
    || (version > 1 && Math.abs(r - (n - 7)) <= 2 && Math.abs(c - (n - 7)) <= 2);
  const bits = [];
  let up = true;
  for (let right = n - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    for (let i = 0; i < n; i++) {
      const r = up ? n - 1 - i : i;
      for (const c of [right, right - 1]) if (!reserved(r, c)) bits.push(m[r][c] !== test(r, c) ? 1 : 0);
    }
    up = !up;
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) words.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  const blocks = [1, 1, 1, 2, 2, 4][version - 1], size = [16, 28, 44, 64, 86, 108][version - 1];
  const data = [];
  for (let b = 0; b < blocks; b++) for (let i = 0; i < size / blocks; i++) data.push(words[i * blocks + b]);
  if (data[0] >> 4 !== 4) throw new Error('not byte mode');
  const length = ((data[0] & 15) << 4) | (data[1] >> 4);
  const out = [];
  for (let i = 0; i < length; i++) out.push(((data[i + 1] & 15) << 4) | (data[i + 2] >> 4));
  return { text: new TextDecoder().decode(new Uint8Array(out)), mask };
}

/** The matrix back out of qrSvg()'s path, which is what is actually on screen. */
export function matrixOf(svg) {
  const size = Number(/viewBox="0 0 (\d+)/.exec(svg)[1]) - 8;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  for (const [, x, y] of svg.matchAll(/M(\d+) (\d+)h1/g)) m[y - 4][x - 4] = true;
  return m;
}
