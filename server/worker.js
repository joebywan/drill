/**
 * Drill's sync API: a Cloudflare Worker over one D1 database (migrations/). It stores what the
 * device sends and never reads it: progress arrives encrypted, a card holds preset values only,
 * and nobody gives a name, an email or a password. A profile is the SHA-256 of a token the device
 * derives from its recovery code (src/sync/keys.js); `Authorization: Bearer <token>` on each call.
 *
 *   POST   /v1/profile                  create (idempotent)               → { friendCode }
 *   DELETE /v1/profile                  delete everything about me        → {}
 *   GET    /v1/progress                                                   → { rev, blob }
 *   PUT    /v1/progress { rev, blob, card? }   only if rev is current     → { rev } | 409 { rev, blob }
 *   POST   /v1/pair { code, wrapped }   hold a wrapped secret 10 minutes  → { expires }
 *   POST   /v1/pair/claim { code }      no auth, once, rate-limited       → { wrapped }
 *   GET    /v1/friends                                                    → { code, friends, asks, cheers }
 *   POST   /v1/friends/{add,accept,remove,block} { code }                 → {}
 *   POST   /v1/cheer { code, cheer }    once a day per friend             → {} | 409
 */
import { CHEERS, checkCard } from '../src/sync/presets.js';

const PAIR_MS = 10 * 60 * 1000;
const BLOB_MAX = 1_000_000; // characters of base64; D1 rows top out at 2 MB
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
// Bearer tokens, no cookies: any origin may call (the web app, the Android wrapper's asset host).
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' };

class Fail extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function sha256(text) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Counts a hit on `key`; fails with 429 once it passes `limit` in the current `secs` window. */
async function rate(env, key, limit, secs) {
  const win = Math.floor(Date.now() / 1000 / secs);
  const row = await env.DB.prepare(`INSERT INTO rates (key, win, count, until) VALUES (?1, ?2, 1, ?3)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN win = ?2 THEN count + 1 ELSE 1 END, win = ?2, until = ?3 RETURNING count`)
    .bind(key, win, (win + 1) * secs * 1000).first();
  if (row.count > limit) throw new Fail(429, 'slow down');
}

/**
 * Drops rate rows whose window has ended (one per IP ever seen would pile up otherwise) and
 * expired pairings. Run on the rare writes that create something: a new profile, a new pairing.
 */
const sweep = (env) => env.DB.batch([
  env.DB.prepare('DELETE FROM rates WHERE until < ?').bind(Date.now()),
  env.DB.prepare('DELETE FROM pairings WHERE expires < ?').bind(Date.now()),
]);

const friendCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

async function body(req) {
  try { return await req.json(); } catch { throw new Fail(400, 'not JSON'); }
}

/** The caller's profile id, from the bearer token (43 base64url characters, 256 bits). */
async function who(req) {
  const token = req.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) throw new Fail(401, 'no token');
  return sha256(token);
}

async function me(env, id) {
  const row = await env.DB.prepare('SELECT id, friend_code FROM profiles WHERE id = ?').bind(id).first();
  if (!row) throw new Fail(404, 'no profile');
  return row;
}

async function byCode(env, code) {
  if (typeof code !== 'string' || !/^[A-Z2-9]{8}$/.test(code)) throw new Fail(400, 'bad code');
  const row = await env.DB.prepare('SELECT id FROM profiles WHERE friend_code = ?').bind(code).first();
  if (!row) throw new Fail(404, 'no such code');
  return row.id;
}

const link = (env, src, dst) => env.DB.prepare('SELECT state FROM links WHERE src = ? AND dst = ?').bind(src, dst).first('state');

async function route(req, env) {
  const { pathname: path } = new URL(req.url);
  const m = req.method;
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  await rate(env, `ip:${ip}`, 300, 60);

  if (m === 'POST' && path === '/v1/pair/claim') {
    // A 6-digit code is a million guesses: ten tries per IP per ten minutes, and a code works once.
    await rate(env, `claim:${ip}`, 10, 600);
    const { code } = await body(req);
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Fail(400, 'bad code');
    const row = await env.DB.prepare('DELETE FROM pairings WHERE code = ? RETURNING wrapped, expires').bind(code).first();
    if (!row || row.expires < Date.now()) throw new Fail(404, 'no such code');
    return json({ wrapped: row.wrapped });
  }

  const id = await who(req);
  await rate(env, `id:${id}`, 120, 60);

  if (path === '/v1/profile' && m === 'POST') {
    await rate(env, `new:${ip}`, 20, 3600);
    await sweep(env);
    const now = Date.now();
    for (let tries = 0; tries < 5; tries++) {
      const done = await env.DB.prepare('INSERT INTO profiles (id, friend_code, created, updated) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
        .bind(id, friendCode(), now, now).run().then(() => true, (e) => { if (/UNIQUE/.test(e.message)) return false; throw e; });
      if (done) return json({ friendCode: (await me(env, id)).friend_code });
    }
    throw new Fail(503, 'try again');
  }

  const self = await me(env, id);

  if (path === '/v1/profile' && m === 'DELETE') {
    // Everything keyed to this profile goes with it (ON DELETE CASCADE): pairings, links, cheers.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM links WHERE src = ?1 OR dst = ?1').bind(id),
      env.DB.prepare('DELETE FROM cheers WHERE src = ?1 OR dst = ?1').bind(id),
      env.DB.prepare('DELETE FROM pairings WHERE profile = ?').bind(id),
      env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(id),
      env.DB.prepare("DELETE FROM rates WHERE substr(key, instr(key, ':') + 1) = ?").bind(id),
    ]);
    return json({});
  }

  if (path === '/v1/progress' && m === 'GET') {
    const row = await env.DB.prepare('SELECT rev, blob FROM profiles WHERE id = ?').bind(id).first();
    return json({ rev: row.rev, blob: row.blob });
  }

  if (path === '/v1/progress' && m === 'PUT') {
    const { rev, blob, card } = await body(req);
    if (!Number.isInteger(rev) || typeof blob !== 'string' || blob.length > BLOB_MAX || !/^[A-Za-z0-9+/=]+$/.test(blob)) throw new Fail(400, 'bad blob');
    const checked = card === undefined ? undefined : checkCard(card);
    if (checked === null) throw new Fail(400, 'bad card');
    const row = await env.DB.prepare(`UPDATE profiles SET blob = ?, rev = rev + 1, updated = ?, card = COALESCE(?, card)
      WHERE id = ? AND rev = ? RETURNING rev`).bind(blob, Date.now(), checked ? JSON.stringify(checked) : null, id, rev).first();
    if (row) return json({ rev: row.rev });
    const now = await env.DB.prepare('SELECT rev, blob FROM profiles WHERE id = ?').bind(id).first();
    return json(now, 409);
  }

  if (path === '/v1/pair' && m === 'POST') {
    await rate(env, `pair:${id}`, 10, 3600);
    const { code, wrapped } = await body(req);
    if (typeof code !== 'string' || !/^\d{6}$/.test(code) || typeof wrapped !== 'string' || wrapped.length > 1000) throw new Fail(400, 'bad pairing');
    const expires = Date.now() + PAIR_MS;
    await sweep(env);
    const ok = await env.DB.prepare('INSERT INTO pairings (code, profile, wrapped, expires) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO NOTHING RETURNING code')
      .bind(code, id, wrapped, expires).first();
    if (!ok) throw new Fail(409, 'code taken');
    return json({ expires });
  }

  if (path === '/v1/friends' && m === 'GET') {
    const card = (r) => ({ code: r.friend_code, card: r.card ? JSON.parse(r.card) : null });
    const friends = await env.DB.prepare(`SELECT p.friend_code, p.card, c.cheer AS sent FROM links l JOIN profiles p ON p.id = l.dst
      LEFT JOIN cheers c ON c.src = l.src AND c.dst = l.dst AND c.day = ?2 WHERE l.src = ?1 AND l.state = 'friends'`).bind(id, day()).all();
    const asks = await env.DB.prepare(`SELECT p.friend_code, p.card FROM links l JOIN profiles p ON p.id = l.src WHERE l.dst = ? AND l.state = 'asked'`).bind(id).all();
    const cheers = await env.DB.prepare(`SELECT p.friend_code, c.cheer, c.day FROM cheers c JOIN profiles p ON p.id = c.src
      JOIN links l ON l.src = c.dst AND l.dst = c.src AND l.state = 'friends' WHERE c.dst = ? AND c.day >= ? ORDER BY c.day DESC`).bind(id, day(-7)).all();
    return json({
      code: self.friend_code,
      friends: friends.results.map((r) => ({ ...card(r), cheered: !!r.sent })),
      asks: asks.results.map(card),
      cheers: cheers.results.map((r) => ({ code: r.friend_code, cheer: r.cheer, day: r.day })),
    });
  }

  const action = path.match(/^\/v1\/friends\/(add|accept|remove|block)$/)?.[1];
  if (action && m === 'POST') {
    const other = await byCode(env, (await body(req)).code);
    if (other === id) throw new Fail(400, 'that is you');
    const DB = env.DB;
    const set = (src, dst, state) => DB.prepare('INSERT INTO links (src, dst, state) VALUES (?, ?, ?) ON CONFLICT(src, dst) DO UPDATE SET state = excluded.state').bind(src, dst, state);
    // Removing never lifts a block the other side holds: only the blocker can.
    const drop = (src, dst) => DB.prepare(`DELETE FROM links WHERE src = ?1 AND dst = ?2 AND (state != 'blocked' OR src = ?3)`).bind(src, dst, id);
    if (action === 'add') {
      await rate(env, `add:${id}`, 30, 86400);
      const theirs = await link(env, other, id);
      // A block is never revealed: asking someone who blocked you looks like any other ask.
      if (theirs === 'blocked' || (await link(env, id, other)) === 'blocked') return json({});
      await DB.batch(theirs ? [set(id, other, 'friends'), set(other, id, 'friends')] : [set(id, other, 'asked')]);
    } else if (action === 'accept') {
      if ((await link(env, other, id)) !== 'asked') throw new Fail(404, 'no ask');
      await DB.batch([set(id, other, 'friends'), set(other, id, 'friends')]);
    } else if (action === 'remove') {
      await DB.batch([drop(id, other), drop(other, id)]);
    } else {
      await DB.batch([set(id, other, 'blocked'), drop(other, id)]);
    }
    return json({});
  }

  if (path === '/v1/cheer' && m === 'POST') {
    const { code, cheer } = await body(req);
    if (!Object.hasOwn(CHEERS, cheer)) throw new Fail(400, 'not a cheer');
    const other = await byCode(env, code);
    if ((await link(env, id, other)) !== 'friends') throw new Fail(403, 'not friends');
    const ok = await env.DB.prepare('INSERT INTO cheers (src, dst, day, cheer) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING day')
      .bind(id, other, day(), cheer).first();
    if (!ok) throw new Fail(409, 'already cheered today');
    await env.DB.prepare('DELETE FROM cheers WHERE day < ?').bind(day(-30)).run();
    return json({});
  }

  throw new Fail(404, 'not found');
}

/** A UTC date, `offset` days from today. */
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      return await route(req, env);
    } catch (e) {
      if (e instanceof Fail) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'server' }, 500);
    }
  },
};
