import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FLOWERS, PLANTS, plant, blooms, sway, MOODS, SIZE, scene, slots, place, VISITORS, visitor, animateVisitor } from '../src/garden/art.js';
import { STAGES } from '../src/garden/model.js';
import { HABITS } from '../src/subjects.js';

const STAGE_IDS = STAGES.map((_, i) => i);
const clean = (s, name) => {
  assert.match(s, /^<svg [^>]*viewBox="/, name);
  assert.doesNotMatch(s, /undefined|NaN|null/, name);
  assert.ok(s.length > 200, `${name} draws something`);
};

test('every habit in HABITS has a plant', () => {
  for (const h of HABITS) assert.ok(PLANTS[h.id], h.id);
  assert.equal(new Set(Object.values(PLANTS)).size, Object.keys(PLANTS).length, 'one plant each');
});

test('every plant draws every stage, with flowers and shut, and no holes in the geometry', () => {
  for (const h of HABITS) {
    for (const s of STAGE_IDS) {
      for (const opts of [{}, { flowers: 3 }, { flowers: 6, closed: true }]) {
        const svg = plant(h.id, s, opts);
        clean(svg, `${h.id} ${s}`);
        assert.match(svg, /<g data-part="plant">.+<\/g>/, `${h.id} ${s}`);
      }
    }
  }
});

test('stages look different from each other', () => {
  for (const h of HABITS) assert.equal(new Set(STAGE_IDS.map((s) => plant(h.id, s))).size, STAGES.length, h.id);
});

test('flowers are capped and never overlap', () => {
  const count = (svg) => (svg.match(/data-part="bloom"/g) || []).length;
  for (const h of HABITS) {
    for (const s of STAGE_IDS) {
      assert.equal(count(plant(h.id, s, { flowers: 2 })), 2);
      assert.equal(count(plant(h.id, s, { flowers: 40 })), MAX_FLOWERS);
      assert.equal(count(plant(h.id, s, { flowers: -1 })), 0);
      const b = blooms(h.id, s, MAX_FLOWERS);
      assert.equal(b.length, MAX_FLOWERS);
      for (let i = 0; i < b.length; i++) {
        assert.ok(b[i].x - b[i].r >= 0 && b[i].x + b[i].r <= 100 && b[i].y + b[i].r <= 120, `${h.id} ${s} bloom ${i} on canvas`);
        for (let j = i + 1; j < b.length; j++) {
          assert.ok(Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y) >= b[i].r + b[j].r, `${h.id} stage ${s}: blooms ${i} and ${j} overlap`);
        }
      }
    }
  }
});

test('every visitor and every scene draws, in both shapes', () => {
  for (const k of VISITORS) clean(visitor(k), k);
  for (const m of MOODS) {
    for (const shape of Object.keys(SIZE)) {
      const svg = scene(m, shape);
      clean(svg, `${m} ${shape}`);
      assert.match(svg, new RegExp(`viewBox="0 0 ${SIZE[shape].join(' ')}"`));
      assert.match(svg, /prefers-color-scheme: dark/, 'a dark palette too');
    }
  }
  assert.match(scene('resting', 'strip'), /data-part="firefly"/);
});

test('slots fit up to six plants inside each shape, without plants overlapping', () => {
  for (const shape of Object.keys(SIZE)) {
    const [W, H] = SIZE[shape];
    for (let n = 1; n <= 6; n++) {
      const at = slots(shape, n);
      assert.equal(at.length, n);
      for (const s of at) {
        assert.ok(s.x - s.w / 2 >= 0 && s.x + s.w / 2 <= W, `${shape} ${n} fits across`);
        assert.ok(s.y - s.w * 1.06 >= 0 && s.y <= H, `${shape} ${n} fits down`);
      }
      // Plants in one row sit side by side.
      for (const a of at) for (const b of at) {
        if (a !== b && a.y === b.y) assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2, `${shape} ${n} row overlap`);
      }
      assert.deepEqual([...at].sort((a, b) => a.y - b.y), at, 'back to front');
    }
  }
  assert.match(place(plant('learn', 4), slots('strip', 1)[0]), /^<svg x="[\d.]+" y="[\d.]+" width="80"/);
});

test('sway and visitors move, and stay still under reduced motion', () => {
  const calls = [];
  const part = () => ({ style: {}, animate: (frames, opts) => (calls.push([frames, opts]), 'anim') });
  const el = { querySelector: () => part(), querySelectorAll: () => [part(), part()] };
  assert.equal(sway(el), 'anim');
  assert.equal(calls[0][1].iterations, Infinity);
  for (const k of VISITORS) assert.equal(animateVisitor(el, k).length, 2, k);
  assert.equal(animateVisitor(el, 'owl'), null);
  calls.length = 0;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    assert.equal(sway(el), null);
    for (const k of VISITORS) assert.equal(animateVisitor(el, k), null, k);
  } finally { delete globalThis.matchMedia; }
  assert.equal(calls.length, 0);
});
