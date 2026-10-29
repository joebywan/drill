import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOODS } from '../src/cast/kit.js';
import { rosa } from '../src/cast/rosa.js';
import { lumi } from '../src/cast/lumi.js';
import { MOODS as CALM, moss, breathe } from '../src/cast/moss.js';

const drawings = [
  ...MOODS.map((m) => [`rosa ${m}`, rosa(m)]),
  ...MOODS.map((m) => [`lumi ${m}`, lumi(m)]),
  ...CALM.map((m) => [`moss ${m}`, moss(m)]),
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
  assert.equal(new Set(CALM.map(moss)).size, CALM.length);
});

test('breathe animates the body for exactly the phase, and stays still under reduced motion', () => {
  const calls = [];
  const body = { style: {}, animate: (frames, opts) => (calls.push([frames, opts]), 'anim') };
  const el = { querySelector: (q) => (q === '[data-part="body"]' ? body : null) };
  assert.equal(breathe(el, 'in', 4), 'anim');
  assert.equal(calls[0][1].duration, 4000);
  assert.equal(calls[0][1].fill, 'forwards');
  assert.notEqual(calls[0][0][0].transform, calls[0][0][1].transform);
  breathe(el, 'out', 8);
  assert.equal(calls[1][1].duration, 8000);
  assert.equal(calls[1][0][0].transform, calls[0][0][1].transform); // out starts where in ended
  assert.equal(breathe(el, 'sigh', 1), null);
  globalThis.matchMedia = () => ({ matches: true });
  try { assert.equal(breathe(el, 'hold', 4), null); } finally { delete globalThis.matchMedia; }
  assert.equal(calls.length, 2);
});
