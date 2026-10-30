import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextTile, paired, picked, problem, shuffle, tilesOf } from '../src/quiz/items.js';

const course = JSON.parse(readFileSync(new URL('../src/data/japanese.json', import.meta.url)));
const lessons = course.units.flatMap((u) => u.lessons);
const all = lessons.flatMap((l) => l.items);

// Written out here, apart from the course, so a slip in the data can't check itself.
const KANA = { あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so' };
const MEANS = { かお: 'face', あき: 'autumn', いけ: 'pond', えき: 'station', すし: 'sushi', あさ: 'morning', かさ: 'umbrella', いす: 'chair', しお: 'salt', うし: 'cow', しか: 'deer', ここ: 'here', そこ: 'there', あお: 'blue', いえ: 'house', すいか: 'watermelon', おかし: 'sweets' };
const kana = (s) => [...s].every((k) => KANA[k]);
const read = (s) => [...s].map((k) => KANA[k]).join('');

test('every Japanese item passes problem(), and ids are unique', () => {
  for (const item of all) assert.equal(problem(item), null, item.id);
  assert.equal(new Set(all.map((i) => i.id)).size, all.length);
});

test('every answer is the true reading, worked out from the kana', () => {
  for (const item of all) {
    if (item.speak) assert.ok(kana(item.speak), `${item.id} speaks kana`);
    if (item.type === 'teach' && kana(item.show)) assert.equal(item.read.replaceAll(' ', ''), read(item.show), item.id);
    if (item.type === 'pick') {
      if (kana(item.answer)) assert.equal(read(item.answer), item.show, item.id); // which kana says this
      else assert.equal(read(item.show), item.answer, item.id); // how does this read
      if (item.listen) assert.equal(item.speak, item.answer, item.id);
      // No other option may also be right.
      for (const o of item.options) if (o !== item.answer) assert.notEqual(kana(o) ? read(o) : o, kana(item.answer) ? item.show : item.answer, `${item.id}: ${o}`);
    }
    if (item.type === 'pairs') for (const [l, r] of item.pairs) assert.ok(r === read(l) || r === MEANS[l], `${item.id}: ${l} ${r}`);
    if (item.type === 'build') {
      const w = item.answer.join('');
      assert.ok(item.show.startsWith(`${read(w)}: ${MEANS[w]}`), item.id);
      assert.equal(item.speak, w, item.id);
    }
  }
});

test('teaching from zero: no kana is asked before a teach card has shown it', () => {
  const taught = new Set();
  for (const l of lessons) for (const item of l.items) {
    const used = [item.show, item.speak, item.answer, ...(item.options || []), ...(item.tiles || []), ...(item.pairs || []).flat()]
      .flat().filter(Boolean).join('');
    if (item.type === 'teach') for (const k of item.show) taught.add(k);
    for (const k of used) if (KANA[k]) assert.ok(taught.has(k), `${item.id} uses ${k} before it is taught`);
  }
});

test('the placement question points at real units', async () => {
  const { subjects } = await import('../src/subjects.js');
  const jp = subjects.find((s) => s.id === 'japanese');
  for (const [, unit] of jp.placement.options) assert.ok(jp.units.some((u) => u.title === unit), unit);
  assert.equal(jp.placement.options[0][1], jp.units[0].title);
});

test('the item rules: shuffle keeps everything, picks, pairs and tiles judge one tap', () => {
  let i = 0;
  const rand = () => [0.9, 0.1, 0.5][i++ % 3];
  assert.deepEqual(shuffle([1, 2, 3, 4], rand).sort(), [1, 2, 3, 4]);
  const pick = { answer: 'a', options: ['a', 'i'] };
  assert.ok(picked(pick, 'a'));
  assert.ok(!picked(pick, 'i'));
  const pairs = { pairs: [['あ', 'a'], ['い', 'i']] };
  assert.ok(paired(pairs, 'あ', 'a'));
  assert.ok(!paired(pairs, 'あ', 'i'));
  const build = { answer: ['こ', 'こ'], tiles: ['く'] };
  assert.equal(nextTile(build, 1), 'こ');
  assert.deepEqual(tilesOf(build).sort(), ['く', 'こ', 'こ']);
  assert.match(problem({ id: 'x', type: 'pick', show: 'あ', prompt: '?', options: ['a', 'a'], answer: 'a', explain: '.' }), /different/);
  assert.match(problem({ id: 'x', type: 'build', show: 'x', prompt: '?', answer: ['こ'], tiles: ['こ'], explain: '.' }), /decoy/);
  assert.match(problem({ id: 'x', type: 'pick', show: 'あ', prompt: '?', options: ['a', 'i'], answer: 'a' }), /explanation/);
});
