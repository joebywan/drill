import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../dev.js';

let mf, url, db;
before(async () => ({ mf, url, db } = await start()));
after(() => mf.dispose());

let ips = 0;
/** A fresh device: its own token and IP, so the rate limits of one test don't reach another. */
function device() {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const ip = `10.0.0.${++ips}`;
  const call = async (method, path, body, { auth = true } = {}) => {
    const res = await mf.dispatchFetch(`${url}${path}`, {
      method,
      headers: { 'CF-Connecting-IP': ip, ...(auth && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  return { token, call };
}

const card = { word: 'Sunny', animal: 'fox', streak: 3, lessons: 5, unit: 'chess:2' };

async function profile() {
  const d = device();
  const { status, body } = await d.call('POST', '/v1/profile');
  assert.equal(status, 200);
  assert.match(body.friendCode, /^[A-Z2-9]{8}$/);
  return { ...d, code: body.friendCode };
}

test('a token is needed, and a profile is made once', async () => {
  const d = device();
  assert.equal((await d.call('GET', '/v1/progress', null, { auth: false })).status, 401);
  assert.equal((await d.call('GET', '/v1/progress')).status, 404, 'no profile yet');
  const first = (await d.call('POST', '/v1/profile')).body.friendCode;
  assert.equal((await d.call('POST', '/v1/profile')).body.friendCode, first, 'idempotent');
  const row = await db.prepare('SELECT id FROM profiles WHERE friend_code = ?').bind(first).first();
  assert.notEqual(row.id, d.token, 'only a hash of the token is stored');
  assert.match(row.id, /^[0-9a-f]{64}$/);
});

test('CORS: any origin may call with a bearer token', async () => {
  const res = await mf.dispatchFetch(`${url}/v1/progress`, { method: 'OPTIONS' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(res.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});

test('progress goes up and comes back, and two devices never overwrite each other blindly', async () => {
  const d = await profile();
  assert.deepEqual((await d.call('GET', '/v1/progress')).body, { rev: 0, blob: null });
  assert.deepEqual((await d.call('PUT', '/v1/progress', { rev: 0, blob: 'AAAA', card })).body, { rev: 1 });
  assert.deepEqual((await d.call('GET', '/v1/progress')).body, { rev: 1, blob: 'AAAA' });
  const stale = await d.call('PUT', '/v1/progress', { rev: 0, blob: 'BBBB' });
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.body, { rev: 1, blob: 'AAAA' }, 'the conflict hands back what is there, to merge');
  assert.equal((await d.call('PUT', '/v1/progress', { rev: 1, blob: 'not base64!' })).status, 400);
  assert.equal((await d.call('PUT', '/v1/progress', { rev: 1, blob: 'A'.repeat(1_000_004) })).status, 400);
  assert.equal((await d.call('PUT', '/v1/progress', { rev: 1, blob: 'CCCC', card: { ...card, word: 'free text' } })).status, 400);
  assert.equal((await d.call('PUT', '/v1/progress', { rev: 1, blob: 'CCCC', card: { ...card, unit: '<b>hi</b>' } })).status, 400);
  assert.equal((await d.call('PUT', '/v1/progress', { rev: 1, blob: 'CCCC', card: { ...card, extra: 'dropped' } })).status, 200);
  const stored = await db.prepare('SELECT card FROM profiles WHERE friend_code = ?').bind(d.code).first('card');
  assert.deepEqual(JSON.parse(stored), card, 'only the preset fields are kept');
});

test('a pairing code works once, for ten minutes', async () => {
  const d = await profile();
  const other = device();
  assert.equal((await d.call('POST', '/v1/pair', { code: '12345', wrapped: 'x' })).status, 400);
  assert.equal((await d.call('POST', '/v1/pair', { code: '123456', wrapped: 'salt.sealed' })).status, 200);
  assert.equal((await device().call('POST', '/v1/pair', { code: '123456', wrapped: 'x' })).status, 404, 'needs a profile');
  assert.equal((await (await profile()).call('POST', '/v1/pair', { code: '123456', wrapped: 'x' })).status, 409, 'taken');
  const got = await other.call('POST', '/v1/pair/claim', { code: '123456' }, { auth: false });
  assert.deepEqual(got.body, { wrapped: 'salt.sealed' });
  assert.equal((await other.call('POST', '/v1/pair/claim', { code: '123456' }, { auth: false })).status, 404, 'once');
  await d.call('POST', '/v1/pair', { code: '654321', wrapped: 'w' });
  await db.prepare("UPDATE pairings SET expires = 0 WHERE code = '654321'").run();
  assert.equal((await other.call('POST', '/v1/pair/claim', { code: '654321' }, { auth: false })).status, 404, 'expired');
});

test('guessing pairing codes is rate-limited', async () => {
  const guesser = device();
  const statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await guesser.call('POST', '/v1/pair/claim', { code: String(100000 + i) }, { auth: false })).status);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(404));
  assert.deepEqual(statuses.slice(10), [429, 429]);
});

test('friends: ask, accept, see each other\'s card, unfriend', async () => {
  const a = await profile();
  const b = await profile();
  await a.call('PUT', '/v1/progress', { rev: 0, blob: 'AAAA', card });
  await b.call('PUT', '/v1/progress', { rev: 0, blob: 'AAAA', card: { ...card, word: 'Calm', animal: 'otter' } });
  assert.equal((await a.call('POST', '/v1/friends/add', { code: 'NOPE2345' })).status, 404);
  assert.equal((await a.call('POST', '/v1/friends/add', { code: a.code })).status, 400);
  assert.equal((await a.call('POST', '/v1/friends/add', { code: b.code })).status, 200);
  let bv = (await b.call('GET', '/v1/friends')).body;
  assert.equal(bv.code, b.code);
  assert.deepEqual(bv.asks, [{ code: a.code, card }]);
  assert.deepEqual(bv.friends, []);
  assert.deepEqual((await a.call('GET', '/v1/friends')).body.friends, [], 'no card until accepted');
  assert.equal((await b.call('POST', '/v1/friends/accept', { code: a.code })).status, 200);
  const av = (await a.call('GET', '/v1/friends')).body;
  assert.deepEqual(av.friends, [{ code: b.code, card: { ...card, word: 'Calm', animal: 'otter' }, cheered: false }]);
  bv = (await b.call('GET', '/v1/friends')).body;
  assert.deepEqual(bv.asks, []);
  assert.equal(bv.friends[0].code, a.code);
  await a.call('POST', '/v1/friends/remove', { code: b.code });
  assert.deepEqual((await b.call('GET', '/v1/friends')).body.friends, []);
  // Asking each other at once is a yes from both.
  await a.call('POST', '/v1/friends/add', { code: b.code });
  await b.call('POST', '/v1/friends/add', { code: a.code });
  assert.equal((await a.call('GET', '/v1/friends')).body.friends.length, 1);
});

test('a block ends it, is never revealed, and only the blocker can lift it', async () => {
  const a = await profile();
  const b = await profile();
  await a.call('POST', '/v1/friends/add', { code: b.code });
  await b.call('POST', '/v1/friends/accept', { code: a.code });
  assert.equal((await b.call('POST', '/v1/friends/block', { code: a.code })).status, 200);
  assert.deepEqual((await a.call('GET', '/v1/friends')).body.friends, []);
  assert.equal((await a.call('POST', '/v1/friends/add', { code: b.code })).status, 200, 'looks like any ask');
  assert.deepEqual((await b.call('GET', '/v1/friends')).body.asks, [], 'but never arrives');
  await a.call('POST', '/v1/friends/remove', { code: b.code });
  assert.equal((await a.call('POST', '/v1/cheer', { code: b.code, cheer: 'hi' })).status, 403);
  await b.call('POST', '/v1/friends/remove', { code: a.code }); // b lifts the block
  await a.call('POST', '/v1/friends/add', { code: b.code });
  assert.equal((await b.call('GET', '/v1/friends')).body.asks.length, 1);
});

test('one cheer a day, from the fixed set, between friends', async () => {
  const a = await profile();
  const b = await profile();
  assert.equal((await a.call('POST', '/v1/cheer', { code: b.code, cheer: 'hi' })).status, 403, 'not friends yet');
  await a.call('POST', '/v1/friends/add', { code: b.code });
  await b.call('POST', '/v1/friends/accept', { code: a.code });
  assert.equal((await a.call('POST', '/v1/cheer', { code: b.code, cheer: 'you are great' })).status, 400);
  assert.equal((await a.call('POST', '/v1/cheer', { code: b.code, cheer: 'grow' })).status, 200);
  assert.equal((await a.call('POST', '/v1/cheer', { code: b.code, cheer: 'hi' })).status, 409, 'once a day');
  const bv = (await b.call('GET', '/v1/friends')).body;
  assert.equal(bv.cheers.length, 1);
  assert.equal(bv.cheers[0].code, a.code);
  assert.equal(bv.cheers[0].cheer, 'grow');
  assert.equal((await a.call('GET', '/v1/friends')).body.friends[0].cheered, true);
});

test('delete my data removes every trace of the profile', async () => {
  const a = await profile();
  const b = await profile();
  await a.call('PUT', '/v1/progress', { rev: 0, blob: 'AAAA', card });
  await a.call('POST', '/v1/pair', { code: '777777', wrapped: 'w' });
  await a.call('POST', '/v1/friends/add', { code: b.code });
  await b.call('POST', '/v1/friends/accept', { code: a.code });
  await a.call('POST', '/v1/cheer', { code: b.code, cheer: 'hi' });
  await b.call('POST', '/v1/cheer', { code: a.code, cheer: 'hi' });
  const id = await db.prepare('SELECT id FROM profiles WHERE friend_code = ?').bind(a.code).first('id');
  assert.equal((await a.call('DELETE', '/v1/profile')).status, 200);
  for (const [table, where] of [['profiles', 'id = ?1'], ['pairings', 'profile = ?1'], ['links', 'src = ?1 OR dst = ?1'], ['cheers', 'src = ?1 OR dst = ?1'], ['rates', "substr(key, instr(key, ':') + 1) = ?1"]])
    assert.equal(await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).bind(id).first('n'), 0, table);
  assert.equal((await a.call('GET', '/v1/progress')).status, 404);
  assert.deepEqual((await b.call('GET', '/v1/friends')).body.friends, []);
  assert.deepEqual((await b.call('GET', '/v1/friends')).body.cheers, []);
});

test('busy callers are slowed down', async () => {
  const d = await profile();
  let last;
  for (let i = 0; i < 125; i++) last = (await d.call('GET', '/v1/progress')).status;
  assert.equal(last, 429);
});

test('rate rows and pairings past their time are swept when something new is made', async () => {
  await db.prepare("INSERT INTO rates (key, win, count, until) VALUES ('ip:old', 1, 5, 1000), ('ip:live', 1, 5, ?)").bind(Date.now() + 60000).run();
  const d = await profile();
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM rates WHERE key = 'ip:old'").first('n'), 0, 'ended window: gone');
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM rates WHERE key = 'ip:live'").first('n'), 1, 'current window: kept');
  await d.call('POST', '/v1/pair', { code: '424242', wrapped: 'w' });
  await db.prepare("UPDATE pairings SET expires = 0 WHERE code = '424242'").run();
  await d.call('POST', '/v1/pair', { code: '434343', wrapped: 'w' });
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM pairings WHERE code = '424242'").first('n'), 0);
});
