import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOODS } from '../src/cast/kit.js';
import { rosa } from '../src/cast/rosa.js';
import { lumi } from '../src/cast/lumi.js';
import { MOODS as CALM, moss, breathe } from '../src/cast/moss.js';
import { MOODS as MOVE, POSES, clover, demo } from '../src/cast/clover.js';

const drawings = [
  ...MOODS.map((m) => [`rosa ${m}`, rosa(m)]),
  ...MOODS.map((m) => [`lumi ${m}`, lumi(m)]),
  ...CALM.map((m) => [`moss ${m}`, moss(m)]),
  ...MOVE.map((m) => [`clover ${m}`, clover(m)]),
  ...POSES.map((p) => [`clover ${p}`, clover('guide', p)]),
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
  assert.equal(new Set(MOVE.map((m) => clover(m))).size, MOVE.length);
  assert.equal(new Set(POSES.map((p) => clover('guide', p))).size, POSES.length);
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

test('a Clover pose moves the same parts, never redraws them', () => {
  const parts = (s) => s.match(/data-part="[^"]+"/g).join();
  const shape = (s) => s.replace(/style="[^"]*"|data-pose="[^"]*"/g, '');
  for (const p of POSES) {
    assert.equal(parts(clover('guide', p)), parts(clover('guide')), p);
    assert.equal(shape(clover('guide', p)), shape(clover('guide')), p);
    assert.match(clover('guide', p), new RegExp(`data-pose="${p}"`));
  }
});

test('demo runs every pose for exactly seconds over reps, and stays still under reduced motion', () => {
  const calls = [];
  const part = { animate: (frames, opts) => (calls.push([frames, opts]), 'anim') };
  const el = { querySelector: () => part };
  for (const p of POSES) {
    calls.length = 0;
    const anims = demo(el, p, 6, 3);
    assert.equal(anims.length, 7, p);
    for (const [frames, opts] of calls) {
      assert.equal(opts.duration, 2000, p);
      assert.equal(opts.iterations, 3, p);
      assert.equal(frames.at(0).transform, frames.at(-1).transform, p); // each rep ends standing
    }
    assert.ok(calls.some(([f]) => f[0].transform !== f[1].transform), `${p} moves something`);
  }
  assert.equal(demo(el, 'squat', 4).length, 7);
  assert.equal(calls.at(-1)[1].duration, 4000);
  assert.equal(demo(el, 'cartwheel', 4, 1), null);
  calls.length = 0;
  globalThis.matchMedia = () => ({ matches: true });
  try { assert.equal(demo(el, 'squat', 4, 2), null); } finally { delete globalThis.matchMedia; }
  assert.equal(calls.length, 0);
});
