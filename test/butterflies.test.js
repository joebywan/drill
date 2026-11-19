import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HABITS, PRESETS, subjects } from '../src/subjects.js';
import { HABIT_COLOURS, OWN_SPECIES, PANELS, SPECIES, butterfly, butterflySide, caterpillar, chrysalis, egg, habitColour, open, side, speciesFor } from '../src/cast/butterfly.js';

const raisers = [...subjects.filter((s) => s.kind === 'learn').map((s) => s.id), ...HABITS.filter((h) => h.id !== 'learn').map((h) => h.id), ...PRESETS.map((p) => p.id)];

test('every course, practice habit and preset raises exactly one species, and none is used twice', () => {
  for (const id of raisers) assert.equal(SPECIES.filter((s) => s.raisedBy === id).length, 1, id);
  assert.ok(SPECIES.every((s) => s.raisedBy === 'own' || raisers.includes(s.raisedBy)), 'nothing raised by an unknown id');
  for (const key of ['id', 'name', 'latin']) assert.equal(new Set(SPECIES.map((s) => s[key])).size, SPECIES.length, key);
  assert.ok(OWN_SPECIES.length >= 5, 'a pool for habits of the learner\'s own');
  assert.equal(speciesFor('chess').name, 'Chequered Swallowtail');
  assert.equal(speciesFor('my-own-habit', OWN_SPECIES.length + 1), OWN_SPECIES[1], 'own habits cycle the pool by index');
});

test('every field-guide line is short, plain and has its source beside it', () => {
  for (const s of SPECIES) {
    assert.ok(s.lines.length >= 1 && s.lines.length <= 2, s.id);
    for (const { text, source } of s.lines) {
      assert.ok(text.length <= 140, `${s.id}: ${text}`);
      assert.match(source?.url || '', /^https:\/\/[^\s]+\.[a-z]+\//, `${s.id}: ${text}`);
      assert.ok(source.publisher, `${s.id}: ${text}`);
    }
  }
});

test('every habit has a panel colour, and own habits cycle through theirs', () => {
  for (const id of [...HABITS.map((h) => h.id), ...PRESETS.map((p) => p.id)]) assert.ok(HABIT_COLOURS[id], id);
  assert.equal(new Set(Object.values(HABIT_COLOURS)).size, Object.keys(HABIT_COLOURS).length);
  assert.notEqual(habitColour('mine', 0), habitColour('mine', 1));
});

test('every drawing is under 3 KB of SVG, whole, and has wings to flap', () => {
  const full = Array.from({ length: PANELS }, (_, i) => habitColour('own', i));
  const drawings = [['yours', butterfly(full)], ['yours empty', butterfly([], false)], ['yours side', butterflySide(full)],
    ['egg', egg()], ['caterpillar', caterpillar(1)], ['chrysalis', chrysalis()],
    ...SPECIES.flatMap((s) => [[s.id, open(s.art)], [`${s.id} side`, side(s.art)]])];
  for (const [name, svg] of drawings) {
    assert.ok(svg.length < 3072, `${name}: ${svg.length} bytes`);
    assert.doesNotMatch(svg, /undefined|NaN|null/, name);
  }
  for (const [name, svg] of drawings.filter(([n]) => !/egg|caterpillar|chrysalis/.test(n))) {
    assert.match(svg, /data-part="wings"/, name);
    assert.match(svg, /data-part="body"/, name);
  }
});

test('the caterpillar grows with growth: more segments, and bigger', () => {
  const look = (g) => { const s = caterpillar(g); return [s.match(/scale\(([\d.]+)\)/)[1], (s.match(/<circle/g) || []).length].map(Number); };
  const steps = [0, 0.25, 0.5, 0.75, 1].map(look);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i][0] > steps[i - 1][0] && steps[i][1] > steps[i - 1][1], `growth step ${i}`);
  assert.deepEqual(look(-1), look(0));
  assert.deepEqual(look(2), look(1));
});

test('bodies take the theme colour by default, or a colour passed in for places with no CSS', () => {
  const art = SPECIES[0].art;
  for (const svg of [butterfly(), butterflySide(), open(art), side(art), caterpillar(1)]) assert.match(svg, /style="color:var\(--butterfly-body, #1E1B2E\)"/);
  for (const svg of [butterfly(undefined, true, '#123456'), butterflySide(undefined, '#123456'), open(art, '#123456'), side(art, '#123456'), caterpillar(1, undefined, '#123456')]) {
    assert.doesNotMatch(svg, /var\(|currentColor/);
    assert.match(svg, /#123456/);
  }
});
