import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextTile, paired, picked, problem, shuffle, tilesOf } from '../src/quiz/items.js';

const course = JSON.parse(readFileSync(new URL('../src/data/japanese.json', import.meta.url)));
const lessons = course.units.flatMap((u) => u.lessons);
const all = lessons.flatMap((l) => l.items);

// Written out here, apart from the course, so a slip in the data can't check itself.
const KANA = Object.fromEntries(`あa いi うu えe おo かka きki くku けke こko さsa しshi すsu せse そso たta ちchi つtsu てte とto
  なna にni ぬnu ねne のno はha ひhi ふfu へhe ほho まma みmi むmu めme もmo やya ゆyu よyo らra りri るru れre ろro わwa をo んn
  がga ぎgi ぐgu げge ごgo ざza じji ずzu ぜze ぞzo だda ぢji づzu でde どdo ばba びbi ぶbu べbe ぼbo ぱpa ぴpi ぷpu ぺpe ぽpo`
  .split(/\s+/).filter(Boolean).map((k) => [k[0], k.slice(1)]).concat([['っ', ''], ['ゃ', 'ya'], ['ゅ', 'yu'], ['ょ', 'yo']]));
const MEANS = { かお: 'face', あき: 'autumn', いけ: 'pond', えき: 'station', すし: 'sushi', あさ: 'morning', かさ: 'umbrella', いす: 'chair', しお: 'salt', うし: 'cow', しか: 'deer', ここ: 'here', そこ: 'there', あお: 'blue', いえ: 'house', すいか: 'watermelon', おかし: 'sweets',
  いぬ: 'dog', ねこ: 'cat', さかな: 'fish', かに: 'crab', たこ: 'octopus', め: 'eye', みみ: 'ear', くち: 'mouth', て: 'hand', あたま: 'head',
  やま: 'mountain', うみ: 'sea', ゆき: 'snow', くるま: 'car', かわ: 'river', ほん: 'book', みかん: 'mandarin', かぎ: 'key', ともだち: 'friend', ぶた: 'pig',
  さんぽ: 'walk', てんぷら: 'tempura', はばたき: 'wingbeat', きって: 'stamp', しっぽ: 'tail', ざっし: 'magazine', にっぽん: 'Japan', おちゃ: 'tea',
  でんしゃ: 'train', ちょっと: 'a little', おかあさん: 'mum', おとうさん: 'dad', おばあちゃん: 'grandma', おじいちゃん: 'grandpa', まご: 'grandchild',
  ごはん: 'rice', たまご: 'egg', みず: 'water', りんご: 'apple', にく: 'meat', いち: 'one', に: 'two', さん: 'three', よん: 'four', ご: 'five',
  ろく: 'six', なな: 'seven', はち: 'eight', きゅう: 'nine', じゅう: 'ten', おはよう: 'good morning', こんにちは: 'hello', こんばんは: 'good evening',
  ありがとう: 'thank you', すみません: 'excuse me', はい: 'yes', いただきます: 'said before eating', おやすみ: 'good night' };
// Sentences, written with a space between their parts as children's books do.
const SAYS = { 'これは ねこです': 'This is a cat.', 'これは いぬです': 'This is a dog.', 'これは おちゃです': 'This is tea.', 'これは ほんです': 'This is a book.',
  'これは みずです': 'This is water.', 'これは りんごです': 'This is an apple.', 'これは まごです': 'This is my grandchild.',
  'わたしは おばあちゃんです': 'I am Grandma.', 'わたしは おじいちゃんです': 'I am Grandpa.', 'こんにちは わたしは おじいちゃんです': 'Hello, I am Grandpa.' };
const kana = (s) => [...s].every((k) => KANA[k] !== undefined || k === ' ');
// Kana by kana: a small ゃ ゅ ょ joins the kana before it (き + ゃ is kya, し + ゃ sha), a small っ
// doubles the next consonant (ch takes a t).
const read = (s) => [...s].reduce((out, k, i, all) => {
  if ('ゃゅょ'.includes(k)) return out.replace(/(sh|ch|j)?i$/, (_, c) => (c || '') + (c ? '' : 'y')) + KANA[k].slice(1);
  if (all[i - 1] === 'っ') return out + (KANA[k].startsWith('ch') ? 't' : KANA[k][0]) + KANA[k];
  return out + KANA[k];
}, '');
// As said: a は ending a part of more than one kana is said "wa" (これは, こんにちは).
const said = (s) => s.split(' ').map((p) => (p.length > 1 && p.endsWith('は') ? read(p.slice(0, -1)) + 'wa' : read(p))).join(' ');
const bare = (s) => s.replaceAll(' ', '');

test('every Japanese item passes problem(), and ids are unique', () => {
  for (const item of all) assert.equal(problem(item), null, item.id);
  assert.equal(new Set(all.map((i) => i.id)).size, all.length);
});

test('every answer is the true reading, worked out from the kana', () => {
  for (const item of all) {
    if (item.speak) assert.ok(kana(item.speak), `${item.id} speaks kana`);
    if (item.type === 'teach' && kana(item.show)) assert.equal(bare(item.read), bare(said(item.show)), item.id);
    if (item.type === 'pick') {
      if (kana(item.answer)) assert.equal(said(item.answer), item.show, item.id); // which kana says this
      else assert.equal(said(item.show), item.answer, item.id); // how does this read
      if (item.listen) assert.equal(item.speak, item.answer, item.id);
      // No other option may also be right.
      for (const o of item.options) if (o !== item.answer) assert.notEqual(kana(o) ? said(o) : o, kana(item.answer) ? item.show : item.answer, `${item.id}: ${o}`);
    }
    if (item.type === 'pairs') for (const [l, r] of item.pairs) assert.ok(r === said(l) || r === MEANS[l] || r === SAYS[l], `${item.id}: ${l} ${r}`);
    if (item.type === 'build') {
      // A sentence is built from words, its lone は said "wa"; a word from kana.
      const sentence = item.answer.some((t) => [...t].length > 1);
      const w = item.answer.join(sentence ? ' ' : '');
      const sound = sentence ? item.answer.map((t) => (t === 'は' ? 'wa' : said(t))).join(' ') : said(w);
      const means = sentence ? Object.entries(SAYS).find(([k]) => bare(k) === bare(w))?.[1] : MEANS[w];
      assert.ok(means && item.show.startsWith(`${sound}: ${means}`), item.id);
      assert.equal(item.speak, bare(w), item.id);
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

test('teaching from zero: a term is explained on a teach card the first time it appears', () => {
  for (const term of [/\bkana\b/i, /\bhiragana\b/i, /\bromaji\b/i, /\bvowels?\b/i, /\brows?\b/i, /\btiles?\b/i]) {
    const first = all.find((i) => term.test(`${i.text || ''} ${i.prompt || ''}`));
    if (first) assert.equal(first.type, 'teach', `${first.id} is the first to say ${term}`);
  }
});

test('teaching from zero: words are explained before one is built, and a word is met before it is asked', () => {
  const met = new Set();
  for (const item of all) {
    if (item.type === 'teach' && MEANS[item.show]) met.add(item.show);
    if (item.type === 'build') assert.ok(met.size, `${item.id} builds a word before a teach card has made one`);
    // A build's card states its meaning; a pick or pairs relies on having met the word.
    const asked = item.type === 'pick' ? [item.show, ...item.options] : (item.pairs || []).map(([l]) => l);
    for (const w of asked) if (MEANS[w] && [...w].length > 1) assert.ok(met.has(w), `${item.id} asks ${w} before a teach card gives it`);
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
