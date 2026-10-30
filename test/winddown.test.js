import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { breaths, scan, sighs } from '../src/calm/routines.js';
import { total } from '../src/practice/timeline.js';
import { sequence } from '../src/practice/kit.js';
import { subjects } from '../src/subjects.js';

const course = JSON.parse(readFileSync('src/data/winddown.json', 'utf8'));
const calm = JSON.parse(readFileSync('src/data/calm.json', 'utf8'));
const runs = course.units.flatMap((u) => u.lessons).flatMap((l) => l.items).filter((i) => i.type === 'sequence');

/** A sequence's seconds, with Calm's own builders and `own` timings (what Wind down plays). */
const seconds = (item, own) => item.parts.reduce((s, p) => s + ({
  settle: () => total(course.settle), goodnight: () => 0,
  breathe: () => total(breaths(p.cycles, own)), sigh: () => total(sighs(p.cycles, own)), scan: () => total(scan(calm.zones, p.seconds, own)),
}[p.type])(), 0);

test('Wind down is settle in, Calm breathing, a sigh, goodnight; later the body scan joins', () => {
  for (const r of runs) {
    assert.equal(r.parts[0].type, 'settle', r.id);
    assert.equal(r.parts.at(-1).type, 'goodnight', r.id);
    assert.ok(r.parts.some((p) => p.type === 'breathe') && r.parts.some((p) => p.type === 'sigh'), r.id);
  }
  assert.ok(runs.at(-1).parts.some((p) => p.type === 'scan'));
});

test('the path grows gently, and every wind down is short', () => {
  const s = runs.map((r) => seconds(r));
  for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1], `${s}`);
  for (const x of s) assert.ok(x >= 45 && x <= 300, `${x}s`);
});

test("your Calm timings reach Wind down's breathing, sighs and scan", () => {
  const subject = subjects.find((x) => x.habit === 'winddown');
  assert.equal(subject.timings, 'calm');
  assert.equal(subject.kind, 'practice');
  assert.ok(subject.night);
  const own = { inhale: 6, exhale: 10, scan: 20, sighOut: 8 };
  assert.ok(seconds(runs.at(-1), own) > seconds(runs.at(-1)));
  assert.deepEqual(breaths(1, own).map((p) => p.seconds), [6, 10]);
});

test('sequence() plays each part once, in order, and ends once with their summaries', () => {
  const el = { querySelector: () => null };
  const played = [];
  const stopped = [];
  let finished = 0;
  let summary;
  const ends = [];
  const stop = sequence(el, [{ n: 1 }, { n: 2 }, { n: 3 }], { done: (_, s) => { finished++; summary = s; } }, (at, part, ctx) => {
    played.push(part.n);
    ends.push(() => ctx.done(null, part.n === 2 ? '' : `part ${part.n}`));
    return () => stopped.push(part.n);
  });
  assert.deepEqual(played, [1]);
  ends[0]();
  assert.deepEqual(played, [1, 2]);
  stop();
  assert.deepEqual(stopped, [2], 'cleanup stops the part playing');
  ends[1]();
  ends[2]();
  assert.equal(finished, 1);
  assert.equal(summary, 'part 1 · part 3', 'a part with nothing to say is left out');
});
