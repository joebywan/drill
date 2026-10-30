import { currentStreak } from '../progress.js';
import { derive, newPairCode, newRecovery, open, readRecovery, seal, unwrap, wrap } from './keys.js';
import { merge } from './merge.js';
import { ANIMALS, WORDS } from './presets.js';
import { API } from './config.js';

/**
 * Sync and friends: an opt-in layer over the device's own progress, which stays the record.
 * Off until turned on from the ⋯ menu; with it off, nothing here runs and nothing is sent.
 * The one place in src/ that talks to a server (the guardrails test holds that).
 */
const KEY = 'drill.sync'; // { recovery, word, animal, code }: this device's copy of the profile
let keys = null; // { recovery, key, token }, derived once a visit

export function profile() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    return p && readRecovery(p.recovery) ? p : null;
  } catch { return null; }
}

function keep(p) {
  try { if (p) localStorage.setItem(KEY, JSON.stringify(p)); else localStorage.removeItem(KEY); } catch { /* private mode: lasts the visit */ }
}

async function keysFor(recovery) {
  if (keys?.recovery !== recovery) keys = { recovery, ...(await derive(recovery)) };
  return keys;
}

/** A failed call: `status` is the server's answer, 0 when it couldn't be reached. */
export class SyncError extends Error {
  constructor(status, body) { super(body?.error || `sync ${status}`); this.status = status; this.body = body; }
}

async function call(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
  } catch { throw new SyncError(0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SyncError(res.status, data);
  return data;
}

const authed = async (path, opts = {}) => call(path, { ...opts, token: (await keysFor(profile().recovery)).token });

/** The public card friends see: numbers and presets, nothing else. `unit` is 'subject:index' or null. */
export function card(progress, look, now = new Date(), unit = null) {
  const streak = Math.max(0, ...Object.keys(progress.habits).map((h) => currentStreak(progress, now, h)));
  return { word: look.word, animal: look.animal, streak, lessons: Object.keys(progress.done).length, unit };
}

const pick = (list) => list[crypto.getRandomValues(new Uint32Array(1))[0] % list.length];

/**
 * Turns sync on with `recovery` (a new profile when none is given), then syncs. Returns the
 * merged progress. A device joining an existing profile merges its own progress in: nothing on
 * either side is lost.
 */
export async function join(progress, recovery = newRecovery(), unit = null) {
  const { token } = await keysFor(recovery);
  const { friendCode } = await call('/v1/profile', { method: 'POST', token });
  keep({ word: pick(WORDS), animal: pick(Object.keys(ANIMALS)), ...profile(), recovery, code: friendCode });
  return sync(progress, unit);
}

/**
 * Downloads, decrypts and merges what other devices uploaded, then uploads the merged progress
 * (encrypted) and the public card. If another device uploaded in between, merges again. Returns the
 * merged progress, or null with sync off.
 */
export async function sync(progress, unit = null) {
  const me = profile();
  if (!me) return null;
  const { key, token } = await keysFor(me.recovery);
  let { rev, blob } = await call('/v1/progress', { token });
  for (let tries = 0; ; tries++) {
    const merged = blob ? merge(progress, await open(key, blob)) ?? progress : progress;
    try {
      await call('/v1/progress', { method: 'PUT', token, body: { rev, blob: await seal(key, merged), card: card(merged, me, new Date(), unit) } });
      return merged;
    } catch (e) {
      if (e.status !== 409 || tries >= 3) throw e;
      ({ rev, blob } = e.body);
    }
  }
}

/** A 6-digit code another device can enter within ten minutes to join this profile. */
export async function pairCode() {
  const { recovery } = profile();
  for (let tries = 0; ; tries++) {
    const code = newPairCode();
    try {
      await authed('/v1/pair', { method: 'POST', body: { code, wrapped: await wrap(code, recovery) } });
      return code;
    } catch (e) { if (e.status !== 409 || tries >= 3) throw e; }
  }
}

/** The recovery code a pairing code holds (it works once). */
export async function claim(code) {
  const { wrapped } = await call('/v1/pair/claim', { method: 'POST', body: { code } });
  return unwrap(code, wrapped);
}

export const setLook = (look) => keep({ ...profile(), ...look });
export const friends = () => authed('/v1/friends');
export const friendAction = (action, code) => authed(`/v1/friends/${action}`, { method: 'POST', body: { code } });
export const cheer = (code, id) => authed('/v1/cheer', { method: 'POST', body: { code, cheer: id } });

/** Deletes everything the server keeps for this profile, and turns sync off here. Progress on the device stays. */
export async function forget() {
  // Already gone (deleted from another device or the web page) is as good as deleted.
  await authed('/v1/profile', { method: 'DELETE' }).catch((e) => { if (e.status !== 404) throw e; });
  keep(null);
  keys = null;
}
