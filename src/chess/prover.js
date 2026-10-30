/**
 * The mate prover behind Mate, ported from Daybook's ChessRules.kt: can the side to move force
 * checkmate within n of its moves? No imports, so it also runs in a Worker (bare imports don't).
 * chess.js stays the rule book on screen; at about 6,000 positions a second it can't prove a mate in 4,
 * so this has its own small board (make/unmake, a transposition table). test/mate.test.js checks it against chess.js.
 *
 * Squares are 0..63, a1 = 0. Pieces are 1..6 (P N B R Q K), positive for White. A move is
 * from | to << 6 | promotion << 12.
 */
const b = new Int8Array(64);
let white = true, cast = 0, ep = -1, h1 = 0, h2 = 0;
const ks = [-1, -1]; // king squares: white, black
const STACK = 40;
const undo = Array.from({ length: STACK }, () => new Int32Array(6));
let sp = 0;
const killer = new Int32Array(STACK);
const bufs = Array.from({ length: STACK }, () => new Int32Array(256));

// Hash keys from a fixed stream: two 32-bit words, piece (+6) * 64 + square, side, castling (16), ep file (8).
const Z = new Int32Array(857 * 2);
for (let i = 0, x = 0x9E3779B9; i < Z.length; i++) {
  x = (x + 0x61C88647) | 0;
  let z = x;
  z = Math.imul(z ^ (z >>> 15), 0x85EBCA6B);
  z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35);
  Z[i] = z ^ (z >>> 16);
}
const zx = (i) => { h1 ^= Z[2 * i]; h2 ^= Z[2 * i + 1]; };
const Z_SIDE = 832, Z_CASTLE = 833, Z_EP = 849;

// Bounds on "attacker mates within d", kept between calls: a result only depends on the position.
const TT_BITS = 18;
const ttKey = new Float64Array(1 << TT_BITS);
const ttWin = new Int8Array(1 << TT_BITS); // smallest d proved to mate (127 none)
const ttLose = new Int8Array(1 << TT_BITS); // largest d proved not to mate

const LETTERS = ' pnbrqk';
const CASTLE_MASK = new Int8Array(64).fill(15);
CASTLE_MASK[0] = 13; CASTLE_MASK[7] = 14; CASTLE_MASK[4] = 12; CASTLE_MASK[56] = 7; CASTLE_MASK[63] = 11; CASTLE_MASK[60] = 3;

const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const LINE = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ALL = [...DIAG, ...LINE];

const from = (m) => m & 63;
const to = (m) => (m >> 6) & 63;
const promo = (m) => m >> 12;
const name = (s) => 'abcdefgh'[s % 8] + (Math.floor(s / 8) + 1);
const uci = (m) => name(from(m)) + name(to(m)) + (promo(m) ? LETTERS[promo(m)] : '');

function setUp(fen) {
  const [rows, side, castling, passant] = fen.split(' ');
  b.fill(0);
  h1 = h2 = 0;
  ks[0] = ks[1] = -1;
  rows.split('/').forEach((row, i) => {
    let f = 0;
    for (const c of row) {
      if (c >= '1' && c <= '8') { f += Number(c); continue; }
      const v = LETTERS.indexOf(c.toLowerCase()) * (c === c.toLowerCase() ? -1 : 1);
      const s = (7 - i) * 8 + f++;
      b[s] = v;
      zx((v + 6) * 64 + s);
      if (v === 6) ks[0] = s; else if (v === -6) ks[1] = s;
    }
  });
  white = side === 'w';
  if (white) zx(Z_SIDE);
  cast = (castling.includes('K') ? 1 : 0) | (castling.includes('Q') ? 2 : 0) | (castling.includes('k') ? 4 : 0) | (castling.includes('q') ? 8 : 0);
  zx(Z_CASTLE + cast);
  ep = passant && passant !== '-' ? passant.charCodeAt(0) - 97 + (Number(passant[1]) - 1) * 8 : -1;
  if (ep >= 0) zx(Z_EP + ep % 8);
  sp = 0;
}

function attacked(s, byWhite) {
  const sign = byWhite ? 1 : -1;
  const f = s % 8, r = (s - f) / 8;
  const pr = r - sign; // a white pawn attacks upward, so it stands a rank below
  if (pr >= 0 && pr < 8) {
    if (f > 0 && b[pr * 8 + f - 1] === sign) return true;
    if (f < 7 && b[pr * 8 + f + 1] === sign) return true;
  }
  for (const [df, dr] of KNIGHT) {
    const x = f + df, y = r + dr;
    if (x >= 0 && x < 8 && y >= 0 && y < 8 && b[y * 8 + x] === 2 * sign) return true;
  }
  for (const [df, dr] of ALL) {
    let x = f + df, y = r + dr, near = true;
    const slider = df && dr ? 3 : 4;
    while (x >= 0 && x < 8 && y >= 0 && y < 8) {
      const v = b[y * 8 + x];
      if (v) {
        if (v === sign * slider || v === sign * 5 || (near && v === sign * 6)) return true;
        break;
      }
      x += df; y += dr; near = false;
    }
  }
  return false;
}

const inCheckNow = () => attacked(ks[white ? 0 : 1], !white); // the side to move
const exposed = () => attacked(ks[white ? 1 : 0], white); // the side that just moved

/** Pseudo-legal moves into `out`; legality is settled on make. */
function gen(out) {
  let n = 0;
  const sign = white ? 1 : -1;
  const add = (f, t) => { out[n++] = f | (t << 6); };
  for (let s = 0; s < 64; s++) {
    const v = b[s] * sign;
    if (v <= 0) continue;
    const f = s % 8, r = (s - f) / 8;
    if (v === 1) {
      const last = white ? 6 : 1;
      const pawn = (t) => {
        if (r === last) for (const p of [5, 4, 3, 2]) out[n++] = s | (t << 6) | (p << 12);
        else add(s, t);
      };
      const up = s + 8 * sign;
      if (!b[up]) {
        pawn(up);
        if (r === (white ? 1 : 6) && !b[up + 8 * sign]) add(s, up + 8 * sign);
      }
      if (f > 0 && (b[up - 1] * sign < 0 || up - 1 === ep)) pawn(up - 1);
      if (f < 7 && (b[up + 1] * sign < 0 || up + 1 === ep)) pawn(up + 1);
    } else if (v === 2 || v === 6) {
      for (const [df, dr] of v === 2 ? KNIGHT : ALL) {
        const x = f + df, y = r + dr;
        if (x >= 0 && x < 8 && y >= 0 && y < 8 && b[y * 8 + x] * sign <= 0) add(s, y * 8 + x);
      }
      if (v === 6) {
        const k = white ? 4 : 60;
        if (s === k && !attacked(k, !white)) {
          if (cast & (white ? 1 : 4) && !b[k + 1] && !b[k + 2] && !attacked(k + 1, !white) && !attacked(k + 2, !white)) add(s, k + 2);
          if (cast & (white ? 2 : 8) && !b[k - 1] && !b[k - 2] && !b[k - 3] && !attacked(k - 1, !white) && !attacked(k - 2, !white)) add(s, k - 2);
        }
      }
    } else {
      for (const [df, dr] of v === 3 ? DIAG : v === 4 ? LINE : ALL) {
        let x = f + df, y = r + dr;
        while (x >= 0 && x < 8 && y >= 0 && y < 8) {
          const t = y * 8 + x, w = b[t] * sign;
          if (w > 0) break;
          add(s, t);
          if (w < 0) break;
          x += df; y += dr;
        }
      }
    }
  }
  return n;
}

function put(s, v) {
  if (b[s]) zx((b[s] + 6) * 64 + s);
  b[s] = v;
  if (v) zx((v + 6) * 64 + s);
}

function make(m) {
  const u = undo[sp++];
  const f = from(m), t = to(m), p = promo(m), moved = b[f];
  const kind = Math.abs(moved);
  u[0] = cast; u[1] = ep; u[2] = h1; u[3] = h2; u[4] = moved; u[5] = b[t];
  zx(Z_CASTLE + cast);
  if (ep >= 0) zx(Z_EP + ep % 8);
  put(f, 0);
  if (kind === 1 && t === ep) put(t + (white ? -8 : 8), 0);
  put(t, p ? (white ? p : -p) : moved);
  if (kind === 6) {
    ks[white ? 0 : 1] = t;
    if (t - f === 2) { put(t + 1, 0); put(t - 1, white ? 4 : -4); }
    else if (f - t === 2) { put(t - 2, 0); put(t + 1, white ? 4 : -4); }
  }
  cast &= CASTLE_MASK[f] & CASTLE_MASK[t];
  ep = kind === 1 && Math.abs(t - f) === 16 ? (f + t) / 2 : -1;
  zx(Z_CASTLE + cast);
  if (ep >= 0) zx(Z_EP + ep % 8);
  white = !white;
  zx(Z_SIDE);
}

function unmake(m) {
  const u = undo[--sp];
  white = !white;
  const f = from(m), t = to(m);
  const kind = Math.abs(u[4]);
  ep = u[1]; cast = u[0];
  b[f] = u[4];
  b[t] = u[5];
  if (kind === 1 && t === ep) b[t + (white ? -8 : 8)] = white ? -1 : 1;
  if (kind === 6) {
    ks[white ? 0 : 1] = f;
    if (t - f === 2) { b[t + 1] = white ? 4 : -4; b[t - 1] = 0; }
    else if (f - t === 2) { b[t - 2] = white ? 4 : -4; b[t + 1] = 0; }
  }
  h1 = u[2]; h2 = u[3];
}

function hasLegal() {
  const buf = bufs[sp];
  const n = gen(buf);
  for (let i = 0; i < n; i++) {
    make(buf[i]);
    const ok = !exposed();
    unmake(buf[i]);
    if (ok) return true;
  }
  return false;
}

const clear = (a, c, skip) => {
  const step = Math.sign(c % 8 - a % 8) + 8 * Math.sign((c >> 3) - (a >> 3));
  for (let s = a + step; s !== c; s += step) if (s !== skip && b[s]) return false;
  return true;
};

/** Leaving `f` could uncover one of our sliders on the king at `ek`. */
function discovers(f, ek) {
  const df = Math.abs(f % 8 - ek % 8), dr = Math.abs((f >> 3) - (ek >> 3));
  if (!(df === dr || !df || !dr)) return false;
  if (!clear(f, ek, -1)) return false;
  const step = Math.sign(f % 8 - ek % 8) + 8 * Math.sign((f >> 3) - (ek >> 3));
  let x = f % 8, y = f >> 3;
  const sx = Math.sign(f % 8 - ek % 8), sy = Math.sign((f >> 3) - (ek >> 3));
  for (let s = f + step; ; s += step) {
    x += sx; y += sy;
    if (x < 0 || x > 7 || y < 0 || y > 7) return false;
    const v = b[s] * (white ? 1 : -1);
    if (v < 0) return false;
    if (v > 0) return v === 5 || v === (df === dr ? 3 : 4);
  }
}

/** A cheap superset of "gives check"; make settles it. A move this says no to never gives check. */
function mayCheck(m) {
  const ek = ks[white ? 1 : 0];
  if (promo(m)) return true;
  const f = from(m), t = to(m);
  const kind = Math.abs(b[f]);
  if (kind === 6) return Math.abs(t - f) === 2 || discovers(f, ek);
  if (kind === 1 && t === ep) return true;
  if (discovers(f, ek)) return true;
  const df = Math.abs(t % 8 - ek % 8), dr = Math.abs((t >> 3) - (ek >> 3));
  switch (kind) {
    case 1: return df === 1 && (ek >> 3) - (t >> 3) === (white ? 1 : -1);
    case 2: return df * dr === 2;
    case 3: return df === dr && clear(t, ek, f);
    case 4: return (!df || !dr) && clear(t, ek, f);
    default: return (df === dr || !df || !dr) && clear(t, ek, f);
  }
}

function mateInOne() {
  const buf = bufs[sp];
  const n = gen(buf);
  for (let i = 0; i < n; i++) {
    const m = buf[i];
    if (!mayCheck(m)) continue;
    make(m);
    const mate = !exposed() && inCheckNow() && !hasLegal();
    unmake(m);
    if (mate) return true;
  }
  return false;
}

function store(idx, key, d, res) {
  if (ttKey[idx] !== key) { ttKey[idx] = key; ttWin[idx] = 127; ttLose[idx] = 0; }
  if (res) { if (d < ttWin[idx]) ttWin[idx] = d; } else if (d > ttLose[idx]) ttLose[idx] = d;
}

/** Attacker to move: can they mate within d of their own moves? */
function mates(d) {
  const idx = h1 >>> (32 - TT_BITS);
  const key = (h1 >>> 0) * 2097152 + (h2 >>> 11);
  if (ttKey[idx] === key) {
    if (ttWin[idx] <= d) return true;
    if (ttLose[idx] >= d) return false;
  }
  if (d === 1) {
    const r = mateInOne();
    store(idx, key, 1, r);
    return r;
  }
  const buf = bufs[sp];
  const n = gen(buf);
  let k = 0, res = false;
  for (let i = 0; i < n; i++) { // ranked 0 check, 1 capture, 2 quiet; a mating check ends it
    const m = buf[i];
    let rank = b[to(m)] ? 1 : 2;
    if (mayCheck(m)) {
      make(m);
      if (exposed()) { unmake(m); continue; }
      const chk = inCheckNow();
      const mated = chk && !hasLegal();
      unmake(m);
      if (mated) { res = true; break; }
      if (chk) rank = 0;
    }
    buf[k++] = m | (rank << 16);
  }
  if (!res) {
    outer: for (let pass = 0; pass <= 2; pass++) for (let i = 0; i < k; i++) {
      if (buf[i] >> 16 !== pass) continue;
      const m = buf[i] & 0xFFFF;
      make(m);
      if (exposed()) { unmake(m); continue; }
      const ok = allReplies(d - 1);
      unmake(m);
      if (ok) { res = true; break outer; }
    }
  }
  store(idx, key, d, res);
  return res;
}

/** Defender to move: every legal reply (there must be one) leaves the attacker a mate within d. */
function allReplies(d) {
  const buf = bufs[sp];
  const n = gen(buf);
  const kl = killer[sp]; // the reply that refuted the last attempt at this depth goes first among its kind
  let k = 0;
  for (let i = 0; i < n; i++) {
    const m = buf[i];
    let base = b[to(m)] ? 2 : 4;
    if (mayCheck(m)) {
      make(m);
      const legal = !exposed();
      const chk = legal && inCheckNow();
      unmake(m);
      if (!legal) continue;
      if (chk) base = 0;
    }
    buf[k++] = m | ((base + (m === kl ? 0 : 1)) << 16);
  }
  let any = false;
  for (let pass = 0; pass <= 5; pass++) for (let i = 0; i < k; i++) {
    if (buf[i] >> 16 !== pass) continue;
    const m = buf[i] & 0xFFFF;
    make(m);
    if (exposed()) { unmake(m); continue; }
    any = true;
    const ok = mates(d);
    unmake(m);
    if (!ok) { killer[sp] = m; return false; }
  }
  return any; // no legal reply at all is stalemate: mate is the caller's case
}

function legal() {
  const buf = bufs[sp];
  const out = [];
  const n = gen(buf);
  for (let i = 0; i < n; i++) {
    make(buf[i]);
    if (!exposed()) out.push(buf[i]);
    unmake(buf[i]);
  }
  return out;
}

function search(n) {
  const moves = legal();
  for (let d = 1; d <= n; d++) {
    const keys = [];
    for (const m of moves) {
      make(m);
      const ok = (inCheckNow() && !hasLegal()) || (d > 1 && allReplies(d - 1));
      unmake(m);
      if (ok) keys.push(m);
    }
    if (keys.length) return { keys, inMoves: d };
  }
  return null;
}

/**
 * The shortest forced mate for the side to move, within n of its moves: { keys, inMoves } with
 * every first move that does it, in UCI. Null is a proof there is none.
 */
export function forcedMate(fen, n) {
  setUp(fen);
  const res = search(n);
  return res && { keys: res.keys.map(uci), inMoves: res.inMoves };
}

/**
 * The defender's reply, in UCI: the first after which the attacker has no forced mate within
 * `remaining` moves; if every reply is mated, the first that takes longest. Null with no legal move.
 */
export function defence(fen, remaining) {
  setUp(fen);
  let best = null, bestLen = 0;
  for (const r of legal()) {
    make(r);
    const res = search(remaining);
    unmake(r);
    if (!res) return uci(r);
    if (res.inMoves > bestLen) { best = r; bestLen = res.inMoves; }
  }
  return best === null ? null : uci(best);
}
