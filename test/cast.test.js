import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOODS } from '../src/cast/kit.js';
import { rosa } from '../src/cast/rosa.js';
import { lumi, LIGHTS } from '../src/cast/lumi.js';

const drawings = [
  ...MOODS.map((m) => [`rosa ${m}`, rosa(m)]),
  ...MOODS.flatMap((m) => LIGHTS.map((l) => [`lumi ${m} ${l}`, lumi(m, l)])),
];

test('every character draws every mood, with no holes in the geometry', () => {
  for (const [name, s] of drawings) {
    assert.match(s, /^<svg [^>]*viewBox="0 0 100 120"/, name);
    assert.doesNotMatch(s, /undefined|NaN|null/, name);
    assert.match(s, /data-part="eyes"/, name);
  }
});

test('moods look different from each other', () => {
  const faces = (draw) => new Set(MOODS.map((m) => draw(m)));
  assert.equal(faces(rosa).size, MOODS.length);
  assert.equal(faces((m) => lumi(m)).size, MOODS.length);
});

test('Lumi never goes dark: every light keeps a lit glass', () => {
  for (const l of LIGHTS) assert.match(lumi('teach', l), /data-part="glass"[^>]*fill="#[0-9A-F]{6}"/, l);
});
