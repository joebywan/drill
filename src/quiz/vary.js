import { shuffle } from './items.js';

/**
 * Fresh versions of a script course's items (repeat.js `vary`): ask the other way round (sound to
 * kana, kana to sound), by ear, with different decoys, or a pairs item with another pair in it.
 * Teach cards say what each glyph and word reads, and walking the path in order says what has been
 * taught by each item, so a version only uses what the learner has met at that point. Only `pick`
 * spells a word from glyphs, and a decoy word is one sound off the real one, never one that sounds
 * the same (ず and づ, お and を).
 */
const SCRIPT = /^[぀-ゟ]+$/; // ponytail: hiragana only; widen when a course teaches katakana
const SMALL = /^[ゃゅょ]$/;

/** A word's sounds: each kana, a small ゃ ゅ ょ joined to the one before (き + ゃ is kya). */
const unitsOf = (word) => [...word].reduce((out, g) => (SMALL.test(g) && out.length ? out.with(-1, out.at(-1) + g) : [...out, g]), []);

const taughtBy = (course) => {
  const at = new Map();
  const sounds = new Map(); // one sound's kana -> reading
  const words = new Map(); // word -> reading, as its card says it (こんにちは is konnichiwa)
  for (const item of course.units.flatMap((u) => u.lessons).flatMap((l) => l.items)) {
    if (item.type === 'teach' && SCRIPT.test(item.show ?? '') && item.read) {
      const units = unitsOf(item.show);
      const reads = item.read.split(' ');
      if (units.length === 1) sounds.set(item.show, item.read);
      else if (reads.length === 1) words.set(item.show, item.read);
      else if (reads.length === units.length) units.forEach((u, i) => sounds.set(u, reads[i])); // a row: か き く け こ
    }
    at.set(item.id, { sounds: new Map(sounds), words: new Map(words) });
  }
  return at;
};

const take = (list, count, random) => shuffle(list, random).slice(0, count);

/** How a word reads: its card's reading, else sound by sound, a small っ doubling what follows. */
const spell = (word, { sounds, words }) => {
  if (words.has(word)) return words.get(word);
  const units = unitsOf(word);
  const parts = units.map((u, i) => {
    if (u !== 'っ') return sounds.get(u);
    const next = sounds.get(units[i + 1]) ?? 'a';
    return /^[aiueon]/.test(next) ? undefined : next.startsWith('ch') ? 't' : next[0];
  });
  return parts.every(Boolean) ? parts.join('') : null;
};

function pickVersions(item, known, random) {
  const kana = SCRIPT.test(item.answer) ? item.answer : item.show;
  const parts = unitsOf(kana);
  const single = parts.length === 1;
  const sound = spell(kana, known);
  if (!sound) return [];
  const others = [...known.sounds.keys()];
  const near = single ? others.filter((g) => g !== kana)
    : parts.flatMap((g, i) => others.filter((o) => o !== g).map((o) => parts.with(i, o).join('')));
  const fair = new Map(); // decoy sound -> kana: one each, none that says the answer
  for (const d of shuffle(near, random)) {
    const s = spell(d, known);
    if (s && s !== sound && !fair.has(s)) fair.set(s, d);
  }
  const decoys = [...fair].slice(0, item.options.length - 1);
  if (!decoys.length) return [];
  const noun = single ? 'kana' : 'word';
  const toKana = { show: sound, speak: kana, options: [kana, ...decoys.map(([, d]) => d)], answer: kana };
  return [
    { show: kana, speak: kana, prompt: single ? 'Which sound is this?' : 'How does this word read?',
      options: [sound, ...decoys.map(([s]) => s)], answer: sound, explain: `${kana} reads "${sound}".` },
    { ...toKana, prompt: `Which ${noun} says "${sound}"?`, explain: `"${sound}" is ${kana}.` },
    { ...toKana, listen: true, prompt: `Which ${noun} is this sound?`, explain: `That was "${sound}": ${kana}.` },
  ];
}

function pairsVersions(item, known, random) {
  const lefts = item.pairs.map(([l]) => l);
  // Words: the same words matched to how they read rather than what they mean.
  if (lefts.some((l) => unitsOf(l).length > 1)) {
    const read = item.pairs.map(([l]) => [l, spell(l, known)]);
    return read.every(([, r]) => r) ? [{ prompt: 'Match each word to how it reads.', pairs: read, explain: read.map((p) => p.join(' ')).join(', ') + '.' }] : [];
  }
  // Glyphs: one pair swapped for another taught glyph that reads differently from the rest.
  const rights = item.pairs.map(([, r]) => r);
  const [spare] = take([...known.sounds.keys()].filter((g) => !lefts.includes(g) && !rights.includes(known.sounds.get(g))), 1, random);
  if (!spare) return [];
  const pairs = item.pairs.with(Math.floor(random() * item.pairs.length), [spare, known.sounds.get(spare)]);
  return [{ pairs, explain: pairs.map((p) => p.join(' ')).join(', ') + '.' }];
}

function buildVersions(item, known, random) {
  if (item.answer.some((t) => [...t].length > 1)) return []; // a sentence's word tiles stay as written
  // No decoy that could stand in for a tile and still say the word (わ for the は of こんばんは).
  const sound = spell(item.answer.join(''), known);
  const fair = (g) => !item.answer.some((t, i) => spell(item.answer.with(i, g).join(''), known) === sound);
  const tiles = take([...known.sounds.keys()].filter((g) => [...g].length === 1 && !item.answer.includes(g) && fair(g)), item.tiles?.length ?? 0, random);
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
