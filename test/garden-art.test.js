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

import { perches, drawGarden, flower, plantBox, BOUNDS } from '../src/garden/art.js';

test('no visitor sits on any plant: every plant, every stage, 1–6 plants, both shapes', () => {
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const check = (plants, shape, name) => {
    const [W, H] = SIZE[shape];
    const at = slots(shape, plants.length);
    const boxes = plants.map((p, i) => plantBox(p.habit, p.stage, at[i]));
    perches(plants, shape).forEach((spot, i) => {
      for (const [kind, b] of Object.entries(spot)) {
        const where = `${name} plant ${i} ${kind}`;
        assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `${where} in the scene`);
        boxes.forEach((p, j) => assert.ok(!hit(b, p), `${where} on plant ${j}`));
      }
    });
  };
  for (const shape of Object.keys(SIZE)) {
    for (let n = 1; n <= 6; n++) {
      for (const h of HABITS) {
        for (const s of STAGE_IDS) check(Array(n).fill({ habit: h.id, stage: s }), shape, `${shape} ${n}× ${h.id} ${s}`);
      }
      // Mixed gardens: each plant at a different stage, the stages turning round.
      for (const s of STAGE_IDS) {
        check(Array.from({ length: n }, (_, i) => ({ habit: HABITS[i % HABITS.length].id, stage: (s + i) % 5 })), shape, `${shape} ${n} mixed ${s}`);
      }
    }
  }
  for (const name of Object.values(PLANTS)) assert.equal(BOUNDS[name]?.length, 5, `${name} is measured`);
});

test('past six plants, up to MAX_PLANTS of every kind: no visitor sits on any plant, no plants overlap in a row', async () => {
  const { KINDS: kinds } = await import('../src/garden/art.js');
  const { MAX_PLANTS: most } = await import('../src/garden/scene.js');
  for (const name of kinds) assert.equal(BOUNDS[name]?.length, 5, `${name} is measured`);
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const shape of Object.keys(SIZE)) {
    const [W, H] = SIZE[shape];
    for (let n = 7; n <= most; n++) {
      for (const s of STAGE_IDS) {
        // Own habits by their chosen drawing, mixed with built-ins, each a stage on from the last.
        const plants = Array.from({ length: n }, (_, i) => ({ habit: `own-${i}`, plant: kinds[(i + s) % kinds.length], stage: (s + i) % 5 }));
        const at = slots(shape, n);
        const boxes = plants.map((p, i) => plantBox(p.plant, p.stage, at[i]));
        perches(plants, shape).forEach((spot, i) => {
          for (const [kind, b] of Object.entries(spot)) {
            const where = `${shape} ${n} ${s} plant ${i} ${kind}`;
            assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `${where} in the scene`);
            boxes.forEach((p, j) => assert.ok(!hit(b, p), `${where} on plant ${j}`));
          }
        });
      }
    }
  }
});

test('a drawn garden has every plant at its stage, flowers capped at what the art draws, and its visitors', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ gift: 'flower', on: '2026-10-01', id: `f${i}` }));
  const all = ['butterfly', 'bee', 'birds'].map((gift) => ({ gift, on: '2026-10-01', id: gift }));
  const plants = HABITS.map((h, i) => ({ habit: h.id, stage: i % 5, flowers: many, visitors: all }));
  for (const shape of ['strip', 'tall']) {
    const svg = drawGarden({ mood: 'sunlit', plants }, shape);
    clean(svg, shape);
    for (const p of plants) assert.match(svg, new RegExp(`class="plant plant-\\w+ stage-${p.stage}" data-habit="${p.habit}"`), p.habit);
    assert.equal(svg.match(/data-part="bloom"/g).length, plants.length * MAX_FLOWERS, 'capped');
    assert.equal(svg.match(/class="visitor /g).length, plants.length * 3);
    assert.equal(svg.match(/<svg /g).length, 1 + plants.length * 4, 'one scene');
  }
  const resting = drawGarden({ mood: 'resting', plants: plants.slice(0, 1) });
  assert.equal(resting, drawGarden({ mood: 'resting', plants: plants.slice(0, 1) }), 'the same every time');
  assert.match(resting, /garden-resting/);
  assert.doesNotMatch(drawGarden({ mood: 'sunlit', plants: [] }, 'strip'), /class="plant /, 'nothing unearned is drawn');
  for (const h of HABITS) clean(flower(h.id), h.id);
});

import { KINDS } from '../src/garden/art.js';
import { MAX_PLANTS } from '../src/garden/scene.js';

test('the plants a self-reported habit picks draw every stage, differ by stage, sway, and keep blooms apart', () => {
  const extra = KINDS.filter((k) => !Object.values(PLANTS).includes(k));
  assert.deepEqual(extra, ['tulip', 'fern', 'cactus', 'rose', 'mushroom']);
  for (const k of extra) {
    for (const s of STAGE_IDS) {
      for (const opts of [{}, { flowers: 3 }, { flowers: 6, closed: true }]) clean(plant(k, s, opts), `${k} ${s}`);
      const b = blooms(k, s, MAX_FLOWERS);
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) assert.ok(Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y) >= b[i].r + b[j].r);
    }
    assert.equal(new Set(STAGE_IDS.map((s) => plant(k, s))).size, STAGES.length, k);
    // A plant with a flower of its own shuts it at rest.
    if (['tulip', 'cactus', 'rose'].includes(k)) assert.notEqual(plant(k, 4), plant(k, 4, { closed: true }), `${k} rests`);
    clean(flower(k), k);
  }
  // `kind` draws a habit as the plant it chose, and the tap still finds the habit.
  const own = plant('own-1', 2, { kind: 'cactus' });
  assert.match(own, /class="plant plant-cactus stage-2" data-habit="own-1"/);
  const part = { style: {}, animate: () => 'anim' };
  assert.equal(sway({ querySelector: () => part }), 'anim');
});

test('past six plants the garden takes more rows, up to MAX_PLANTS, and draws no more than fit', () => {
  for (const shape of Object.keys(SIZE)) {
    const [W, H] = SIZE[shape];
    for (let n = 7; n <= MAX_PLANTS; n++) {
      const at = slots(shape, n);
      assert.equal(at.length, n);
      for (const s of at) assert.ok(s.x - s.w / 2 >= 0 && s.x + s.w / 2 <= W && s.y - s.w * 1.06 >= 0 && s.y <= H, `${shape} ${n}`);
      for (const a of at) for (const b of at) if (a !== b && a.y === b.y) assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2, `${shape} ${n} row overlap`);
      assert.deepEqual([...at].sort((a, b) => a.y - b.y), at, 'back to front');
    }
    assert.equal(slots(shape, 40).length, MAX_PLANTS);
  }
  const many = Array.from({ length: 15 }, (_, i) => ({ habit: `own-${i}`, plant: KINDS[i % KINDS.length], stage: 2, flowers: [], visitors: [] }));
  assert.equal(drawGarden({ mood: 'sunlit', plants: many }, 'strip').match(/class="plant /g).length, MAX_PLANTS);
});
