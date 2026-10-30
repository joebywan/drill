import { shuffle } from './items.js';

/**
 * Fresh versions of a script course's items (repeat.js `vary`): ask the other way round (sound to
 * kana, kana to sound), by ear, with different decoys, or a pairs item with another pair in it.
 * Teach cards say what each glyph and word reads, and walking the path in order says what has been
 * taught by each item, so a version only uses what the learner has met at that point. Only `pick`
 * spells a word from glyphs, and a decoy word is one glyph off the real one.
 */
const SCRIPT = /^[぀-ゟ]+$/; // ponytail: hiragana only; widen when a course teaches katakana

const taughtBy = (course) => {
  const at = new Map();
  const glyphs = new Map(); // glyph -> reading
  const words = new Map(); // word -> reading
  for (const item of course.units.flatMap((u) => u.lessons).flatMap((l) => l.items)) {
    if (item.type === 'teach' && SCRIPT.test(item.show ?? '') && item.read && !item.read.includes(' ')) {
      ([...item.show].length === 1 ? glyphs : words).set(item.show, item.read);
    }
    at.set(item.id, { glyphs: new Map(glyphs), words: new Map(words) });
  }
  return at;
};

const take = (list, count, random) => shuffle(list, random).slice(0, count);

const spell = (word, glyphs) => {
  const parts = [...word].map((g) => glyphs.get(g));
  return parts.every(Boolean) ? parts.join('') : null;
};

function pickVersions(item, { glyphs }, random) {
  const kana = SCRIPT.test(item.answer) ? item.answer : item.show;
  const parts = [...kana];
  const single = parts.length === 1;
  const sound = spell(kana, glyphs);
  if (!sound) return [];
  const others = [...glyphs.keys()];
  const near = single ? others.filter((g) => g !== kana)
    : parts.flatMap((g, i) => others.filter((o) => o !== g).map((o) => parts.with(i, o).join('')));
  const decoys = take(near, item.options.length - 1, random);
  if (!decoys.length) return [];
  const noun = single ? 'kana' : 'word';
  const toKana = { show: sound, speak: kana, options: [kana, ...decoys], answer: kana };
  return [
    { show: kana, speak: kana, prompt: single ? 'Which sound is this?' : 'How does this word read?',
      options: [sound, ...decoys.map((d) => spell(d, glyphs))], answer: sound, explain: `${kana} reads "${sound}".` },
    { ...toKana, prompt: `Which ${noun} says "${sound}"?`, explain: `"${sound}" is ${kana}.` },
    { ...toKana, listen: true, prompt: `Which ${noun} is this sound?`, explain: `That was "${sound}": ${kana}.` },
  ];
}

function pairsVersions(item, { glyphs, words }, random) {
  const lefts = item.pairs.map(([l]) => l);
  const word = [...lefts[0]].length > 1;
  // Words: the same words matched to how they read rather than what they mean.
  if (word) {
    const read = item.pairs.map(([l]) => [l, words.get(l)]);
    return read.every(([, r]) => r) ? [{ prompt: 'Match each word to how it reads.', pairs: read, explain: read.map((p) => p.join(' ')).join(', ') + '.' }] : [];
  }
  // Glyphs: one pair swapped for another taught glyph.
  const [spare] = take([...glyphs.keys()].filter((g) => !lefts.includes(g)), 1, random);
  if (!spare) return [];
  const pairs = item.pairs.with(Math.floor(random() * item.pairs.length), [spare, glyphs.get(spare)]);
  return [{ pairs, explain: pairs.map((p) => p.join(' ')).join(', ') + '.' }];
}

function buildVersions(item, { glyphs }, random) {
  const tiles = take([...glyphs.keys()].filter((g) => !item.answer.includes(g)), item.tiles?.length ?? 0, random);
  return tiles.length ? [{ tiles }] : [];
}

const VERSIONS = { pick: pickVersions, pairs: pairsVersions, build: buildVersions };

/** The course's `vary(item, random)`. An item with no other version (the very first kana) stays as written. */
export function varier(course) {
  const taught = taughtBy(course);
  return (item, random = Math.random) => {
    const known = taught.get(item.id);
    const versions = known && VERSIONS[item.type]?.(item, known, random) || [];
    // Only ever a different question: a pick's own direction is left out while another exists.
    const other = versions.filter((v) => v.prompt !== item.prompt);
    if (!other.length) return item;
    const { id, type } = item;
    return item.type === 'pick'
      ? { id, type, ...other[Math.floor(random() * other.length)] }
      : { ...item, ...other[Math.floor(random() * other.length)] };
  };
}
