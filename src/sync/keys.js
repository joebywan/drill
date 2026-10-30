/**
 * The profile's secret, and what is derived from it, with WebCrypto only (no library). The
 * secret is the recovery code: 20 characters, 100 random bits, kept on the device. HKDF turns it
 * into two independent things: the AES-GCM key that encrypts progress (never leaves the device)
 * and the bearer token the server knows the profile by (it stores only the token's hash). So the
 * server can tell two uploads came from the same profile but can read neither.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford's base32: no I, L, O or U
const enc = new TextEncoder();

export function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); // a whole blob overflows one call's arguments
  return btoa(s);
}
export const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A new recovery code, "XXXX-XXXX-XXXX-XXXX-XXXX". */
export function newRecovery() {
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => ALPHABET[b & 31]).join('');
  return chars.match(/.{4}/g).join('-');
}

/**
 * A typed recovery code in the canonical form, or null. Forgiving the way Crockford's base32 is:
 * any case, spaces or dashes anywhere, O read as 0 and I or L as 1.
 */
export function readRecovery(text) {
  const chars = String(text).toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (chars.length !== 20 || [...chars].some((c) => !ALPHABET.includes(c))) return null;
  return chars.match(/.{4}/g).join('-');
}

/** { key, token } from a recovery code: the AES-GCM key for progress, and the server's bearer token. */
export async function derive(recovery) {
  const base = await crypto.subtle.importKey('raw', enc.encode(recovery), 'HKDF', false, ['deriveKey', 'deriveBits']);
  const params = (info) => ({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('drill-sync-v1'), info: enc.encode(info) });
  const key = await crypto.subtle.deriveKey(params('progress key'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const token = b64url(new Uint8Array(await crypto.subtle.deriveBits(params('server token'), base, 256)));
  return { key, token };
}

/** base64(iv ‖ AES-GCM ciphertext) of `data` (any JSON). */
export async function seal(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return b64(out);
}

/** What `seal` sealed; throws when the key is wrong or the blob was changed. */
export async function open(key, blob) {
  const bytes = unb64(blob);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return JSON.parse(new TextDecoder().decode(plain));
}

/**
 * The key a 6-digit pairing code wraps the recovery code with, on its way to a new device:
 * PBKDF2 with a random salt sent alongside. A million codes is a small space, so this only slows
 * a guesser down; what protects a pairing is that it lives ten minutes, works once, and the
 * server limits claims (server/worker.js).
 */
async function codeKey(code, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 200_000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** "salt.sealed": the recovery code sealed under a key from the pairing code. */
export async function wrap(code, recovery) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${b64(salt)}.${await seal(await codeKey(code, salt), recovery)}`;
}

export async function unwrap(code, wrapped) {
  const [salt, sealed] = wrapped.split('.');
  return open(await codeKey(code, unb64(salt)), sealed);
}

/** A random 6-digit pairing code, as a string with its leading zeros. */
export const newPairCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
