import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOODS } from '../src/cast/kit.js';
import { rosa } from '../src/cast/rosa.js';
import { lumi } from '../src/cast/lumi.js';

const drawings = [
  ...MOODS.map((m) => [`rosa ${m}`, rosa(m)]),
  ...MOODS.map((m) => [`lumi ${m}`, lumi(m)]),
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
  assert.equal(faces(lumi).size, MOODS.length);
});
