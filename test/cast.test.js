import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOODS } from '../src/cast/kit.js';
import { rosa } from '../src/cast/rosa.js';
import { lumi } from '../src/cast/lumi.js';
import { MOODS as CALM, moss, breathe } from '../src/cast/moss.js';
import * as Clover from '../src/cast/clover.js';
import * as Mira from '../src/cast/mira.js';
import { ada } from '../src/cast/ada.js';
import * as Hazel from '../src/cast/hazel.js';
import * as Fennel from '../src/cast/fennel.js';

// The posable characters, each drawn with kit.js rig(): [module, draw].
const posed = [[Clover, Clover.clover], [Mira, Mira.mira], [Hazel, Hazel.hazel], [Fennel, Fennel.fennel]];

const drawings = [
  ...MOODS.map((m) => [`rosa ${m}`, rosa(m)]),
  ...MOODS.map((m) => [`lumi ${m}`, lumi(m)]),
  ...MOODS.map((m) => [`ada ${m}`, ada(m)]),
  ...CALM.map((m) => [`moss ${m}`, moss(m)]),
  ...posed.flatMap(([c, draw]) => [...c.MOODS.map((m) => [`${c.NAME} ${m}`, draw(m)]), ...c.POSES.map((p) => [`${c.NAME} ${p}`, draw('guide', p)])]),
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
  assert.equal(faces(ada).size, MOODS.length);
  assert.equal(new Set(CALM.map(moss)).size, CALM.length);
  for (const [c, draw] of posed) {
    assert.equal(new Set(c.MOODS.map((m) => draw(m))).size, c.MOODS.length, c.NAME);
    assert.equal(new Set(c.POSES.map((p) => draw('guide', p))).size, c.POSES.length, c.NAME);
  }
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
  // The double-inhale sigh: in, a top-up past full, then a sigh out from there to rest.
  breathe(el, 'top', 1);
  breathe(el, 'sigh', 6);
  assert.equal(calls[2][0][0].transform, calls[0][0][1].transform, 'the top-up starts where in ended');
  assert.equal(calls[3][0][0].transform, calls[2][0][1].transform, 'the sigh starts where the top-up ended');
  assert.equal(calls[3][0][1].transform, calls[0][0][0].transform, 'and settles to rest');
  assert.equal(breathe(el, 'gasp', 1), null);
  globalThis.matchMedia = () => ({ matches: true });
  try { assert.equal(breathe(el, 'hold', 4), null); } finally { delete globalThis.matchMedia; }
  assert.equal(calls.length, 4);
});

for (const [{ NAME, POSES, demo }, draw] of posed) {
  test(`a ${NAME} pose moves the same parts, never redraws them`, () => {
    const parts = (s) => s.match(/data-part="[^"]+"/g).join();
    const shape = (s) => s.replace(/style="[^"]*"|data-pose="[^"]*"/g, '');
    for (const p of POSES) {
      assert.equal(parts(draw('guide', p)), parts(draw('guide')), p);
      assert.equal(shape(draw('guide', p)), shape(draw('guide')), p);
      assert.match(draw('guide', p), new RegExp(`data-pose="${p}"`));
    }
  });

  test(`every ${NAME} pose changes the 48 px silhouette, not just the face`, () => {
    const outline = (s) => s.replace(/data-part="(eyes|lids)" style="[^"]*"/g, '');
    for (const p of POSES) assert.notEqual(outline(draw('idle', p)), outline(draw('idle')), p);
  });

  test(`${NAME}'s demo runs every pose for exactly seconds over reps, and stays still under reduced motion`, () => {
    const calls = [];
    const part = { animate: (frames, opts) => (calls.push([frames, opts]), 'anim') };
    const el = { querySelector: () => part };
    const n = demo(el, POSES[0], 6, 3).length;
    assert.ok(n >= 7, NAME); // body, torso, head, arms and legs at least
    for (const p of POSES) {
      calls.length = 0;
      const anims = demo(el, p, 6, 3);
      assert.equal(anims.length, n, p);
      for (const [frames, opts] of calls) {
        assert.equal(opts.duration, 2000, p);
        assert.equal(opts.iterations, 3, p);
        assert.equal(frames.at(0).transform, frames.at(-1).transform, p); // each rep ends standing
      }
      assert.ok(calls.some(([f]) => f[0].transform !== f[1].transform), `${p} moves something`);
    }
    assert.equal(demo(el, POSES[0], 4).length, n);
    assert.equal(calls.at(-1)[1].duration, 4000);
    assert.equal(demo(el, 'cartwheel', 4, 1), null);
    calls.length = 0;
    globalThis.matchMedia = () => ({ matches: true });
    try { assert.equal(demo(el, POSES[0], 4, 2), null); } finally { delete globalThis.matchMedia; }
    assert.equal(calls.length, 0);
  });
}

test("Mira's slow blink closes her eyes through the lids, held still under reduced motion", () => {
  assert.match(Mira.mira('guide', 'blink'), /data-part="eyes" style="[^"]*scale\(1, 0\.05\)/);
  assert.match(Mira.mira('guide', 'blink'), /data-part="lids" style="[^"]*scale\(1, 1\)/);
  assert.match(Mira.mira('guide'), /data-part="eyes" style="[^"]*scale\(1, 1\)/);
  assert.match(Mira.mira('guide'), /data-part="lids" style="[^"]*scale\(1, 0\)/);
});

test('Mira sits tall on a log that only shows when she sits', () => {
  assert.match(Mira.mira('guide', 'sit-tall'), /data-part="seat" style="[^"]*scale\(1, 1\)/);
  for (const p of Mira.POSES.filter((x) => x !== 'sit-tall')) assert.match(Mira.mira('guide', p), /data-part="seat" style="[^"]*scale\(1, 0\)/, p);
});

test('Hazel holds her stick while you focus, and puts it away otherwise', () => {
  assert.match(Hazel.hazel('focus'), /data-part="stick" style="[^"]*scale\(1, 1\)/);
  for (const m of Hazel.MOODS.filter((x) => x !== 'focus')) assert.match(Hazel.hazel(m), /data-part="stick" style="[^"]*scale\(1, 0\)/, m);
});
